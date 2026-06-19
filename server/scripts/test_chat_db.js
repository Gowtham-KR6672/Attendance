
import "dotenv/config";
import mongoose from "mongoose";
import ChatMessage from "../models/ChatMessage.js";
import Admin from "../models/Admin.js";
import { connectDB } from "../config/db.js";

async function testChatPersistence() {
  console.log("🚀 Starting Chat Persistence Test...");

  try {
    await connectDB();
    console.log("✅ DB Connected");

    // 1. Find two admins to chat
    const admins = await Admin.find().limit(2);
    if (admins.length < 2) {
      console.error("❌ Need at least 2 admins in DB to test chat.");
      process.exit(1);
    }
    const [sender, receiver] = admins;
    console.log(`Using Sender: ${sender.email} (${sender._id})`);
    console.log(`Using Receiver: ${receiver.email} (${receiver._id})`);

    // 2. Create a test message
    const text = `Test message ${Date.now()}`;
    console.log(`Creating message: "${text}"`);

    const msg = await ChatMessage.create({
      fromAdminId: sender._id,
      toAdminId: receiver._id,
      text,
      status: "sent",
    });

    console.log("✅ Message created in DB with ID:", msg._id);

    // 3. Retrieve the message
    const found = await ChatMessage.findById(msg._id);
    if (!found) {
        console.error("❌ Message NOT found in DB after creation!");
    } else if (found.text === text) {
        console.log("✅ Message successfully retrieved from DB: ", found.text);
    } else {
        console.error("❌ Message retrieved but text mismatches.");
    }

    // 4. Clean up
    await ChatMessage.findByIdAndDelete(msg._id);
    console.log("✅ Test message cleaned up.");

  } catch (error) {
    console.error("❌ Test Failed:", error);
  } finally {
    await mongoose.disconnect();
    console.log("Disconnected.");
    process.exit(0);
  }
}

testChatPersistence();
