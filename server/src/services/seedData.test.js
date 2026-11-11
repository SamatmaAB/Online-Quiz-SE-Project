import test from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_SEED_SUBJECT_KEYS } from "./seedData.js";

test("DEFAULT_SEED_SUBJECT_KEYS lists all 5 built-in engineering courses", () => {
  assert.deepEqual(DEFAULT_SEED_SUBJECT_KEYS, ["SE", "UIUX", "KOTLIN", "DBMS", "ML"]);
  assert.equal(Object.isFrozen(DEFAULT_SEED_SUBJECT_KEYS), true);
});
