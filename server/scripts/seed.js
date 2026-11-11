import "dotenv/config";
import mongoose from "mongoose";
import { connectDatabase } from "../src/config/db.js";
import { ensureSeedData } from "../src/services/seedData.js";

await connectDatabase();
const { created, total } = await ensureSeedData();
console.log(`Seed complete: ${created} new quiz(zes), ${total - created} already present.`);
await mongoose.disconnect();
