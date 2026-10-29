
import { Router } from "express";
import mongoose from "mongoose";
import Quiz from "../models/Quiz.js";
import QuizAttempt from "../models/QuizAttempt.js";
import { requireAuth } from "../middleware/authMiddleware.js";

const router = Router();

// List all published quizzes
router.get("/", async (_req, res, next) => {
  try {
    const quizzes = await Quiz.find({ isPublished: true })
      .populate("category", "name")
      .select("title courseCode description category durationMinutes questions")
      .sort({ title: 1 })
      .lean();

    res.json({
      quizzes: quizzes.map((quiz) => ({
        id: quiz._id,
        title: quiz.title,
        courseCode: quiz.courseCode,
        description: quiz.description,
        category: quiz.category?.name || "Uncategorized",
        durationMinutes: quiz.durationMinutes,
        questionCount: quiz.questions.length
      }))
    });
  } catch (error) {
    next(error);
  }
});

// Get quiz details and questions without exposing correct answers
router.get("/:id", async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: "Invalid quiz ID" });
    }

    const quiz = await Quiz.findOne({
      _id: req.params.id,
      isPublished: true
    }).populate("category", "name");

    if (!quiz) {
      return res.status(404).json({ message: "Quiz not found" });
    }

    res.json({
      quiz: {
        id: quiz.id,
        title: quiz.title,
        courseCode: quiz.courseCode,
        description: quiz.description,
        category: quiz.category?.name || "Uncategorized",
        durationMinutes: quiz.durationMinutes,
        questions: quiz.questions.map((question) => ({
          id: question.id,
          prompt: question.prompt,
          options: question.options
        }))
      }
    });
  } catch (error) {
    next(error);
  }
});

// Start a timed quiz attempt (login required)
router.post("/:id/attempts", requireAuth, async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: "Invalid quiz ID" });
    }

    const quiz = await Quiz.findOne({
      _id: req.params.id,
      isPublished: true
    });

    if (!quiz) {
      return res.status(404).json({ message: "Quiz not found" });
    }

    if (!quiz.questions.length) {
      return res.status(409).json({
        message: "This quiz has no questions yet"
      });
    }

    const startedAt = new Date();
    const deadline = new Date(
      startedAt.getTime() + quiz.durationMinutes * 60 * 1000
    );

    const totalPoints = quiz.questions.reduce(
      (sum, question) => sum + question.points,
      0
    );

    const attempt = await QuizAttempt.create({
      user: req.userId,
      quiz: quiz._id,
      startedAt,
      deadline,
      totalPoints,
      totalQuestions: quiz.questions.length
    });

    return res.status(201).json({
      message: "Quiz started",
      attempt: {
        id: attempt.id,
        startedAt: attempt.startedAt,
        deadline: attempt.deadline,
        totalQuestions: attempt.totalQuestions
      }
    });
  } catch (error) {
    next(error);
  }
});

export default router;
