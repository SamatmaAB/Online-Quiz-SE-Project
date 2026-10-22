import "dotenv/config";
import app from "./app.js";
import { connectDatabase } from "./config/db.js";
const port=Number(process.env.PORT)||5000;
async function start(){if(!process.env.JWT_SECRET||process.env.JWT_SECRET.length<32)throw new Error("JWT_SECRET must be at least 32 characters.");await connectDatabase();app.listen(port,()=>console.log("API listening on port "+port));}
start().catch(e=>{console.error("Failed to start API:",e.message);process.exit(1);});
