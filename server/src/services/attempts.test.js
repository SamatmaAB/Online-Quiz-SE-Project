import test from "node:test";
import assert from "node:assert/strict";
import { attemptView, calculateScore } from "./attempts.js";

test("calculateScore computes score and two-decimal percentage accurately", () => {
  const questions = [
    { selectedOption: 1, correctOption: 1 },
    { selectedOption: 0, correctOption: 2 },
    { selectedOption: 3, correctOption: 3 }
  ];
  assert.deepEqual(calculateScore(questions, 3), { score: 2, percentage: 66.67 });
  assert.deepEqual(calculateScore([], 0), { score: 0, percentage: 0 });
});

test("attemptView hides correctOption while in-progress and reveals breakdown on review", () => {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 300_000);
  const sampleAttempt = {
    id: "att1",
    quiz: "q1",
    quizTitle: "SE Unit 1",
    category: "Software Engineering",
    difficulty: "easy",
    durationMinutes: 10,
    startedAt: now,
    expiresAt,
    submittedAt: null,
    status: "in-progress",
    score: 0,
    totalQuestions: 2,
    percentage: 0,
    user: { id: "u1", name: "Kedar", email: "kedar@example.com" },
    questions: [
      { questionId: "qn1", prompt: "What is Agile?", options: ["Iterative", "Waterfall"], selectedOption: 0, correctOption: 0 },
      { questionId: "qn2", prompt: "What is Scrum?", options: ["Framework", "Compiler"], selectedOption: 1, correctOption: 0 }
    ],
    createdAt: now
  };

  const activeView = attemptView(sampleAttempt, { review: false, includeUser: false });
  assert.equal("correctOption" in activeView.questions[0], false);
  assert.equal("user" in activeView, false);
  assert.equal(activeView.remainingSeconds > 0, true);

  const finishedAttempt = { ...sampleAttempt, status: "submitted", submittedAt: now, score: 1, percentage: 50 };
  const reviewView = attemptView(finishedAttempt, { review: true, includeUser: true });
  assert.equal(reviewView.questions[0].correctOption, 0);
  assert.equal(reviewView.questions[0].isCorrect, true);
  assert.equal(reviewView.questions[1].isCorrect, false);
  assert.equal(reviewView.user.name, "Kedar");
});

