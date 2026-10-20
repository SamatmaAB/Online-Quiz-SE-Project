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

export default router;
