import jwt from "jsonwebtoken";
import User from "../models/User.js";

export async function requireAuth(req, res, next) {
  try {
    const header = req.headers.authorization || "";
    const [scheme, token] = header.split(" ");

    if (scheme !== "Bearer" || !token) {
      return res.status(401).json({ message: "Please log in to continue" });
    }

    if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
      return res.status(500).json({ message: "Authentication is not configured" });
    }

    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(payload.sub).select("_id role");

    if (!user) {
      return res.status(401).json({ message: "User account not found" });
    }

    req.userId = user.id;
    req.userRole = user.role;
    next();
  } catch (error) {
    if (error.name === "JsonWebTokenError" || error.name === "TokenExpiredError") {
      return res.status(401).json({ message: "Session expired or token is invalid. Please log in again." });
    }

    next(error);
  }
}

export function requireAdmin(req, res, next) {
  if (req.userRole !== "admin") {
    return res.status(403).json({ message: "Admin access is required" });
  }

  next();
}
