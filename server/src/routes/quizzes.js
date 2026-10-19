import { Router } from "express";
import mongoose from "mongoose";
import Quiz from "../models/Quiz.js";
import { requireAdmin, requireAuth } from "../middleware/auth.js";

const router = Router();
const difficulties = new Set(["easy", "medium", "hard"]);

function publicQuestion(question) {
  return { id: question.id, prompt: question.prompt, options: question.options };
}

function adminQuestion(question) {
  return { ...publicQuestion(question), correctOption: question.correctOption };
}

function quizSummary(quiz) {
  return {
    id: quiz.id, title: quiz.title, description: quiz.description, category: quiz.category,
    difficulty: quiz.difficulty, durationMinutes: quiz.durationMinutes,
    questionCount: quiz.questions.length, createdAt: quiz.createdAt
  };
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

router.get("/", async (req, res, next) => {
  try {
    const filter = { isPublished: true };
    if (typeof req.query.category === "string" && req.query.category.trim()) filter.category = new RegExp(`^${req.query.category.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i");
    if (typeof req.query.difficulty === "string") {
      const difficulty = req.query.difficulty.toLowerCase();
      if (!difficulties.has(difficulty)) return res.status(400).json({ message: "Difficulty must be easy, medium, or hard" });
      filter.difficulty = difficulty;
    }
    const quizzes = await Quiz.find(filter).sort({ createdAt: -1 });
    res.json({ quizzes: quizzes.map(quizSummary) });
  } catch (error) { next(error); }
});

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
router.post("/", requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const quizInput = parseQuizInput(req.body);
    if (!quizInput) return res.status(400).json({ message: "Provide a valid title, category, difficulty, duration, publication status, and question list" });
    const quiz = await Quiz.create({ ...quizInput, createdBy: req.user.id });
    res.status(201).json({ quiz: quizSummary(quiz), questions: quiz.questions.map(adminQuestion) });
  } catch (error) { next(error); }
});
router.get("/:quizId", async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.quizId)) return res.status(400).json({ message: "Invalid quiz identifier" });
    const quiz = await Quiz.findOne({ _id: req.params.quizId, isPublished: true });
    if (!quiz) return res.status(404).json({ message: "Quiz not found" });
    res.json({ quiz: quizSummary(quiz), questions: quiz.questions.map(publicQuestion) });
  } catch (error) { next(error); }
});

export default router;
