import test from "node:test";
import assert from "node:assert/strict";
import { normalizeEmail, validateLogin, validateRegistration } from "./validation.js";
test("normalizes email", () => assert.equal(normalizeEmail(" Student@Example.COM "), "student@example.com"));
test("accepts valid registration", () => assert.equal(validateRegistration({name:"Ada Lovelace",email:"ADA@example.com",password:"long-pass-123"}).valid, true));
test("rejects invalid registration fields", () => { const r=validateRegistration({name:"A",email:"bad",password:"short"}); assert.equal(r.valid,false); assert.ok(r.errors.name); assert.ok(r.errors.email); assert.ok(r.errors.password); });
test("rejects passwords over 72 characters", () => assert.equal(validateRegistration({name:"Test User",email:"test@example.com",password:"x".repeat(73)}).valid,false));
test("validates login input", () => { assert.equal(validateLogin({email:"test@example.com",password:"pw"}).valid,true); assert.equal(validateLogin({email:"bad",password:""}).valid,false); });
