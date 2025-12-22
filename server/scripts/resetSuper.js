import 'dotenv/config.js';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { connectDB } from '../config/db.js';
import Admin from '../models/Admin.js';

const normEmail = (v) => String(v || '').trim().toLowerCase();

await connectDB();

const EMAIL = normEmail('admin@example.com'); // MUST be normalized
const NEW_PASS = 'admin@123';

const passwordHash = await bcrypt.hash(NEW_PASS, 10);

const res = await Admin.updateOne(
  { role: 'super', email: EMAIL },
  { $set: { passwordHash } }
);

console.log('Matched:', res.matchedCount);
console.log('Updated:', res.modifiedCount);

await mongoose.connection.close();
