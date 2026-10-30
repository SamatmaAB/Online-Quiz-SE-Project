import jwt from "jsonwebtoken";
import { createHash } from "node:crypto";
import User from "../models/User.js";
import RevokedToken from "../models/RevokedToken.js";

export async function requireAuth(req, res, next) {
  try {
    const match = String(req.get("authorization") || "").match(/^Bearer\s+(.+)$/i);
    if (!match) return res.status(401).json({ message: "Authentication required" });
    if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
      return res.status(500).json({ message: "Authentication is not configured" });
    }
    const token = match[1];
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const tokenHash = createHash("sha256").update(token).digest("hex");
    if (await RevokedToken.exists({ tokenHash })) return res.status(401).json({ message: "Session has been logged out" });
    const user = await User.findById(payload.sub).select("+tokenVersion");
    if (!user) return res.status(401).json({ message: "Invalid or expired token" });
    if ((payload.ver ?? 0) !== (user.tokenVersion || 0)) return res.status(401).json({ message: "Session has been revoked" });
    req.user = user;
    next();
  } catch (error) {
    if (error.name === "JsonWebTokenError" || error.name === "TokenExpiredError") {
      return res.status(401).json({ message: "Invalid or expired token" });
    }
    next(error);
  }
}

export function requireAdmin(req, res, next) {
  if (req.user?.role !== "admin") return res.status(403).json({ message: "Administrator access required" });
  next();
}
