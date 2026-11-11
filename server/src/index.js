import "dotenv/config";
import app from "./app.js";
import { connectDatabase } from "./config/db.js";
import { ensureSeedData } from "./services/seedData.js";

const port = Number(process.env.PORT || 5000);
try {
  await connectDatabase();
  const seeded = await ensureSeedData();
  if (seeded.created > 0) console.log(`Seeded ${seeded.created} starter quiz(zes)`);
  app.listen(port, () => console.log(`API listening on port ${port}`));
} catch (error) {
  console.error("Startup failed:", error.message);
  process.exit(1);
}
