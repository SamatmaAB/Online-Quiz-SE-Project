// Local account maintenance for the machine that runs the API and database.
//   npm --prefix server run user -- list
//   npm --prefix server run user -- make-admin you@example.com
//   npm --prefix server run user -- set-password you@example.com "a new password"
import "dotenv/config";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import { connectDatabase } from "../src/config/db.js";
import User from "../src/models/User.js";

const [command, email, password] = process.argv.slice(2);

function usage() {
  console.log("Usage: user <list | make-admin EMAIL | remove-admin EMAIL | set-password EMAIL NEW_PASSWORD>");
  process.exitCode = 1;
}

async function run() {
  if (command === "list") {
    const users = await User.find().sort({ createdAt: 1 }).lean();
    for (const user of users) console.log(`${user.role.padEnd(5)}  ${user.email}  (${user.name})`);
    if (!users.length) console.log("No users yet — register one in the app first.");
    return;
  }
  if (!["make-admin", "remove-admin", "set-password"].includes(command) || !email) return usage();
  const user = await User.findOne({ email: email.trim().toLowerCase() }).select("+tokenVersion");
  if (!user) { console.error(`No user with email ${email}. Run "list" to see accounts.`); process.exitCode = 1; return; }

  if (command === "make-admin" || command === "remove-admin") {
    user.role = command === "make-admin" ? "admin" : "user";
    await user.save();
    console.log(`${user.email} is now ${user.role}.`);
  } else {
    if (!password || password.length < 8 || password.length > 72) { console.error("Password must be 8–72 characters."); process.exitCode = 1; return; }
    user.passwordHash = await bcrypt.hash(password, 12);
    user.tokenVersion = (user.tokenVersion || 0) + 1; // signs out any existing sessions
    await user.save();
    console.log(`Password updated for ${user.email}. Existing sessions were signed out.`);
  }
}

try {
  await connectDatabase();
  await run();
} finally {
  await mongoose.disconnect();
}

