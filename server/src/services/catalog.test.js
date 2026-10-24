import test from "node:test";
import assert from "node:assert/strict";
import { normalizeSearch, parsePagination, toPublicQuiz } from "./catalog.js";

test("pagination defaults to page 1 and 12 items", () => {
  assert.deepEqual(parsePagination({}), { page: 1, limit: 12, skip: 0 });
});

test("pagination rejects invalid and excessive values", () => {
  assert.match(parsePagination({ page: "0" }).error, /page/);
  assert.match(parsePagination({ limit: "51" }).error, /limit/);
  assert.match(parsePagination({ limit: "nope" }).error, /limit/);
});

test("search input is trimmed, escaped, and bounded", () => {
  assert.equal(normalizeSearch("  hello  "), "hello");
  assert.equal(normalizeSearch("a.b"), "a\\.b");
  assert.equal(normalizeSearch("x".repeat(120)).length, 100);
});

test("public quiz serializer excludes internal fields", () => {
  const result = toPublicQuiz({
    _id: "abc", title: "Intro", description: "", category: { _id: "cat1", name: "Science", slug: "science" },
    durationMinutes: 10, totalQuestions: 5, difficulty: "beginner", isPublished: true, secret: "not public"
  });
  assert.equal(result.id, "abc");
  assert.equal(result.category.slug, "science");
  assert.equal("secret" in result, false);
  assert.equal("isPublished" in result, false);
});
