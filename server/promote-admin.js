import "dotenv/config";
import mongoose from "mongoose";
import User from "./src/models/User.js";

try {
  await mongoose.connect(process.env.MONGODB_URI);

  const result = await User.updateOne(
    { email: "admin@example.com" },
    { $set: { role: "admin" } }
  );

  if (result.matchedCount === 0) {
    console.log("Account not found. Register it first.");
  } else {
    console.log("Admin role assigned successfully.");
  }
} catch (error) {
  console.error("Admin setup failed:", error.message);
} finally {
  await mongoose.disconnect();
}