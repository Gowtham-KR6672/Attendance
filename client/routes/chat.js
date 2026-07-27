import express from "express";
import mongoose from "mongoose";
import Admin from "../models/Admin.js";
import ChatMessage from "../models/ChatMessage.js";
import { requireAuth } from "../middleware/auth.js";

const router = express.Router();

// same role rules as server.js
const canChat = (meRole, otherRole) => {
  // ✅ allow everyone to talk to super
  if (meRole === "super" || otherRole === "super") return true;

  // ✅ admin <-> admin allowed
  if (meRole === "admin" && otherRole === "admin") return true;

  // ✅ admin_tl <-> admin_tl allowed
  if (meRole === "admin_tl" && otherRole === "admin_tl") return true;

  // ✅ admin <-> admin_tl allowed
  if (
    (meRole === "admin" && otherRole === "admin_tl") ||
    (meRole === "admin_tl" && otherRole === "admin")
  ) return true;

  return false;
};


// ✅ users list
router.get("/users", requireAuth, async (req, res) => {
  const meId = req.user.sub;
  const meRole = req.user.role;

  const all = await Admin.find({}, { email: 1, role: 1 }).lean();

  const filtered = all
    .filter((u) => String(u._id) !== String(meId))
    .filter((u) => canChat(meRole, u.role));

  res.json(filtered);
});

// ✅ messages with a selected user
router.get("/messages/:otherId", requireAuth, async (req, res) => {
  const meId = req.user.sub;
  const meRole = req.user.role;
  const otherId = req.params.otherId;

  if (!mongoose.isValidObjectId(otherId)) {
    return res.status(400).json({ message: "Invalid otherId" });
  }

  const other = await Admin.findById(otherId, { role: 1 });
  if (!other) return res.status(404).json({ message: "User not found" });

  if (!canChat(meRole, other.role)) {
    return res.status(403).json({ message: "Forbidden" });
  }

  const msgs = await ChatMessage.find({
    $or: [
      { fromAdminId: meId, toAdminId: otherId },
      { fromAdminId: otherId, toAdminId: meId },
    ],
  })
    .sort({ createdAt: 1 })
    .lean();

  console.log(`[API] Fetched ${msgs.length} messages from DB for user ${meId} <-> ${otherId}`);

  res.json(msgs);
});

export default router;
