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

import { looksUnsplit, splitTopicLine } from "./subjects.js";

test("splitTopicLine splits long comma/dash separated syllabus paragraphs but keeps bracketed lists whole", () => {
  const topics = splitTopicLine(
    "Introduction to Web Architecture and Web protocols (HTTP Request Response Formats, URLs), Basic Mark- ups & syntax, HTML elements & attributes, Web Form, HTML5"
  );
  assert.deepEqual(topics, [
    "Introduction to Web Architecture and Web protocols (HTTP Request Response Formats, URLs)",
    "Basic Mark- ups & syntax",
    "HTML elements & attributes",
    "Web Form",
    "HTML5"
  ]);
  assert.deepEqual(splitTopicLine("State Management – Complex components, Keys,Event Handling"), ["State Management", "Complex components", "Keys", "Event Handling"]);
  assert.deepEqual(splitTopicLine("Process concept, states"), ["Process concept, states"]);
});

test("parseSyllabus turns a pasted unit paragraph into several selectable topics", () => {
  const units = parseSyllabus("Unit 1: HTML, CSS and Client-Side Scripting\nWeb Form, HTML5, CSS3 selectors and the box model, JavaScript DOM events and validation\nUnit 2: ReactJS\nComponents, Props, State");
  assert.equal(units.length, 2);
  assert.equal(units[0].name, "Unit 1: HTML, CSS and Client-Side Scripting");
  assert.equal(units[0].topics.length, 4);
  assert.equal(units[1].topics.length, 3);
});

test("looksUnsplit detects units saved as one giant topic by the old parser", () => {
  const giant = "x".repeat(90);
  assert.equal(looksUnsplit([{ topics: [{ name: giant, description: "From the syllabus you added." }] }]), true);
  assert.equal(looksUnsplit([{ topics: [{ name: "Short", description: "From the syllabus you added." }] }]), false);
  assert.equal(looksUnsplit(null), false);
});

test("parseSyllabus splits 'Unit - 1' and 'Unit - 2' headings and separates period/colon glued topics", () => {
  const dsa = [
    "Unit - 1",
    "Review of C, Static and Dynamic Memory Allocation. Linked List: Doubly Linked List, Circular Linked List, Single and Double, Multilist: Introduction to sparse matrix (structure). Skip list Case study: Dictionary implementation using skip list Stacks: Basic structure of a Stack",
    "Unit - 2",
    "Queues & Dequeue: Basic Structure of a Simple Queue, Circular Queue, Priority Queue"
  ].join("\n");
  const units = parseSyllabus(dsa);
  assert.equal(units.length, 2);
  assert.equal(units[0].topics.some((t) => /^unit/i.test(t.name)), false);
  assert.equal(units[0].topics.some((t) => t.name === "Static and Dynamic Memory Allocation"), true);
  assert.equal(units[0].topics.some((t) => t.name === "Linked List: Doubly Linked List"), true);
  assert.equal(units[0].topics.some((t) => t.name === "Skip list"), true);
  assert.equal(units[0].topics.some((t) => t.name === "Stacks: Basic structure of a Stack"), true);
  assert.equal(units[1].topics.length, 3);
  assert.equal(looksUnsplit([{ topics: [{ name: "Unit - 1", description: "" }] }]), true);
});
