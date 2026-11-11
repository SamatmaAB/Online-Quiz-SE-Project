import test from "node:test";
import assert from "node:assert/strict";
import { difficulties, MAX_QUESTIONS_PER_QUIZ, parseQuestion, slugify } from "./questions.js";

test("parseQuestion validates well-formed multiple-choice questions", () => {
  const valid = parseQuestion({
    prompt: "  What is 2 + 2? ",
    options: [" 3 ", " 4 ", " 5 ", " 6 "],
    correctOption: 1
  });
  assert.deepEqual(valid, {
    prompt: "What is 2 + 2?",
    options: ["3", "4", "5", "6"],
    correctOption: 1
  });
  assert.equal(MAX_QUESTIONS_PER_QUIZ, 100);
  assert.equal(difficulties.has("easy"), true);
});

test("parseQuestion rejects invalid inputs, out-of-range indices, and bad option counts", () => {
  assert.equal(parseQuestion(null), null);
  assert.equal(parseQuestion([]), null);
  assert.equal(parseQuestion({ prompt: "", options: ["a", "b"], correctOption: 0 }), null);
  assert.equal(parseQuestion({ prompt: "Q?", options: ["only-one"], correctOption: 0 }), null);
  assert.equal(parseQuestion({ prompt: "Q?", options: ["1", "2", "3", "4", "5", "6", "7"], correctOption: 0 }), null);
  assert.equal(parseQuestion({ prompt: "Q?", options: ["a", ""], correctOption: 0 }), null);
  assert.equal(parseQuestion({ prompt: "Q?", options: ["a", "b"], correctOption: -1 }), null);
  assert.equal(parseQuestion({ prompt: "Q?", options: ["a", "b"], correctOption: 2 }), null);
  assert.equal(parseQuestion({ prompt: "Q?", options: ["a", "b"], correctOption: "0" }), null);
});

test("slugify normalizes category names into URL-safe slugs", () => {
  assert.equal(slugify("  Software Engineering & UI/UX! "), "software-engineering-ui-ux");
  assert.equal(slugify(""), "");
  assert.equal(slugify(null), "");
});


import { normalizeDifficulty } from "./questions.js";

test("normalizeDifficulty validates supported difficulty levels and falls back safely", () => {
  assert.equal(normalizeDifficulty("EASY"), "easy");
  assert.equal(normalizeDifficulty(" Hard "), "hard");
  assert.equal(normalizeDifficulty("unknown", "medium"), "medium");
  assert.equal(normalizeDifficulty(null), "medium");
});
