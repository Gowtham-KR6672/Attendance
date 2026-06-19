import 'dotenv/config';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import Admin from '../models/Admin.js';

const run = async () => {
  if (!process.env.MONGO_URI) throw new Error('MONGO_URI missing');
  if (!process.env.SUPER_ADMIN_EMAIL) throw new Error('SUPER_ADMIN_EMAIL missing');
  if (!process.env.SUPER_ADMIN_PASSWORD) throw new Error('SUPER_ADMIN_PASSWORD missing');

  await mongoose.connect(process.env.MONGO_URI);

  const email = String(process.env.SUPER_ADMIN_EMAIL).trim().toLowerCase();
  const password = String(process.env.SUPER_ADMIN_PASSWORD);

  const passwordHash = await bcrypt.hash(password, 10);

  const existing = await Admin.findOne({ email });

  if (!existing) {
    await Admin.create({
      email,
      role: 'super',
      passwordHash,
      allowedTeamType: null,
      allowedTeamTypes: [],
      allowedShift: null,
    });
    console.log('✅ Super admin created:', email);
  } else {
    // ensure it is super + reset password to env password
    existing.role = 'super';
    existing.passwordHash = passwordHash;
    existing.allowedTeamType = null;
    existing.allowedTeamTypes = [];
    existing.allowedShift = null;
    await existing.save();
    console.log('✅ Super admin updated (role + password):', email);
  }

  await mongoose.disconnect();
};

run().catch((e) => {
  console.error('❌ seed failed:', e.message);
  process.exit(1);
});
