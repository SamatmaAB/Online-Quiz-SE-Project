import { Router } from "express";
import { createHash } from "node:crypto";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import rateLimit from "express-rate-limit";
import User from "../models/User.js";
import RevokedToken from "../models/RevokedToken.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 30, standardHeaders: true, legacyHeaders: false });

function publicUser(user) {
  return { id: user.id, name: user.name, email: user.email, role: user.role, createdAt: user.createdAt };
}
function issueToken(user) {
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) throw new Error("JWT_SECRET must be set to a random value of at least 32 characters");
  return jwt.sign({ sub: user.id, ver: user.tokenVersion || 0 }, process.env.JWT_SECRET, { expiresIn: "2h" });
}

router.post("/register", authLimiter, async (req, res, next) => {
  try {
    const name = String(req.body.name || "").trim();
    const email = String(req.body.email || "").trim().toLowerCase();
    const password = String(req.body.password || "");
    const rawRole = String(req.body.role || "student").trim().toLowerCase();
    const role = rawRole === "teacher" || rawRole === "admin" ? "admin" : "user";
    if (name.length < 2 || name.length > 80) return res.status(400).json({ message: "Name must be 2–80 characters" });
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ message: "Enter a valid email address" });
    if (password.length < 8 || password.length > 72) return res.status(400).json({ message: "Password must be 8–72 characters" });
    if (await User.exists({ email })) return res.status(409).json({ message: "An account with this email already exists" });
    const passwordHash = await bcrypt.hash(password, 12);
    const user = await User.create({ name, email, passwordHash, role });
    return res.status(201).json({ token: issueToken(user), user: publicUser(user) });
  } catch (error) {
    if (error.code === 11000) return res.status(409).json({ message: "An account with this email already exists" });
    next(error);
  }
});

router.post("/login", authLimiter, async (req, res, next) => {
  try {
    const email = String(req.body.email || "").trim().toLowerCase();
    const password = String(req.body.password || "");
    const user = await User.findOne({ email }).select("+passwordHash +tokenVersion");
    if (!user || !(await bcrypt.compare(password, user.passwordHash))) return res.status(401).json({ message: "Invalid email or password" });
    return res.json({ token: issueToken(user), user: publicUser(user) });
  } catch (error) { next(error); }
});

router.post("/logout", async (req, res) => {
  const authorization = req.get("authorization") || "";
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  if (!match) return res.status(401).json({ message: "Authentication required" });
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
    return res.status(500).json({ message: "Authentication is not configured" });
  }
  try {
    const token = match[1];
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const tokenHash = createHash("sha256").update(token).digest("hex");
    await RevokedToken.updateOne(
      { tokenHash },
      { $setOnInsert: { tokenHash, expiresAt: new Date(payload.exp * 1000) } },
      { upsert: true }
    );
    return res.json({ message: "Logged out successfully" });
  } catch {
    return res.status(401).json({ message: "Invalid or expired token" });
  }
});

router.get("/me", requireAuth, async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ message: "Account not found" });
    return res.json({ user: publicUser(user) });
  } catch (error) { next(error); }
});

router.patch("/profile", requireAuth, async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id).select("+tokenVersion");
    if (!user) return res.status(404).json({ message: "Account not found" });
    if (req.body?.name !== undefined) {
      const name = String(req.body.name || "").trim();
      if (name.length < 2 || name.length > 80) return res.status(400).json({ message: "Name must be 2–80 characters" });
      user.name = name;
    }
    if (req.body?.email !== undefined) {
      const email = String(req.body.email || "").trim().toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ message: "Enter a valid email address" });
      if (email !== user.email && (await User.exists({ email }))) {
        return res.status(409).json({ message: "An account with this email already exists" });
      }
      user.email = email;
    }
    if (req.body?.role !== undefined) {
      const rawRole = String(req.body.role || "").trim().toLowerCase();
      user.role = rawRole === "teacher" || rawRole === "admin" ? "admin" : "user";
    }
    await user.save();
    return res.json({ user: publicUser(user), token: issueToken(user) });
  } catch (error) { next(error); }
});

router.post("/change-password", requireAuth, async (req, res, next) => {
  try {
    const currentPassword = String(req.body?.currentPassword || "");
    const newPassword = String(req.body?.newPassword || "");
    if (newPassword.length < 8 || newPassword.length > 72) {
      return res.status(400).json({ message: "New password must be 8–72 characters" });
    }
    const user = await User.findById(req.user.id).select("+passwordHash +tokenVersion");
    if (!user || !(await bcrypt.compare(currentPassword, user.passwordHash))) {
      return res.status(401).json({ message: "Current password is incorrect" });
    }
    user.passwordHash = await bcrypt.hash(newPassword, 12);
    user.tokenVersion = (user.tokenVersion || 0) + 1;
    await user.save();
    return res.json({ message: "Password updated successfully", token: issueToken(user), user: publicUser(user) });
  } catch (error) { next(error); }
});

export default router;
