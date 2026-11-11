import test from "node:test";
import assert from "node:assert/strict";
import { normalizeSearch, parsePagination } from "./catalog.js";

test("parsePagination validates page and limit bounds", () => {
  assert.deepEqual(parsePagination({ page: "2", limit: "10" }), { page: 2, limit: 10, skip: 10 });
  assert.equal( Boolean(parsePagination({ page: "0" }).error), true);
  assert.equal( Boolean(parsePagination({ limit: "99" }).error), true);
});

test("normalizeSearch escapes regex metacharacters and trims whitespace", () => {
  assert.equal(normalizeSearch("  C++ (OOP) "), "C\\+\\+ \\(OOP\\)");
  assert.equal(normalizeSearch(null), "");
});

import { summarizeCatalogQuizzes, toPublicQuiz } from "./catalog.js";

test("toPublicQuiz formats quiz document fields and summarizeCatalogQuizzes counts sources", () => {
  const pub = toPublicQuiz({
    _id: "q100",
    title: "SE Unit 1",
    category: { _id: "c1", name: "SE", slug: "se" },
    durationMinutes: 15,
    totalQuestions: 5,
    difficulty: "medium",
    subjectKey: "SE",
    unitIndex: 0,
    source: "chints"
  });
  assert.equal(pub.id, "q100");
  assert.equal(pub.source, "chints");
  assert.deepEqual(summarizeCatalogQuizzes([pub, { source: "manual" }]), {
    total: 2,
    chintsCount: 1,
    manualCount: 1
  });
});
