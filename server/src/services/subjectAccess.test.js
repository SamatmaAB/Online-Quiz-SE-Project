import test from "node:test";
import assert from "node:assert/strict";
import { CUSTOM_KEY_PATTERN, customView, isBuiltInSubjectKey } from "./subjectAccess.js";

test("isBuiltInSubjectKey and CUSTOM_KEY_PATTERN distinguish built-in vs custom subjects", () => {
  assert.equal(isBuiltInSubjectKey("SE"), true);
  assert.equal(isBuiltInSubjectKey("DBMS"), true);
  assert.equal(isBuiltInSubjectKey("UNKNOWN"), false);
  assert.equal(CUSTOM_KEY_PATTERN.test("C65f0123456789abcdef01234"), true);
  assert.equal(CUSTOM_KEY_PATTERN.test("SE"), false);
});

test("customView shapes custom subject documents with isCustom flag", () => {
  const view = customView({
    key: "C65f0123456789abcdef01234",
    name: "Cloud Computing",
    code: "CS401",
    courseType: "Elective",
    units: [{ name: "Unit 1", topics: [] }]
  });
  assert.equal(view.isCustom, true);
  assert.equal(view.code, "CS401");
});
