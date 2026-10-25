import { Router } from "express";
import bcrypt from "bcryptjs";
import rateLimit from "express-rate-limit";
import User from "../models/User.js";
import PasswordResetToken from "../models/PasswordResetToken.js";
import {
  completePasswordReset,
  createPasswordResetTransport,
  issuePasswordResetToken,
  sendPasswordResetEmail
} from "../services/passwordReset.js";

const router = Router();
const resetLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 5, standardHeaders: true, legacyHeaders: false });
const genericResponse = { message: "If an account exists for that email, a password reset link will be sent shortly." };

router.post("/request", resetLimiter, async (req, res, next) => {
  try {
    const email = String(req.body?.email || "").trim().toLowerCase();
    if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ message: "Enter a valid email address" });
    }
    const transport = createPasswordResetTransport();
    if (!transport) return res.status(503).json({ message: "Password reset email is not configured" });

    const issued = await issuePasswordResetToken({ email, User, PasswordResetToken });
    if (issued) {
      void sendPasswordResetEmail({
        transport,
        from: process.env.MAIL_FROM,
        to: issued.user.email,
        token: issued.token,
        clientOrigin: process.env.CLIENT_ORIGIN || "http://localhost:5173"
      }).catch(() => console.error("Password reset email delivery failed"));
    }
    return res.status(202).json(genericResponse);
  } catch (error) { next(error); }
});

router.post("/complete", resetLimiter, async (req, res, next) => {
  try {
    const token = req.body?.token;
    const password = typeof req.body?.password === "string" ? req.body.password : "";
    if (password.length < 8 || password.length > 72) {
      return res.status(400).json({ message: "Password must be 8–72 characters" });
    }
    const completed = await completePasswordReset({
      token,
      password,
      User,
      PasswordResetToken,
      hashPassword: (value) => bcrypt.hash(value, 12)
    });
    if (!completed) return res.status(400).json({ message: "This password reset link is invalid or has expired" });
    return res.json({ message: "Password reset successfully. Sign in with your new password." });
  } catch (error) { next(error); }
});

export default router;
