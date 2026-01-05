import mongoose from "mongoose";

const ReportEntrySchema = new mongoose.Schema(
  {
    // store as real Date (00:00)
    date: { type: Date, required: true },

    processName: { type: String, required: true, trim: true },
    processId: { type: String, trim: true }, // optional (if you want)
    uom: { type: String, trim: true },
    tat: { type: Number, required: true }, // time per unit
    teamHours: { type: Number, required: true },
    teamCount: { type: Number, required: true },

    // calculated
    actualCount: { type: Number, required: true },
    actualHours: { type: Number, required: true },

    // ownership / scope
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "Admin", required: true },
    createdByRole: { type: String, required: true },
    teamHeadEmail: { type: String, required: true },
  },
  { timestamps: true }
);

export default mongoose.model("ReportEntry", ReportEntrySchema);
