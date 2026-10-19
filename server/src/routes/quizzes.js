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

router.get("/:quizId", async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.quizId)) return res.status(400).json({ message: "Invalid quiz identifier" });
    const quiz = await Quiz.findOne({ _id: req.params.quizId, isPublished: true });
    if (!quiz) return res.status(404).json({ message: "Quiz not found" });
    res.json({ quiz: quizSummary(quiz), questions: quiz.questions.map(publicQuestion) });
  } catch (error) { next(error); }
});

export default router;
