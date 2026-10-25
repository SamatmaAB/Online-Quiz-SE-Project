import assert from "node:assert/strict";
import test from "node:test";
import {
  completePasswordReset,
  createRawResetToken,
  hashResetToken,
  issuePasswordResetToken,
  PASSWORD_RESET_TTL_MS
} from "./passwordReset.js";

class MemoryTokenStore {
  records = [];

  async deleteMany({ user }) {
    this.records = this.records.filter((record) => String(record.user) !== String(user));
  }

  async create(record) {
    this.records.push(record);
    return record;
  }

  async findOneAndDelete({ tokenHash, expiresAt }) {
    const index = this.records.findIndex((record) => record.tokenHash === tokenHash && record.expiresAt > expiresAt.$gt);
    if (index < 0) return null;
    return this.records.splice(index, 1)[0];
  }
}

function userQuery(user) {
  return { select: async () => user };
}

function makeUser() {
  return {
    _id: "user-1",
    email: "ada@example.com",
    passwordHash: "old-hash",
    tokenVersion: 0,
    async save() { this.saved = true; }
  };
}

test("reset request stores a hash and expires after fifteen minutes", async () => {
  const user = makeUser();
  const tokens = new MemoryTokenStore();
  const User = { findOne: () => userQuery(user) };
  const now = Date.parse("2026-10-25T12:00:00Z");

  const issued = await issuePasswordResetToken({ email: user.email, User, PasswordResetToken: tokens, now });

  assert.equal(issued.user, user);
  assert.equal(issued.token.length, 43);
  assert.notEqual(tokens.records[0].tokenHash, issued.token);
  assert.equal(tokens.records[0].tokenHash, hashResetToken(issued.token));
  assert.equal(tokens.records[0].expiresAt.getTime(), now + PASSWORD_RESET_TTL_MS);
});

test("unknown accounts produce no reset token", async () => {
  const tokens = new MemoryTokenStore();
  const User = { findOne: () => userQuery(null) };

  const issued = await issuePasswordResetToken({ email: "missing@example.com", User, PasswordResetToken: tokens });

  assert.equal(issued, null);
  assert.equal(tokens.records.length, 0);
});

test("expired reset tokens cannot be used", async () => {
  const user = makeUser();
  const tokens = new MemoryTokenStore();
  const raw = createRawResetToken();
  tokens.records.push({ user: user._id, tokenHash: hashResetToken(raw), expiresAt: new Date(1000) });

  const completed = await completePasswordReset({
    token: raw, password: "a-secure-password", User: { findById: () => userQuery(user) },
    PasswordResetToken: tokens, hashPassword: async () => "new-hash", now: 2000
  });

  assert.equal(completed, false);
  assert.equal(user.passwordHash, "old-hash");
});

test("invalid and already-used reset tokens cannot be used", async (context) => {
  for (const scenario of ["invalid", "already used"]) {
    await context.test(scenario, async () => {
      const user = makeUser();
      const tokens = new MemoryTokenStore();
      const usedToken = createRawResetToken();
      if (scenario === "already used") {
        tokens.records.push({ user: user._id, tokenHash: hashResetToken(usedToken), expiresAt: new Date(Date.now() + 60_000) });
        tokens.records = [];
      }
      const completed = await completePasswordReset({
        token: scenario === "invalid" ? "not-a-valid-reset-token" : usedToken,
        password: "a-secure-password", User: { findById: () => userQuery(user) },
        PasswordResetToken: tokens, hashPassword: async () => "new-hash"
      });
      assert.equal(completed, false);
      assert.equal(user.passwordHash, "old-hash");
    });
  }
});

test("a valid token is consumed, changes the password, and revokes older sessions", async () => {
  const user = makeUser();
  const tokens = new MemoryTokenStore();
  const raw = createRawResetToken();
  tokens.records.push({ user: user._id, tokenHash: hashResetToken(raw), expiresAt: new Date(Date.now() + 60_000) });
  let deletedRemaining = false;
  const deleteMany = tokens.deleteMany.bind(tokens);
  tokens.deleteMany = async (query) => {
    await deleteMany(query);
    deletedRemaining = true;
  };

  const completed = await completePasswordReset({
    token: raw, password: "a-secure-password", User: { findById: () => userQuery(user) },
    PasswordResetToken: tokens, hashPassword: async (password) => `bcrypt:${password}`
  });

  assert.equal(completed, true);
  assert.equal(user.passwordHash, "bcrypt:a-secure-password");
  assert.equal(user.tokenVersion, 1);
  assert.equal(user.saved, true);
  assert.equal(tokens.records.length, 0);
  assert.equal(deletedRemaining, true);
  assert.equal(await completePasswordReset({
    token: raw, password: "another-password", User: { findById: () => userQuery(user) },
    PasswordResetToken: tokens, hashPassword: async () => "should-not-be-used"
  }), false);
});
