import { Router } from "express";
import mongoose from "mongoose";
import Quiz from "../models/Quiz.js";
import Category from "../models/Category.js";
import { requireAdmin, requireAuth } from "../middleware/auth.js";
import { normalizeSearch, parsePagination, toPublicQuiz } from "../services/catalog.js";

const router = Router();
const difficulties = new Set(["easy", "medium", "hard", "beginner", "intermediate", "advanced"]);

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

function parseQuestion(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) return null;
  const prompt = typeof input.prompt === "string" ? input.prompt.trim() : "";
  const options = Array.isArray(input.options) ? input.options.map((option) => typeof option === "string" ? option.trim() : "") : [];
  const correctOption = input.correctOption;
  if (prompt.length < 1 || prompt.length > 1000 || options.length < 2 || options.length > 6 ||
      options.some((option) => option.length < 1 || option.length > 300) ||
      !Number.isInteger(correctOption) || correctOption < 0 || correctOption >= options.length) return null;
  return { prompt, options, correctOption };
}

function parseQuizInput(input) {
  const { title, description = "", category, difficulty, durationMinutes, questions = [], isPublished = true } = input || {};
  if (typeof title !== "string" || title.trim().length < 2 || title.trim().length > 160 ||
      typeof category !== "string" || !category.trim() || category.trim().length > 80 ||
      !difficulties.has(difficulty) || !Number.isInteger(durationMinutes) || durationMinutes < 1 || durationMinutes > 600 ||
      !Array.isArray(questions) || questions.some((question) => !parseQuestion(question)) || typeof isPublished !== "boolean") return null;
  return {
    title: title.trim(), description, category: category.trim(), difficulty, durationMinutes,
    questions: questions.map(parseQuestion), isPublished
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

router.get("/", async (req, res, next) => {
  try {
    const paging = parsePagination(req.query);
    if (paging.error) return res.status(400).json({ message: paging.error });

    const filter = { isPublished: true };
    if (typeof req.query.category === "string" && req.query.category.trim()) {
      const category = await findActiveCategory(req.query.category);
      if (!category) return res.json({ quizzes: [], pagination: { page: paging.page, limit: paging.limit, total: 0, pages: 0 } });
      filter.category = category._id;
    }
    if (typeof req.query.difficulty === "string") {
      const difficulty = req.query.difficulty.trim().toLowerCase();
      if (!difficulties.has(difficulty)) return res.status(400).json({ message: "Difficulty must be easy, medium, hard, beginner, intermediate, or advanced" });
      filter.difficulty = difficulty;
    }
    const search = normalizeSearch(req.query.search);
    if (search) filter.title = { $regex: search, $options: "i" };

    const [quizzes, total] = await Promise.all([
      Quiz.find(filter).populate({ path: "category", match: { isActive: true }, select: "name slug" })
        .sort({ publishedAt: -1, createdAt: -1, _id: 1 }).skip(paging.skip).limit(paging.limit).lean(),
      Quiz.countDocuments(filter)
    ]);
    const visible = quizzes.filter((quiz) => quiz.category);
    res.json({
      quizzes: visible.map(quizSummary),
      pagination: { page: paging.page, limit: paging.limit, total, pages: Math.ceil(total / paging.limit) }
    });
  } catch (error) { next(error); }
});

router.post("/", requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const quizInput = parseQuizInput(req.body);
    if (!quizInput) return res.status(400).json({ message: "Provide a valid title, active category, difficulty, duration, publication status, and question list" });
    const category = await findActiveCategory(quizInput.category);
    if (!category) return res.status(400).json({ message: "Select an active quiz category" });
    const quiz = await Quiz.create({
      ...quizInput,
      category: category._id,
      totalQuestions: quizInput.questions.length,
      publishedAt: quizInput.isPublished ? new Date() : null,
      createdBy: req.user.id
    });
    await quiz.populate({ path: "category", select: "name slug" });
    res.status(201).json({ quiz: quizSummary(quiz), questions: quiz.questions.map(adminQuestion) });
  } catch (error) { next(error); }
});

router.get("/:quizId", async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.quizId)) return res.status(400).json({ message: "Invalid quiz identifier" });
    const quiz = await Quiz.findOne({ _id: req.params.quizId, isPublished: true })
      .populate({ path: "category", match: { isActive: true }, select: "name slug" }).lean();
    if (!quiz || !quiz.category) return res.status(404).json({ message: "Quiz not found" });
    res.json({ quiz: quizSummary(quiz), questions: (quiz.questions || []).map(publicQuestion) });
  } catch (error) { next(error); }
});

router.patch("/:quizId", requireAuth, requireAdmin, async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.quizId)) return res.status(400).json({ message: "Invalid quiz identifier" });
    const allowed = ["title", "description", "category", "difficulty", "durationMinutes", "isPublished"];
    const entries = Object.entries(req.body || {});
    if (!entries.length || entries.some(([key]) => !allowed.includes(key))) return res.status(400).json({ message: "Only quiz details may be updated here" });
    const updates = Object.fromEntries(entries);
    if (updates.title !== undefined && (typeof updates.title !== "string" || updates.title.trim().length < 2 || updates.title.trim().length > 160)) return res.status(400).json({ message: "Title must be 2–160 characters" });
    if (updates.category !== undefined) {
      const category = await findActiveCategory(updates.category);
      if (!category) return res.status(400).json({ message: "Select an active quiz category" });
      updates.category = category._id;
    }
    if (updates.difficulty !== undefined && !difficulties.has(updates.difficulty)) return res.status(400).json({ message: "Unsupported quiz difficulty" });
    if (updates.durationMinutes !== undefined && (!Number.isInteger(updates.durationMinutes) || updates.durationMinutes < 1 || updates.durationMinutes > 600)) return res.status(400).json({ message: "Duration must be between 1 and 600 minutes" });
    if (updates.description !== undefined && (typeof updates.description !== "string" || updates.description.length > 2000)) return res.status(400).json({ message: "Description must be at most 2000 characters" });
    if (updates.isPublished !== undefined && typeof updates.isPublished !== "boolean") return res.status(400).json({ message: "isPublished must be a boolean" });
    if (updates.title) updates.title = updates.title.trim();
    if (updates.isPublished === true) updates.publishedAt = new Date();
    if (updates.isPublished === false) updates.publishedAt = null;
    const quiz = await Quiz.findByIdAndUpdate(req.params.quizId, updates, { new: true, runValidators: true })
      .populate({ path: "category", select: "name slug" });
    if (!quiz) return res.status(404).json({ message: "Quiz not found" });
    res.json({ quiz: quizSummary(quiz) });
  } catch (error) { next(error); }
});

router.post("/:quizId/questions", requireAuth, requireAdmin, async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.quizId)) return res.status(400).json({ message: "Invalid quiz identifier" });
    const question = parseQuestion(req.body);
    if (!question) return res.status(400).json({ message: "A question needs a prompt, 2–6 options, and a valid correctOption index" });
    const quiz = await Quiz.findById(req.params.quizId);
    if (!quiz) return res.status(404).json({ message: "Quiz not found" });
    quiz.questions.push(question);
    quiz.totalQuestions = quiz.questions.length;
    await quiz.save();
    res.status(201).json({ question: adminQuestion(quiz.questions.at(-1)) });
  } catch (error) { next(error); }
});

router.patch("/:quizId/questions/:questionId", requireAuth, requireAdmin, async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.quizId) || !mongoose.isValidObjectId(req.params.questionId)) return res.status(400).json({ message: "Invalid quiz or question identifier" });
    const question = parseQuestion(req.body);
    if (!question) return res.status(400).json({ message: "A question needs a prompt, 2–6 options, and a valid correctOption index" });
    const quiz = await Quiz.findById(req.params.quizId);
    if (!quiz) return res.status(404).json({ message: "Quiz not found" });
    const existing = quiz.questions.id(req.params.questionId);
    if (!existing) return res.status(404).json({ message: "Question not found" });
    existing.set(question);
    await quiz.save();
    res.json({ question: adminQuestion(existing) });
  } catch (error) { next(error); }
});

router.delete("/:quizId/questions/:questionId", requireAuth, requireAdmin, async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.quizId) || !mongoose.isValidObjectId(req.params.questionId)) return res.status(400).json({ message: "Invalid quiz or question identifier" });
    const quiz = await Quiz.findById(req.params.quizId);
    if (!quiz) return res.status(404).json({ message: "Quiz not found" });
    const question = quiz.questions.id(req.params.questionId);
    if (!question) return res.status(404).json({ message: "Question not found" });
    question.deleteOne();
    quiz.totalQuestions = quiz.questions.length;
    await quiz.save();
    res.status(204).end();
  } catch (error) { next(error); }
});

export default router;
