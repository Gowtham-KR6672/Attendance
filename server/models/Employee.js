import mongoose from 'mongoose';

const employeeSchema = new mongoose.Schema(
  {
    // Core
    name: { type: String, required: true, trim: true },

    // Treat "code" as Emp ID
    code: { type: String, required: true, unique: true, trim: true },

    // ✅ creator tracking
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin', default: null, index: true },
    createdByRole: { type: String, enum: ['super', 'admin_tl', 'admin'], default: null },
    teamHeadEmail: { type: String, trim: true, lowercase: true, default: null },

    // Sheet fields
    gender: { type: String, enum: ['Male', 'Female', 'Others'], default: null },
    bloodGroup: { type: String, trim: true, default: null },

    dob: { type: Date, default: null },
    certDob: { type: Date, default: null },
    doj: { type: Date, default: null },

    designation: {
      type: String,
      enum: ['ATL', 'SME', 'Senior Process Associate', 'Process Associate', 'Trainee Process Associate'],
      default: null
    },

    shift: { type: String, enum: ['Day Shift', 'Night Shift'], default: null },

    teamType: {
      type: String,
      enum: ['On Going', 'One Time', 'FTE'],
      default: null
    },

    personalEmail: {
      type: String,
      trim: true,
      lowercase: true,
      match: [/^\S+@\S+\.\S+$/, 'Invalid email'],
      default: null
    },
    officialEmail: {
      type: String,
      trim: true,
      lowercase: true,
      match: [/^\S+@\S+\.\S+$/, 'Invalid email'],
      default: null
    },

    personalPhone: { type: String, trim: true, default: null },
    parentPhone: { type: String, trim: true, default: null },

    laptopStatus: { type: String, enum: ['PC', 'Laptop'], default: null },

    presentLocation: { type: String, trim: true, default: null },
    permanentLocation: { type: String, trim: true, default: null },

    department: { type: String, trim: true, default: null },
    remarks: { type: String, trim: true, default: null },

    status: { type: String, enum: ['active', 'inactive'], default: 'active' }
  },
  { timestamps: true }
);

export default mongoose.model('Employee', employeeSchema);
