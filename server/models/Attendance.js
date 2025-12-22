import mongoose from 'mongoose';

// ✅ Allowed statuses (MUST match frontend)
export const ATTENDANCE_STATUSES = [
  'PRESENT',
  'WFH',
  'ABSENT',
  'CASUAL LEAVE',
  'SICK LEAVE',
  'SESSION_01 LEAVE',
  'SESSION_02 LEAVE',
  'NO INTIMATION',
  'NCNS',
  'L.O.P.',
  'COMP-OFF',
  'RELIEVED',
  'HOLIDAY',
  'PHONE INTIMATION',
  '1 Hr Per MORN',
  '2 Hr Per MORN',
  '1 Hr Per EVE',
  '2 Hr Per EVE',
  'SUNDAY',
  '3rd Saturday Week off',
];

const attendanceSchema = new mongoose.Schema(
  {
    employee: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true },
    date: { type: Date, required: true },
    status: { type: String, enum: ATTENDANCE_STATUSES, required: true },
    checkIn: { type: String, default: '' },
    checkOut: { type: String, default: '' },
    note: { type: String, default: '' },
  },
  { timestamps: true }
);

attendanceSchema.index({ employee: 1, date: 1 }, { unique: true });

export default mongoose.model('Attendance', attendanceSchema);
