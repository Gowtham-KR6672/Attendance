
import "dotenv/config";
import mongoose from "mongoose";
import Attendance from "../models/Attendance.js";

const ymdLocal = (d) => {
  const x = new Date(d);
  const y = x.getFullYear();
  const m = String(x.getMonth() + 1).padStart(2, "0");
  const day = String(x.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

const localMidnight = (ymd) => {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(y, m - 1, d, 0, 0, 0, 0);
};

async function main() {
  const uri = process.env.MONGO_URI || process.env.MONGODB_URI;
  if (!uri) throw new Error("Missing MONGO_URI / MONGODB_URI in .env");

  await mongoose.connect(uri);
  console.log("✅ Connected");

  const all = await Attendance.find({}).select("_id employee date status note checkIn checkOut").lean();
  console.log("Rows:", all.length);

  const groups = new Map();
  for (const r of all) {
    const day = ymdLocal(r.date);
    const key = `${String(r.employee)}|${day}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(r);
  }

  let updated = 0;
  let removed = 0;

  for (const [key, rows] of groups.entries()) {
    rows.sort((a, b) => new Date(a.date) - new Date(b.date)); // oldest first
    const keep = rows[0];
    const day = key.split("|")[1];
    const normalized = localMidnight(day);

    // update keep to midnight if needed
    if (new Date(keep.date).getTime() !== normalized.getTime()) {
      await Attendance.updateOne({ _id: keep._id }, { $set: { date: normalized } });
      updated++;
    }

    // delete duplicates
    const dupIds = rows.slice(1).map((x) => x._id);
    if (dupIds.length) {
      await Attendance.deleteMany({ _id: { $in: dupIds } });
      removed += dupIds.length;
    }
  }

  console.log("✅ Normalized dates:", updated);
  console.log("🗑️ Removed duplicates:", removed);

  await mongoose.disconnect();
  console.log("✅ Done");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
