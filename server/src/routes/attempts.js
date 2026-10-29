import { Router } from "express";
import mongoose from "mongoose";
import Quiz from "../models/Quiz.js";
import QuizAttempt from "../models/QuizAttempt.js";
import { requireAuth } from "../middleware/authMiddleware.js";

const router = Router();

router.use(requireAuth);

// Submit answers and calculate the score on the server
router.post("/:id/submit", async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: "Invalid attempt ID" });
    }

    const attempt = await QuizAttempt.findOne({
      _id: req.params.id,
      user: req.userId
    });

    if (!attempt) {
      return res.status(404).json({ message: "Attempt not found" });
    }

    if (attempt.status !== "in-progress") {
      return res.status(409).json({ message: "This attempt has already been completed" });
    }

    const now = new Date();
    const expired = now > attempt.deadline;
    const quiz = await Quiz.findById(attempt.quiz);

    if (!quiz) {
      return res.status(404).json({ message: "Quiz not found" });
    }

    const submittedAnswers = Array.isArray(req.body.answers)
      ? req.body.answers
      : [];

    const validQuestionIds = new Set(
      quiz.questions.map((question) => question.id)
    );
    const seen = new Set();
    const normalizedAnswers = [];

    for (const answer of submittedAnswers) {
      if (
        !answer ||
        !mongoose.isValidObjectId(answer.questionId) ||
        !validQuestionIds.has(answer.questionId) ||
        seen.has(answer.questionId) ||
        !Number.isInteger(answer.selectedOption) ||
        answer.selectedOption < 0 ||
        answer.selectedOption > 3
      ) {
        return res.status(400).json({ message: "One or more submitted answers are invalid" });
      }

      seen.add(answer.questionId);
      normalizedAnswers.push({
        questionId: answer.questionId,
        selectedOption: answer.selectedOption
      });
    }

    let score = 0;

    if (!expired) {
      for (const answer of normalizedAnswers) {
        const question = quiz.questions.id(answer.questionId);
        if (question && question.correctOption === answer.selectedOption) {
          score += question.points;
        }
      }
    }

    attempt.answers = expired ? [] : normalizedAnswers;
    attempt.score = score;
    attempt.submittedAt = now;
    attempt.status = expired ? "expired" : "submitted";
    await attempt.save();

    return res.json({
      message: expired ? "Time expired. The attempt has been recorded." : "Quiz submitted successfully",
      result: {
        attemptId: attempt.id,
        score: attempt.score,
        totalPoints: attempt.totalPoints,
        totalQuestions: attempt.totalQuestions,
        percentage: Math.round((attempt.score / attempt.totalPoints) * 100),
        status: attempt.status,
        submittedAt: attempt.submittedAt
      }
    });
  } catch (error) {
    next(error);
  }
});

// Show the logged-in user's previous attempts
router.get("/mine", async (req, res, next) => {
  try {
    const attempts = await QuizAttempt.find({ user: req.userId })
      .populate("quiz", "title courseCode")
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();

    res.json({
      attempts: attempts.map((attempt) => ({
        id: attempt._id,
        quizTitle: attempt.quiz?.title || "Quiz no longer available",
        courseCode: attempt.quiz?.courseCode || "",
        score: attempt.score,
        totalPoints: attempt.totalPoints,
        totalQuestions: attempt.totalQuestions,
        percentage: attempt.totalPoints
          ? Math.round((attempt.score / attempt.totalPoints) * 100)
          : 0,
        status: attempt.status,
        startedAt: attempt.startedAt,
        submittedAt: attempt.submittedAt
      }))
    });
  } catch (error) {
    next(error);
  }
});

// Show one result, including correct answers after completion
router.get("/:id", async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: "Invalid attempt ID" });
    }

    const attempt = await QuizAttempt.findOne({
      _id: req.params.id,
      user: req.userId
    }).populate("quiz", "title questions");

    if (!attempt) {
      return res.status(404).json({ message: "Attempt not found" });
    }

    if (attempt.status === "in-progress") {
      return res.status(409).json({ message: "Submit the quiz before viewing its result" });
    }

    const resultQuestions = (attempt.quiz?.questions || []).map((question) => {
      const answer = attempt.answers.find(
        (item) => item.questionId.toString() === question.id
      );

      return {
        questionId: question.id,
        prompt: question.prompt,
        options: question.options,
        selectedOption: answer?.selectedOption ?? null,
        correctOption: question.correctOption,
        isCorrect: answer?.selectedOption === question.correctOption
      };
    });

    res.json({
      result: {
        attemptId: attempt.id,
        quizTitle: attempt.quiz?.title || "Quiz",
        score: attempt.score,
        totalPoints: attempt.totalPoints,
        totalQuestions: attempt.totalQuestions,
        percentage: Math.round((attempt.score / attempt.totalPoints) * 100),
        status: attempt.status,
        startedAt: attempt.startedAt,
        deadline: attempt.deadline,
        submittedAt: attempt.submittedAt,
        questions: resultQuestions
      }
    });
  } catch (error) {
    next(error);
  }
});

export default router;
