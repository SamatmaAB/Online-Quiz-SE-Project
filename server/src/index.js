import "dotenv/config";
import app from "./app.js";
import { connectDatabase } from "./config/db.js";

const port = Number(process.env.PORT || 5000);
try {
  await connectDatabase();
  app.listen(port, () => console.log(`API listening on port ${port}`));
} catch (error) {
  console.error("Startup failed:", error.message);
  process.exit(1);
}
