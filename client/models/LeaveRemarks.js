import mongoose from 'mongoose';

const leaveRemarksSchema = new mongoose.Schema(
  {
    employee: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true },
    from: { type: Date, required: true }, // inclusive (local midnight)
    to:   { type: Date, required: true }, // inclusive (local 23:59)
    // Map where key = status label (e.g., "CASUAL LEAVE"), value = remark string
    remarks: { type: Map, of: String, default: {} }
  },
  { timestamps: true }
);

// one doc per employee & range
leaveRemarksSchema.index({ employee: 1, from: 1, to: 1 }, { unique: true });

export default mongoose.model('LeaveRemarks', leaveRemarksSchema);
