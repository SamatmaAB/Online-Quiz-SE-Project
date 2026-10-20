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

async function finalizeExpired(attempt) {
  if (attempt.status !== "in-progress" || attempt.expiresAt.getTime() > Date.now()) return attempt;
  attempt.score = attempt.questions.reduce((total, question) => total + (question.selectedOption === question.correctOption ? 1 : 0), 0);
  attempt.percentage = attempt.totalQuestions ? Math.round((attempt.score / attempt.totalQuestions) * 10000) / 100 : 0;
  attempt.status = "timed-out";
  attempt.submittedAt = attempt.expiresAt;
  await attempt.save();
  return attempt;
}

router.post("/", requireAuth, async (req, res, next) => {
  try {
    const { quizId } = req.body || {};
    if (!mongoose.isValidObjectId(quizId)) return res.status(400).json({ message: "A valid quizId is required" });
    const quiz = await Quiz.findOne({ _id: quizId, isPublished: true });
    if (!quiz) return res.status(404).json({ message: "Quiz not found" });
    if (!quiz.questions.length) return res.status(409).json({ message: "This quiz has no questions yet" });
    const startedAt = new Date();
    const expiresAt = new Date(startedAt.getTime() + quiz.durationMinutes * 60_000);
    const attempt = await Attempt.create({
      user: req.user.id,
      quiz: quiz.id,
      quizTitle: quiz.title,
      category: quiz.category,
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

export default router;
