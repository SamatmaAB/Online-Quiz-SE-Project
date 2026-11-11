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
