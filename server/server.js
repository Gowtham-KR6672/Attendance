import "dotenv/config";
import mongoose from "mongoose";
import express from "express";
import cookieParser from "cookie-parser";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import rateLimit from "express-rate-limit";
import http from "http";
import { Server } from "socket.io";

import { connectDB } from "./config/db.js";

import authRouter from "./routes/auth.js";
import adminsRouter from "./routes/admins.js";
import employeeRoutes from "./routes/employees.js";
import attendanceRoutes from "./routes/attendance.js";
import leaveRemarksRouter from "./routes/leaveRemarks.js";
import compOffRouter from "./routes/compoff.js";

// ✅ Chat
import chatRouter from "./routes/chat.js";
import ChatMessage from "./models/ChatMessage.js";
import Admin from "./models/Admin.js";
import { verifySocketToken } from "./socket/authSocket.js";
import processRouter from "./routes/processes.js";

const app = express();
await connectDB();

app.use(helmet());
app.use(morgan("dev"));
app.use(express.json());
app.use(cookieParser());

app.use(
  cors({
    origin: [process.env.CLIENT_URL, "http://localhost:5173"],
    credentials: true,
  })
);

// ✅ RATE LIMIT (avoid blocking login too quickly)
const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 240,
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(limiter);

app.get("/", (_req, res) => res.send("Attendance Admin API OK"));

app.use("/api/auth", authRouter);
app.use("/api/admins", adminsRouter);
app.use("/api/employees", employeeRoutes);
app.use("/api/attendance", attendanceRoutes);
app.use("/api/leave-remarks", leaveRemarksRouter);
app.use("/api/compoff", compOffRouter);
app.use("/api/processes", processRouter);

// ✅ Chat REST
app.use("/api/chat", chatRouter);

app.use((req, res) => res.status(404).json({ message: "Not Found" }));

// =====================================================
// ✅ ROLE RULES (ONE place only)
// =====================================================
const canChat = (meRole, otherRole) => {
  const okRoles = ["super", "admin", "admin_tl"];
  if (!okRoles.includes(meRole) || !okRoles.includes(otherRole)) return false;

  // super ↔ all
  if (meRole === "super" || otherRole === "super") return true;

  // admin ↔ admin
  if (meRole === "admin" && otherRole === "admin") return true;

  // admin_tl ↔ admin_tl
  if (meRole === "admin_tl" && otherRole === "admin_tl") return true;

  // admin ↔ admin_tl
  if (
    (meRole === "admin" && otherRole === "admin_tl") ||
    (meRole === "admin_tl" && otherRole === "admin")
  ) return true;

  return false;
};

// =====================================================
// ✅ Auto delete chats older than 3 weeks (21 days)
// Runs once at start + every 24 hours
// =====================================================
const CHAT_RETENTION_DAYS = 21;

async function cleanupOldChats() {
  try {
    const cutoff = new Date(Date.now() - CHAT_RETENTION_DAYS * 24 * 60 * 60 * 1000);
    const res = await ChatMessage.deleteMany({
      createdAt: { $lt: cutoff },
    });
    console.log(`🧹 Chat cleanup: deleted ${res.deletedCount || 0} messages older than ${CHAT_RETENTION_DAYS} days`);
  } catch (err) {
    console.error("❌ Chat cleanup failed:", err?.message || err);
  }
}

// run once on boot
cleanupOldChats();
// run every 24h
setInterval(cleanupOldChats, 24 * 60 * 60 * 1000);

// ==============================
// ✅ Socket.IO setup
// ==============================
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: [process.env.CLIENT_URL, "http://localhost:5173"],
    credentials: true,
  },
});

// ✅ socket auth
io.use(async (socket, next) => {
  try {
    const token = socket.handshake.auth?.token;
    const user = await verifySocketToken(token);

    socket.user = user;
    socket.join(`admin:${user._id}`);
    next();
  } catch (e) {
    next(new Error("Unauthorized"));
  }
});

io.on("connection", (socket) => {
  // ✅ SEND MESSAGE
  socket.on("chat:send", async ({ toAdminId, text }, cb) => {
    try {
      const from = socket.user;
      const msgText = String(text || "").trim();

      if (!msgText) return cb?.({ ok: false, message: "Message empty" });
      if (!mongoose.isValidObjectId(toAdminId)) return cb?.({ ok: false, message: "Invalid receiver ID" });

      const to = await Admin.findById(toAdminId, { role: 1 });
      if (!to) return cb?.({ ok: false, message: "User not found" });

      if (!canChat(from.role, to.role)) return cb?.({ ok: false, message: "Forbidden" });

      // ✅ Save as SENT
      let msg = await ChatMessage.create({
        fromAdminId: from._id,
        toAdminId,
        text: msgText,
        status: "sent",
      });

      // ✅ Emit to receiver + sender
      io.to(`admin:${toAdminId}`).emit("chat:new", msg);
      io.to(`admin:${from._id}`).emit("chat:new", msg);

      // ✅ Mark as DELIVERED
      msg.status = "delivered";
      msg.deliveredAt = new Date();
      await msg.save();

      io.to(`admin:${from._id}`).emit("chat:delivered", { messageId: msg._id });

      cb?.({ ok: true, messageId: msg._id });
    } catch (e) {
      cb?.({ ok: false, message: e?.message || "Send failed" });
    }
  });

  // ✅ READ MESSAGES (called when chat opened)
  socket.on("chat:read", async ({ otherId }, cb) => {
    try {
      const meId = socket.user._id;
      if (!mongoose.isValidObjectId(otherId)) return cb?.({ ok: false });

      const now = new Date();

      const res = await ChatMessage.updateMany(
        {
          fromAdminId: otherId,
          toAdminId: meId,
          status: { $ne: "read" },
        },
        { $set: { status: "read", readAt: now } }
      );

      io.to(`admin:${otherId}`).emit("chat:read", { by: meId });

      cb?.({ ok: true, modified: res.modifiedCount || 0 });
    } catch {
      cb?.({ ok: false });
    }
  });
});

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => console.log(`🚀 Server running on http://localhost:${PORT}`));
