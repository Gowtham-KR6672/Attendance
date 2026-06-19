import 'dotenv/config.js';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import Admin from '../models/Admin.js'; // make sure path matches your model
import { connectDB } from '../config/db.js';

await connectDB();

const SUPER_EMAIL = 'admin@example.com';
const SUPER_PASS  = 'Admin@123';

const oneTimeAdmin = { username: 'oneTimeAdmin', pass: 'Admin@123', scopeTeam: 'One Time' };
const nightAdmin   = { username: 'nightAdmin',   pass: 'Admin@123', scopeShift: 'Night Shift' };

async function upsertSuper() {
  const hash = await bcrypt.hash(SUPER_PASS, 10);
  // Upsert by email (super admin's unique identifier)
  const result = await Admin.updateOne(
    { email: SUPER_EMAIL }, // only use email to find super admin
    { $set: { email: SUPER_EMAIL, role: 'super', passwordHash: hash } },
    { upsert: true } // upsert = insert or update
  );
  console.log('✅ Super admin ready:', SUPER_EMAIL);
}

async function upsertTeamAdmin() {
  const hash = await bcrypt.hash(oneTimeAdmin.pass, 10);
  // Upsert by username (team admin's unique identifier)
  const result = await Admin.updateOne(
    { username: oneTimeAdmin.username }, // filter by username for team admin
    {
      $set: {
        username: oneTimeAdmin.username,
        role: 'admin',
        passwordHash: hash,
        allowedTeamType: oneTimeAdmin.scopeTeam, // fixed scope
        allowedShift: null
      }
    },
    { upsert: true }
  );
  console.log('✅ Team admin ready:', oneTimeAdmin.username);
}

async function upsertShiftAdmin() {
  const hash = await bcrypt.hash(nightAdmin.pass, 10);
  // Upsert by username (shift admin's unique identifier)
  const result = await Admin.updateOne(
    { username: nightAdmin.username }, // filter by username for shift admin
    {
      $set: {
        username: nightAdmin.username,
        role: 'admin',
        passwordHash: hash,
        allowedTeamType: null, // not restricted to any team
        allowedShift: nightAdmin.scopeShift // fixed scope
      }
    },
    { upsert: true }
  );
  console.log('✅ Shift admin ready:', nightAdmin.username);
}



await upsertSuper();
await upsertTeamAdmin();
await upsertShiftAdmin();

await mongoose.connection.close();
console.log('✨ Done.');
