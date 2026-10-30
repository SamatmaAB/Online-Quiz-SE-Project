import express from "express";
import app from "./src/app.js";
import { connectDatabase } from "./src/config/db.js";

const server = express();
let databaseConnection;

server.use(async (_req, res, next) => {
  try {
    if (!databaseConnection) {
      databaseConnection = connectDatabase().catch((error) => {
        databaseConnection = undefined;
        throw error;
      });
    }
    await databaseConnection;
    next();
  } catch (error) {
    console.error("Database connection failed:", error.message);
    res.status(503).json({ message: "Database unavailable" });
  }
});

server.use(app);

export default server;
