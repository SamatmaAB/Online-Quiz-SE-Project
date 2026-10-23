import jwt from "jsonwebtoken";
import { createHash } from "node:crypto";
import RevokedToken from "../models/RevokedToken.js";

export async function requireAuth(req, res, next) {
  try {
    const authorization = req.get("authorization") || "";
    const match = authorization.match(/^Bearer\s+(.+)$/i);
    if (!match) return res.status(401).json({ message: "Authentication required" });
    if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
      return res.status(500).json({ message: "Authentication is not configured" });
    }
    const token = match[1];
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const tokenHash = createHash("sha256").update(token).digest("hex");
    if (await RevokedToken.exists({ tokenHash })) {
      return res.status(401).json({ message: "Session has been logged out" });
    }
    req.auth = { userId: payload.sub, token };
    next();
  } catch {
    return res.status(401).json({ message: "Invalid or expired token" });
  }
}
