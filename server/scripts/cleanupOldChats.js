import "dotenv/config";
import mongoose from "mongoose";
import { connectDB } from "../config/db.js";
import ChatMessage from "../models/ChatMessage.js";

await connectDB();

const cutoff = new Date(Date.now() - 21 * 24 * 60 * 60 * 1000);

const res = await ChatMessage.deleteMany({ createdAt: { $lt: cutoff } });
console.log("Deleted:", res.deletedCount);

await mongoose.disconnect();
process.exit(0);