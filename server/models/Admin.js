import mongoose from 'mongoose';

const adminSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },

    // roles: super (all), admin (single-team scoped), admin_tl (multi-team scoped)
    role: { type: String, enum: ['super', 'admin', 'admin_tl'], default: 'admin' },

    // admin (single team)
    allowedTeamType: {
      type: String,
      enum: ['On Going', 'One Time', 'FTE'],
      default: null,
    },

    // admin_tl (multiple teams)
    allowedTeamTypes: {
      type: [String],
      enum: ['On Going', 'One Time', 'FTE'],
      default: [],
    },

    // shift is optional for both admin/admin_tl (if set, applies)
    allowedShift: {
      type: String,
      enum: ['Day Shift', 'Night Shift'],
      default: null,
    },
  },
  { timestamps: true }
);

export default mongoose.model('Admin', adminSchema);
