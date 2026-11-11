import test from "node:test";
import assert from "node:assert/strict";
import { chintsFallbackQuestions, extractJsonArray, normalizeGenerated } from "./ai.js";

test("extractJsonArray handles fenced and prose-wrapped replies", () => {
  assert.equal(extractJsonArray('```json\n[{"a":1}]\n```').length, 1);
  assert.equal(extractJsonArray('Here you go: [{"a":1},{"a":2}] enjoy').length, 2);
  assert.equal(extractJsonArray('{"questions":[{"a":1}]}').length, 1);
  assert.equal(extractJsonArray("no json here"), null);
  assert.equal(extractJsonArray("[broken json]"), null);
});

test("normalizeGenerated accepts both option shapes and drops malformed items", () => {
  const questions = normalizeGenerated([
    { prompt: "Two plus two?", options: ["3", "4", "5", "6"], correctOption: 1 },
    { question_text: "Colour of the sky?", option_a: "Green", option_b: "Blue", option_c: "Red", option_d: "Pink", correct_option: "b" },
    { question: "Numeric string index?", options: ["A", "B"], correct_option: "0" },
    { prompt: "Bad index", options: ["x", "y"], correctOption: 7 },
    null
  ]);
  assert.equal(questions.length, 3);
  assert.equal(questions[1].correctOption, 1);
  assert.deepEqual(questions[1].options, ["Green", "Blue", "Red", "Pink"]);
});

test("chintsFallbackQuestions drafts valid MCQs from syllabus topics when offline", () => {
  const drafted = chintsFallbackQuestions(
    [{ name: "Agile methodology" }, { name: "Custom Topic", description: "A custom definition." }],
    5,
    "Software Engineering"
  );
  assert.equal(drafted.length, 5);
  for (const q of drafted) {
    assert.equal(q.options.length, 4);
    assert.equal(q.correctOption >= 0 && q.correctOption < 4, true);
  }
});

import { clampQuestionCount, evaluateMathExpression, explainWrongQuestions } from "./ai.js";

test("clampQuestionCount bounds requested question counts between min and max", () => {
  assert.equal(clampQuestionCount(10), 10);
  assert.equal(clampQuestionCount(0), 1);
  assert.equal(clampQuestionCount(99), 25);
  assert.equal(clampQuestionCount("invalid", 1, 25, 5), 5);
});

test("evaluateMathExpression computes arithmetic, percentages, natural language math, and scientific functions safely", () => {
  assert.equal(evaluateMathExpression("24 * 15 / 4")?.result, 90);
  assert.equal(evaluateMathExpression("what is 18% of 250?")?.result, 45);
  assert.equal(evaluateMathExpression("sqrt(144) + 2^8")?.result, 268);
  assert.equal(evaluateMathExpression("whats the square root of 121")?.result, 11);
  assert.equal(evaluateMathExpression("what is the cube root of 27?")?.result, 3);
  assert.equal(evaluateMathExpression("sin(30) + cos(60)")?.result, 1);
  assert.equal(evaluateMathExpression("tan 45")?.result, 1);
  assert.equal(evaluateMathExpression("5! + 10C3")?.result, 240);
  assert.equal(evaluateMathExpression("log2(1024) + log10(1000)")?.result, 13);
  assert.equal(evaluateMathExpression("gcd of 48 and 180")?.result, 12);
  assert.equal(evaluateMathExpression("lcm of 12 and 18")?.result, 36);
  assert.equal(evaluateMathExpression("bro tell me the answer to question 2"), null);
});

test("explainWrongQuestions explains why the chosen option was wrong and why the right option is correct", () => {
  const explanation = explainWrongQuestions([
    {
      prompt: "Which structure follows LIFO?",
      options: ["Queue", "Stack", "Array", "Graph"],
      selectedOption: 0,
      correctOption: 1,
      isCorrect: false
    }
  ]);
  assert.ok(explanation.includes("Option A — \"Queue\""));
  assert.ok(explanation.includes("Option B — \"Stack\""));
});
