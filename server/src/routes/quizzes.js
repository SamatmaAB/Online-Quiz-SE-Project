import { Router } from "express";
import mongoose from "mongoose";
import Quiz from "../models/Quiz.js";
import Category from "../models/Category.js";
import SubjectEnrollment from "../models/SubjectEnrollment.js";
import { optionalAuth, requireAuth } from "../middleware/auth.js";
import { normalizeSearch, parsePagination, toPublicQuiz } from "../services/catalog.js";
import { MAX_QUESTIONS_PER_QUIZ, difficulties, parseQuestion, slugify } from "../services/questions.js";
import { CUSTOM_KEY_PATTERN, subjectForUser } from "../services/subjectAccess.js";

const router = Router();
const categoryPopulate = { path: "category", select: "name slug isActive" };

function publicQuestion(question) {
  return { id: question.id, prompt: question.prompt, options: question.options };
}

function adminQuestion(question) {
  return { ...publicQuestion(question), correctOption: question.correctOption };
}

function quizSummary(quiz) {
  const result = toPublicQuiz(quiz);
  return { ...result, questionCount: quiz.questions?.length ?? quiz.totalQuestions ?? 0 };
}

/** Adds owner-only fields; never use this on public endpoints. */
function ownerSummary(quiz) {
  const item = typeof quiz.toObject === "function" ? quiz.toObject() : quiz;
  return {
    ...quizSummary(item),
    isPublished: Boolean(item.isPublished),
    source: item.source ?? "manual",
    createdBy: item.createdBy ? String(item.createdBy._id ?? item.createdBy) : null
  };
}

const isOwnerOrAdmin = (user, quiz) => user.role === "admin" || String(quiz.createdBy) === String(user.id);

function parseQuizInput(input) {
  const { title, description = "", category, difficulty, durationMinutes, questions = [], isPublished = true, subjectKey = null, unitIndex = null, source = "manual" } = input || {};
  const linkedToUnit = subjectKey !== null || unitIndex !== null;
  const validUnitLink = linkedToUnit
    ? typeof subjectKey === "string" && subjectKey.trim().length > 0 && subjectKey.trim().length <= 80 && Number.isInteger(unitIndex) && unitIndex >= 0 && unitIndex <= 39
    : true;
  if (typeof title !== "string" || title.trim().length < 2 || title.trim().length > 160 ||
      typeof description !== "string" || description.length > 2000 ||
      typeof category !== "string" || !category.trim() || category.trim().length > 80 ||
      !difficulties.has(difficulty) || !Number.isInteger(durationMinutes) || durationMinutes < 1 || durationMinutes > 600 ||
      !Array.isArray(questions) || questions.length > MAX_QUESTIONS_PER_QUIZ || questions.some((question) => !parseQuestion(question)) ||
      typeof isPublished !== "boolean" || !validUnitLink || !["manual", "ai"].includes(source)) return null;
  return {
    title: title.trim(), description: description.trim(), category: category.trim(), difficulty, durationMinutes,
    questions: questions.map(parseQuestion), isPublished,
    subjectKey: linkedToUnit ? subjectKey.trim() : null, unitIndex: linkedToUnit ? unitIndex : null, source
  };
}

async function findActiveCategory(value) {
  if (typeof value !== "string" || !value.trim()) return null;
  const normalized = value.trim();
  if (mongoose.isValidObjectId(normalized)) {
    const byId = await Category.findOne({ _id: normalized, isActive: true });
    if (byId) return byId;
  }
  const escapedName = normalized.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return Category.findOne({
    isActive: true,
    $or: [{ slug: normalized.toLowerCase() }, { name: new RegExp(`^${escapedName}$`, "i") }]
  });
}

/** Resolves a category by id, slug or name, creating it on first use so users never need a separate setup step. */
async function resolveOrCreateCategory(value) {
  const existing = await findActiveCategory(value);
  if (existing) return { category: existing };
  const name = String(value || "").trim().replace(/\s+/g, " ");
  const slug = slugify(name);
  if (name.length < 2 || !slug) return { error: "Choose a category name of at least 2 characters" };
  if (await Category.exists({ slug })) return { error: "That category has been disabled by an administrator" };
  try {
    return { category: await Category.create({ name, slug }) };
  } catch (error) {
    if (error.code === 11000) {
      const winner = await findActiveCategory(name);
      if (winner) return { category: winner };
      return { error: "That category already exists but is not available" };
    }
    throw error;
  }
}

async function validateUnitLink(user, input) {
  if (input.subjectKey === null) return null;
  const subject = await subjectForUser(input.subjectKey, user.id);
  if (!subject) return "Choose a subject you have access to";
  if (!subject.units?.[input.unitIndex]) return "Choose a valid unit in that subject";
  return null;
}

async function loadManageable(req, res) {
  if (!mongoose.isValidObjectId(req.params.quizId)) {
    res.status(400).json({ message: "Invalid quiz identifier" });
    return null;
  }
  const quiz = await Quiz.findById(req.params.quizId);
  if (!quiz) {
    res.status(404).json({ message: "Quiz not found" });
    return null;
  }
  if (!isOwnerOrAdmin(req.user, quiz)) {
    res.status(403).json({ message: "You can only change quizzes you created" });
    return null;
  }
  return quiz;
}

// Quizzes tied to someone's private (custom) subject are never listed in the shared catalogue.
const sharedCatalogue = { subjectKey: { $not: CUSTOM_KEY_PATTERN } };

router.get("/", optionalAuth, async (req, res, next) => {
  try {
    const paging = parsePagination(req.query);
    if (paging.error) return res.status(400).json({ message: paging.error });

    const visibility = req.user?.role === "admin"
      ? {}
      : req.user
        ? { $or: [{ createdBy: req.user.id }, { createdBy: null }] }
        : { createdBy: null };
    const filter = { isPublished: true, ...sharedCatalogue, ...visibility };
    if (typeof req.query.category === "string" && req.query.category.trim()) {
      const category = await findActiveCategory(req.query.category);
      if (!category) return res.json({ quizzes: [], pagination: { page: paging.page, limit: paging.limit, total: 0, pages: 0 } });
      filter.category = category._id;
    }
    if (typeof req.query.difficulty === "string" && req.query.difficulty.trim()) {
      const difficulty = req.query.difficulty.trim().toLowerCase();
      if (!difficulties.has(difficulty)) return res.status(400).json({ message: "Difficulty must be easy, medium, hard, beginner, intermediate, or advanced" });
      filter.difficulty = difficulty;
    }
    const search = normalizeSearch(req.query.search);
    if (search) filter.title = { $regex: search, $options: "i" };

    const sortKey = req.query.sort === "title" ? { title: 1, _id: 1 } : req.query.sort === "shortest" ? { durationMinutes: 1, _id: 1 } : { publishedAt: -1, createdAt: -1, _id: 1 };
    const [quizzes, total] = await Promise.all([
      Quiz.find(filter).populate({ path: "category", match: { isActive: true }, select: "name slug" }).populate("createdBy", "name")
        .sort(sortKey).skip(paging.skip).limit(paging.limit).lean(),
      Quiz.countDocuments(filter)
    ]);
    res.json({
      quizzes: quizzes.filter((quiz) => quiz.category).map((quiz) => ({
        ...quizSummary(quiz),
        ...(req.user?.role === "admin" ? { creatorName: quiz.createdBy?.name ?? "System" } : {})
      })),
      pagination: { page: paging.page, limit: paging.limit, total, pages: Math.ceil(total / paging.limit) }
    });
  } catch (error) { next(error); }
});

router.get("/mine", requireAuth, async (req, res, next) => {
  try {
    const filter = req.query.scope === "all" && req.user.role === "admin" ? {} : { createdBy: req.user.id };
    const quizzes = await Quiz.find(filter).populate(categoryPopulate).populate("createdBy", "name")
      .sort({ updatedAt: -1 }).limit(300).lean();
    res.json({
      quizzes: quizzes.map((quiz) => ({
        ...ownerSummary({ ...quiz, createdBy: quiz.createdBy?._id }),
        creatorName: quiz.createdBy?.name ?? "Unknown",
        updatedAt: quiz.updatedAt
      }))
    });
  } catch (error) { next(error); }
});

router.get("/by-unit", requireAuth, async (req, res, next) => {
  try {
    const subjectKey = typeof req.query.subjectKey === "string" ? req.query.subjectKey.trim() : "";
    const unitIndex = Number(req.query.unitIndex);
    if (!subjectKey || subjectKey.length > 80 || !Number.isInteger(unitIndex) || unitIndex < 0 || unitIndex > 39) {
      return res.status(400).json({ message: "Provide a subject key and a valid unit index" });
    }
    const enrollment = await SubjectEnrollment.findOne({ user: req.user.id, subjectKey, status: "enrolled" }).lean();
    if (!enrollment) return res.status(403).json({ message: "Enroll in this subject to view its quizzes" });
    const unitFilter = req.user.role === "admin"
      ? { subjectKey, unitIndex, $or: [{ isPublished: true }, { createdBy: req.user.id }] }
      : { subjectKey, unitIndex, $or: [{ createdBy: req.user.id }, { createdBy: null, isPublished: true }] };
    const quizzes = await Quiz.find(unitFilter)
      .populate({ path: "category", select: "name slug" })
      .populate("createdBy", "name")
      .sort({ publishedAt: -1, createdAt: -1, _id: 1 }).lean();
    res.json({
      quizzes: quizzes.filter((quiz) => quiz.category).map((quiz) => ({
        ...ownerSummary({ ...quiz, createdBy: quiz.createdBy?._id }),
        creatorName: quiz.createdBy?.name ?? "System",
        isMine: String(quiz.createdBy?._id ?? quiz.createdBy) === req.user.id
      }))
    });
  } catch (error) { next(error); }
});

router.post("/", requireAuth, async (req, res, next) => {
  try {
    const quizInput = parseQuizInput(req.body);
    if (!quizInput) return res.status(400).json({ message: "Provide a title (2–160 chars), category, difficulty, duration (1–600 min), and up to 100 valid questions (2–6 options each)" });
    if (quizInput.isPublished && !quizInput.questions.length) return res.status(400).json({ message: "Add at least one question before publishing, or save it as a draft" });
    const linkError = await validateUnitLink(req.user, quizInput);
    if (linkError) return res.status(400).json({ message: linkError });
    const { category, error } = await resolveOrCreateCategory(quizInput.category);
    if (error) return res.status(400).json({ message: error });
    const quiz = await Quiz.create({
      ...quizInput,
      category: category._id,
      totalQuestions: quizInput.questions.length,
      publishedAt: quizInput.isPublished ? new Date() : null,
      createdBy: req.user.id
    });
    await quiz.populate({ path: "category", select: "name slug" });
    res.status(201).json({ quiz: ownerSummary(quiz), questions: quiz.questions.map(adminQuestion) });
  } catch (error) { next(error); }
});

router.get("/:quizId/manage", requireAuth, async (req, res, next) => {
  try {
    const quiz = await loadManageable(req, res);
    if (!quiz) return;
    await quiz.populate({ path: "category", select: "name slug" });
    res.json({ quiz: ownerSummary(quiz), questions: quiz.questions.map(adminQuestion) });
  } catch (error) { next(error); }
});

router.get("/:quizId", async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.quizId)) return res.status(400).json({ message: "Invalid quiz identifier" });
    const quiz = await Quiz.findOne({ _id: req.params.quizId, isPublished: true })
      .populate({ path: "category", match: { isActive: true }, select: "name slug" })
      .populate("createdBy", "name").lean();
    if (!quiz || !quiz.category) return res.status(404).json({ message: "Quiz not found or not published yet" });
    res.json({
      quiz: { ...quizSummary(quiz), creatorName: quiz.createdBy?.name ?? "System" },
      questions: (quiz.questions || []).map(publicQuestion)
    });
  } catch (error) { next(error); }
});

// Full replace: used by the quiz builder to save details and all questions together.
router.put("/:quizId", requireAuth, async (req, res, next) => {
  try {
    const quiz = await loadManageable(req, res);
    if (!quiz) return;
    const quizInput = parseQuizInput(req.body);
    if (!quizInput) return res.status(400).json({ message: "Provide a title (2–160 chars), category, difficulty, duration (1–600 min), and up to 100 valid questions (2–6 options each)" });
    if (quizInput.isPublished && !quizInput.questions.length) return res.status(400).json({ message: "Add at least one question before publishing, or save it as a draft" });
    const linkError = await validateUnitLink(req.user, quizInput);
    if (linkError) return res.status(400).json({ message: linkError });
    const { category, error } = await resolveOrCreateCategory(quizInput.category);
    if (error) return res.status(400).json({ message: error });
    const wasPublished = quiz.isPublished;
    quiz.set({
      ...quizInput,
      category: category._id,
      totalQuestions: quizInput.questions.length,
      publishedAt: quizInput.isPublished ? (wasPublished && quiz.publishedAt ? quiz.publishedAt : new Date()) : null
    });
    await quiz.save();
    await quiz.populate({ path: "category", select: "name slug" });
    res.json({ quiz: ownerSummary(quiz), questions: quiz.questions.map(adminQuestion) });
  } catch (error) { next(error); }
});

router.patch("/:quizId", requireAuth, async (req, res, next) => {
  try {
    const quiz = await loadManageable(req, res);
    if (!quiz) return;
    const allowed = ["title", "description", "category", "difficulty", "durationMinutes", "isPublished"];
    const entries = Object.entries(req.body || {});
    if (!entries.length || entries.some(([key]) => !allowed.includes(key))) return res.status(400).json({ message: "Only quiz details may be updated here" });
    const updates = Object.fromEntries(entries);
    if (updates.title !== undefined && (typeof updates.title !== "string" || updates.title.trim().length < 2 || updates.title.trim().length > 160)) return res.status(400).json({ message: "Title must be 2–160 characters" });
    if (updates.category !== undefined) {
      const { category, error } = await resolveOrCreateCategory(updates.category);
      if (error) return res.status(400).json({ message: error });
      updates.category = category._id;
    }
    if (updates.difficulty !== undefined && !difficulties.has(updates.difficulty)) return res.status(400).json({ message: "Unsupported quiz difficulty" });
    if (updates.durationMinutes !== undefined && (!Number.isInteger(updates.durationMinutes) || updates.durationMinutes < 1 || updates.durationMinutes > 600)) return res.status(400).json({ message: "Duration must be between 1 and 600 minutes" });
    if (updates.description !== undefined && (typeof updates.description !== "string" || updates.description.length > 2000)) return res.status(400).json({ message: "Description must be at most 2000 characters" });
    if (updates.isPublished !== undefined && typeof updates.isPublished !== "boolean") return res.status(400).json({ message: "isPublished must be a boolean" });
    if (updates.isPublished === true && !quiz.questions.length) return res.status(409).json({ message: "Add at least one question before publishing" });
    if (updates.title) updates.title = updates.title.trim();
    if (updates.isPublished === true) updates.publishedAt = quiz.isPublished && quiz.publishedAt ? quiz.publishedAt : new Date();
    if (updates.isPublished === false) updates.publishedAt = null;
    quiz.set(updates);
    await quiz.save();
    await quiz.populate({ path: "category", select: "name slug" });
    res.json({ quiz: ownerSummary(quiz) });
  } catch (error) { next(error); }
});

router.delete("/:quizId", requireAuth, async (req, res, next) => {
  try {
    const quiz = await loadManageable(req, res);
    if (!quiz) return;
    await quiz.deleteOne();
    res.status(204).end();
  } catch (error) { next(error); }
});

router.post("/:quizId/questions", requireAuth, async (req, res, next) => {
  try {
    const quiz = await loadManageable(req, res);
    if (!quiz) return;
    const question = parseQuestion(req.body);
    if (!question) return res.status(400).json({ message: "A question needs a prompt, 2–6 options, and a valid correctOption index" });
    if (quiz.questions.length >= MAX_QUESTIONS_PER_QUIZ) return res.status(409).json({ message: `A quiz can have at most ${MAX_QUESTIONS_PER_QUIZ} questions` });
    quiz.questions.push(question);
    quiz.totalQuestions = quiz.questions.length;
    await quiz.save();
    res.status(201).json({ question: adminQuestion(quiz.questions.at(-1)) });
  } catch (error) { next(error); }
});

router.patch("/:quizId/questions/:questionId", requireAuth, async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.questionId)) return res.status(400).json({ message: "Invalid question identifier" });
    const quiz = await loadManageable(req, res);
    if (!quiz) return;
    const question = parseQuestion(req.body);
    if (!question) return res.status(400).json({ message: "A question needs a prompt, 2–6 options, and a valid correctOption index" });
    const existing = quiz.questions.id(req.params.questionId);
    if (!existing) return res.status(404).json({ message: "Question not found" });
    existing.set(question);
    await quiz.save();
    res.json({ question: adminQuestion(existing) });
  } catch (error) { next(error); }
});

router.delete("/:quizId/questions/:questionId", requireAuth, async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.questionId)) return res.status(400).json({ message: "Invalid question identifier" });
    const quiz = await loadManageable(req, res);
    if (!quiz) return;
    const question = quiz.questions.id(req.params.questionId);
    if (!question) return res.status(404).json({ message: "Question not found" });
    question.deleteOne();
    quiz.totalQuestions = quiz.questions.length;
    await quiz.save();
    res.status(204).end();
  } catch (error) { next(error); }
});

export default router;
