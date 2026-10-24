import { Router } from "express";
import mongoose from "mongoose";
import Attempt from "../models/Attempt.js";
import Quiz from "../models/Quiz.js";
import { requireAdmin, requireAuth } from "../middleware/auth.js";

const router = Router();

function attemptView(attempt, { review = false, includeUser = false } = {}) {
  const result = {
    id: attempt.id,
    quiz: { id: attempt.quiz, title: attempt.quizTitle, category: attempt.category, difficulty: attempt.difficulty },
    durationMinutes: attempt.durationMinutes,
    startedAt: attempt.startedAt,
    expiresAt: attempt.expiresAt,
    submittedAt: attempt.submittedAt,
    status: attempt.status,
    score: attempt.score,
    totalQuestions: attempt.totalQuestions,
    percentage: attempt.percentage,
    questions: attempt.questions.map((question) => ({
      id: question.questionId,
      prompt: question.prompt,
      options: question.options,
      selectedOption: question.selectedOption,
      ...(review ? { correctOption: question.correctOption, isCorrect: question.selectedOption === question.correctOption } : {})
    })),
    createdAt: attempt.createdAt
  };
  if (includeUser) result.user = attempt.user && typeof attempt.user === "object" && attempt.user.name
    ? { id: attempt.user.id, name: attempt.user.name, email: attempt.user.email }
    : { id: attempt.user };
  if (attempt.status === "in-progress") result.remainingSeconds = Math.max(0, Math.ceil((attempt.expiresAt.getTime() - Date.now()) / 1000));
  return result;
}

function calculateScore(questions, totalQuestions) {
  const score = questions.reduce((total, question) => total + (question.selectedOption === question.correctOption ? 1 : 0), 0);
  const percentage = totalQuestions ? Math.round((score / totalQuestions) * 10000) / 100 : 0;
  return { score, percentage };
}
async function finalizeExpired(attempt) {
  if (attempt.status !== "in-progress" || attempt.expiresAt.getTime() > Date.now()) return attempt;
  Object.assign(attempt, calculateScore(attempt.questions, attempt.totalQuestions));
  
  attempt.status = "timed-out";
  attempt.submittedAt = attempt.expiresAt;
  await attempt.save();
  return attempt;
}

router.post("/", requireAuth, async (req, res, next) => {
  try {
    const { quizId } = req.body || {};
    if (!mongoose.isValidObjectId(quizId)) return res.status(400).json({ message: "A valid quizId is required" });
    const quiz = await Quiz.findOne({ _id: quizId, isPublished: true })
      .populate({ path: "category", match: { isActive: true }, select: "name slug" });
    if (!quiz || !quiz.category) return res.status(404).json({ message: "Quiz not found" });
    if (!quiz.questions.length) return res.status(409).json({ message: "This quiz has no questions yet" });
    const startedAt = new Date();
    const expiresAt = new Date(startedAt.getTime() + quiz.durationMinutes * 60_000);
    const attempt = await Attempt.create({
      user: req.user.id,
      quiz: quiz.id,
      quizTitle: quiz.title,
      category: quiz.category.name,
      difficulty: quiz.difficulty,
      durationMinutes: quiz.durationMinutes,
      startedAt,
      expiresAt,
      totalQuestions: quiz.questions.length,
      questions: quiz.questions.map((question) => ({
        questionId: question.id,
        prompt: question.prompt,
        options: question.options,
        correctOption: question.correctOption,
        selectedOption: null
      }))
    });
    res.status(201).json({ attempt: attemptView(attempt) });
  } catch (error) { next(error); }
});

router.get("/mine", requireAuth, async (req, res, next) => {
  try {
    const attempts = await Attempt.find({ user: req.user.id }).sort({ createdAt: -1 }).limit(100);
    for (const attempt of attempts) await finalizeExpired(attempt);
    res.json({ attempts: attempts.map((attempt) => attemptView(attempt, { review: attempt.status !== "in-progress" })) });
  } catch (error) { next(error); }
});

router.get("/admin/results", requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const filter = {};
    if (req.query.quizId !== undefined) {
      if (!mongoose.isValidObjectId(req.query.quizId)) return res.status(400).json({ message: "Invalid quizId" });
      filter.quiz = req.query.quizId;
    }
    if (req.query.userId !== undefined) {
      if (!mongoose.isValidObjectId(req.query.userId)) return res.status(400).json({ message: "Invalid userId" });
      filter.user = req.query.userId;
    }
    const attempts = await Attempt.find(filter).populate("user", "name email").sort({ createdAt: -1 }).limit(200);
    for (const attempt of attempts) await finalizeExpired(attempt);
    res.json({ attempts: attempts.map((attempt) => attemptView(attempt, { review: attempt.status !== "in-progress", includeUser: true })) });
  } catch (error) { next(error); }
});

router.get("/:attemptId", requireAuth, async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.attemptId)) return res.status(400).json({ message: "Invalid attempt identifier" });
    const attempt = await Attempt.findById(req.params.attemptId);
    if (!attempt) return res.status(404).json({ message: "Attempt not found" });
    if (String(attempt.user) !== req.user.id && req.user.role !== "admin") return res.status(403).json({ message: "You cannot access this attempt" });
    await finalizeExpired(attempt);
    res.json({ attempt: attemptView(attempt, { review: attempt.status !== "in-progress" }) });
  } catch (error) { next(error); }
});

router.patch("/:attemptId/answers", requireAuth, async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.attemptId)) return res.status(400).json({ message: "Invalid attempt identifier" });
    const attempt = await Attempt.findById(req.params.attemptId);
    if (!attempt) return res.status(404).json({ message: "Attempt not found" });
    if (String(attempt.user) !== req.user.id) return res.status(403).json({ message: "You cannot update this attempt" });
    await finalizeExpired(attempt);
    if (attempt.status !== "in-progress") return res.status(409).json({ message: "This attempt is already closed" });
    const { answers } = req.body || {};
    if (!Array.isArray(answers)) return res.status(400).json({ message: "answers must be an array of { questionId, selectedOption } values" });
    const questionsById = new Map(attempt.questions.map((question) => [String(question.questionId), question]));
    const seen = new Set();
    for (const answer of answers) {
      const questionId = String(answer?.questionId || "");
      const question = questionsById.get(questionId);
      const selectedOption = answer?.selectedOption;
      if (!question || seen.has(questionId) ||
          !(selectedOption === null || (Number.isInteger(selectedOption) && selectedOption >= 0 && selectedOption < question.options.length))) {
        return res.status(400).json({ message: "Each answer must identify a question in this attempt and use an available option or null" });
      }
      seen.add(questionId);
      question.selectedOption = selectedOption;
    }
    await attempt.save();
    res.json({ attempt: attemptView(attempt) });
  } catch (error) { next(error); }
});

router.post("/:attemptId/submit", requireAuth, async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.attemptId)) return res.status(400).json({ message: "Invalid attempt identifier" });
    const attempt = await Attempt.findById(req.params.attemptId);
    if (!attempt) return res.status(404).json({ message: "Attempt not found" });
    if (String(attempt.user) !== req.user.id && req.user.role !== "admin") return res.status(403).json({ message: "You cannot submit this attempt" });
    if (attempt.status !== "in-progress") return res.json({ attempt: attemptView(attempt, { review: true }) });

    const { answers } = req.body || {};
    if (!Array.isArray(answers)) return res.status(400).json({ message: "answers must be an array of { questionId, selectedOption } values" });
    const answersById = new Map();
    for (const answer of answers) {
      if (!answer || !mongoose.isValidObjectId(answer.questionId) ||
          !(answer.selectedOption === null || (Number.isInteger(answer.selectedOption) && answer.selectedOption >= 0)) || answersById.has(String(answer.questionId))) {
        return res.status(400).json({ message: "Each answer must contain a unique questionId and an integer selectedOption or null" });
      }
      answersById.set(String(answer.questionId), answer.selectedOption);
    }
    const questionIds = new Set(attempt.questions.map((question) => String(question.questionId)));
    if ([...answersById.keys()].some((id) => !questionIds.has(id))) return res.status(400).json({ message: "Answers include a question that does not belong to this attempt" });
    const timedOut = Date.now() >= attempt.expiresAt.getTime();
    if (!timedOut && attempt.questions.some((question) => !answersById.has(String(question.questionId)) || answersById.get(String(question.questionId)) === null)) {
      return res.status(400).json({ message: "Answer every question before submitting" });
    }
    for (const question of attempt.questions) {
      const selectedOption = answersById.has(String(question.questionId))
        ? answersById.get(String(question.questionId))
        : timedOut ? question.selectedOption : null;
      if (selectedOption !== null && (selectedOption < 0 || selectedOption >= question.options.length)) return res.status(400).json({ message: "An answer refers to an unavailable option" });
      question.selectedOption = selectedOption;
    }
    Object.assign(attempt, calculateScore(attempt.questions, attempt.totalQuestions));
    
    attempt.status = timedOut ? "timed-out" : "submitted";
    attempt.submittedAt = timedOut ? attempt.expiresAt : new Date();
    await attempt.save();
    res.json({ attempt: attemptView(attempt, { review: true }) });
  } catch (error) { next(error); }
});

export default router;
