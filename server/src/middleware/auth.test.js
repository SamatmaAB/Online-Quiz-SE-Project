import test from "node:test";
import assert from "node:assert/strict";
import { extractBearerToken, requireAdmin } from "./auth.js";

test("extractBearerToken parses Bearer authorization headers", () => {
  assert.equal(extractBearerToken("Bearer abc.def.ghi"), "abc.def.ghi");
  assert.equal(extractBearerToken("Basic 12345"), null);
  assert.equal(extractBearerToken(""), null);
});

test("requireAdmin permits admin role and returns 403 for student role", () => {
  let calledNext = false;
  requireAdmin({ user: { role: "admin" } }, {}, () => {
    calledNext = true;
  });
  assert.equal(calledNext, true);

  let statusCode = null;
  const mockRes = {
    status(code) {
      statusCode = code;
      return { json() {} };
    }
  };
  requireAdmin({ user: { role: "user" } }, mockRes, () => {});
  assert.equal(statusCode, 403);
});
