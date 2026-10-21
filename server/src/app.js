import express from "express";
import cors from "cors";
import helmet from "helmet";
import authRoutes from "./routes/auth.js";
import quizRoutes from "./routes/quizzes.js";
import attemptRoutes from "./routes/attempts.js";

const app = express();
app.disable("x-powered-by");
app.use(helmet());
app.use(cors({ origin: process.env.CLIENT_ORIGIN || "http://localhost:5173" }));
app.use(express.json({ limit: "100kb" }));
app.get("/api/health", (_req, res) => res.json({ status: "ok" }));
app.use("/api/auth", authRoutes);
app.use("/api/quizzes", quizRoutes);
app.use("/api/attempts", attemptRoutes);
app.use((_req, res) => res.status(404).json({ message: "Route not found" }));
app.use((error, _req, res, _next) => {
  if (error.name === "ValidationError") return res.status(400).json({ message: "Invalid data", details: error.message });
  if (error.name === "CastError") return res.status(400).json({ message: "Invalid identifier" });
  console.error(error);
  res.status(500).json({ message: "Internal server error" });
});
export default app;
