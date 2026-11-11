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
