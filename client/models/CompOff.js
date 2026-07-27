import mongoose from 'mongoose';

const compOffSchema = new mongoose.Schema(
  {
    employee: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true },
    workDate: { type: Date, required: true },        // holiday/weekend worked
    leaveDate:{ type: Date, default: null },         // comp-off consumed day
    status:   { type: String, enum: ['PENDING','HALF_TAKEN','TAKEN','PAID'], default: 'PENDING' },
    remark:   { type: String, default: '' },
  },
  { timestamps: true }
);

compOffSchema.index({ employee: 1, workDate: 1 }, { unique: true });

export default mongoose.model('CompOff', compOffSchema);
