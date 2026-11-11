import test from "node:test";
import assert from "node:assert/strict";
import { parseSyllabus } from "./subjects.js";

test("parseSyllabus groups topic lines under numbered units", () => {
  const units = parseSyllabus("Unit 1: Foundations\n- Requirements\n2. Design\n\nUnit 2 - Delivery\nTesting");
  assert.deepEqual(units.map((unit) => unit.name), ["Unit 1: Foundations", "Unit 2: Delivery"]);
  assert.deepEqual(units[0].topics.map((topic) => topic.name), ["Requirements", "Design"]);
  assert.equal(units[1].topics[0].name, "Testing");
});

test("parseSyllabus keeps unnumbered text in a Full Syllabus unit", () => {
  const units = parseSyllabus("Introduction\nReading list");
  assert.equal(units.length, 1);
  assert.equal(units[0].name, "Full Syllabus");
  assert.deepEqual(units[0].topics.map((topic) => topic.name), ["Introduction", "Reading list"]);
});

test("parseSyllabus ignores blank lines and applies safe unit and topic limits", () => {
  const topics = Array.from({ length: 35 }, (_, index) => `Topic ${index + 1}`).join("\n");
  const syllabus = Array.from({ length: 42 }, (_, index) => `Unit ${index + 1}: Course\n${topics}`).join("\n");
  const units = parseSyllabus(syllabus);
  assert.equal(units.length, 40);
  assert.equal(units[0].topics.length, 30);
});

import { countSyllabusTopics } from "./subjects.js";

test("countSyllabusTopics sums topic counts across parsed syllabus units", () => {
  const units = parseSyllabus("Unit 1: Intro\n- A\n- B\nUnit 2: Next\n- C");
  assert.equal(countSyllabusTopics(units), 3);
  assert.equal(countSyllabusTopics([]), 0);
  assert.equal(countSyllabusTopics(null), 0);
});
