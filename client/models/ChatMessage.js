import mongoose from "mongoose";

const chatMessageSchema = new mongoose.Schema(
  {
    fromAdminId: { type: mongoose.Schema.Types.ObjectId, ref: "Admin", required: true },
    toAdminId: { type: mongoose.Schema.Types.ObjectId, ref: "Admin", required: true },
    text: { type: String, required: true },
    status: { type: String, enum: ["sent", "delivered", "read"], default: "sent" },
  },
  { timestamps: true } // ✅ creates createdAt + updatedAt
);

// ✅ Auto-delete after 3 weeks (21 days)
chatMessageSchema.index({ createdAt: 1 }, { expireAfterSeconds: 21 * 24 * 60 * 60 });

export default mongoose.model("ChatMessage", chatMessageSchema);
