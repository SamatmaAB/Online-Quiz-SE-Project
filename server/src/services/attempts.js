import Attempt from "../models/Attempt.js";

export function attemptView(attempt, { review = false, includeUser = false } = {}) {
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

export function calculateScore(questions, totalQuestions) {
  const score = questions.reduce((total, question) => total + (question.selectedOption === question.correctOption ? 1 : 0), 0);
  const percentage = totalQuestions ? Math.round((score / totalQuestions) * 10000) / 100 : 0;
  return { score, percentage };
}

export async function finalizeExpiredAttempts(attempts, now = new Date()) {
  const expired = attempts.filter((attempt) => attempt.status === "in-progress" && attempt.expiresAt <= now);
  if (!expired.length) return;

  const updates = expired.map((attempt) => ({
    attempt,
    result: calculateScore(attempt.questions, attempt.totalQuestions)
  }));
  const write = await Attempt.bulkWrite(updates.map(({ attempt, result }) => ({
    updateOne: {
      filter: { _id: attempt._id, status: "in-progress", expiresAt: { $lte: now } },
      update: { $set: { ...result, status: "timed-out", submittedAt: attempt.expiresAt } }
    }
  })), { ordered: false });

  for (const { attempt, result } of updates) {
    attempt.set({ ...result, status: "timed-out", submittedAt: attempt.expiresAt });
  }

  if (write.matchedCount !== updates.length) {
    const refreshed = await Attempt.find({ _id: { $in: expired.map((attempt) => attempt._id) } });
    const byId = new Map(refreshed.map((attempt) => [String(attempt._id), attempt]));
    for (const attempt of expired) {
      const latest = byId.get(String(attempt._id));
      if (latest) attempt.set({
        status: latest.status,
        score: latest.score,
        percentage: latest.percentage,
        submittedAt: latest.submittedAt,
        questions: latest.questions
      });
    }
  }
}
