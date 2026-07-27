import mongoose from "mongoose";

const ReportEntrySchema = new mongoose.Schema(
  {
    // store as real Date (00:00)
    date: { type: Date, required: true },

    processName: { type: String, required: true, trim: true },

    // ✅ NEW: Process Type (store what user selected)
    // Use enum to keep consistent values in DB
    processType: {
      type: String,
      required: true,
      trim: true,
      enum: ["On Going", "One-Time", "FTE", "Long Time"],
      default: "On Going", // helps old inserts/migration; UI should still send exact type
    },

    processId: { type: String, trim: true }, // optional (if you want)
    uom: { type: String, trim: true },

    tat: { type: Number, required: true, min: 0 }, // time per unit
    teamHours: { type: Number, required: true, min: 0 },
    teamCount: { type: Number, required: true, min: 0 },

    // calculated
    actualCount: { type: Number, required: true, min: 0 },
    actualHours: { type: Number, required: true, min: 0 },

    // ownership / scope
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "Admin", required: true },
    createdByRole: { type: String, required: true },
    teamHeadEmail: { type: String, required: true },
  },
  { timestamps: true }
);

// ✅ Helpful indexes for reporting
ReportEntrySchema.index({ date: 1, processName: 1, processType: 1 });
ReportEntrySchema.index({ createdBy: 1, date: 1 });

export default mongoose.model("ReportEntry", ReportEntrySchema);
