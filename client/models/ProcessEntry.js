import mongoose from "mongoose";

const ProcessEntrySchema = new mongoose.Schema(
  {
    processId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Process",
      required: true,
      index: true,
    },

    // store values by header key: { month: "Aug", totalInput: 10, ... }
    values: { type: Object, default: {} },

    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "Admin" },
  },
  { timestamps: true }
);

export default mongoose.model("ProcessEntry", ProcessEntrySchema);
