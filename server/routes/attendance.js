// server/routes/attendance.js
import express from "express";
import Attendance, { ATTENDANCE_STATUSES } from "../models/Attendance.js";
import { requireAuth, employeeIdsForScope } from "../middleware/auth.js";

const router = express.Router();
router.use(requireAuth);

/**
 * ✅ TIMEZONE SAFE (IMPORTANT)
 * We treat incoming date as "YYYY-MM-DD" and store it as UTC midnight:
 * 2025-12-19 -> 2025-12-19T00:00:00.000Z
 *
 * This prevents IST/UTC shifting issues.
 */
const isYMD = (s) => typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s);

const toUtcMidnightFromYMD = (ymd) => {
  if (!isYMD(ymd)) return null;
  const d = new Date(`${ymd}T00:00:00.000Z`);
  return Number.isNaN(d.getTime()) ? null : d;
};

const addUtcDays = (dateObj, days) => {
  const d = new Date(dateObj);
  d.setUTCDate(d.getUTCDate() + days);
  return d;
};

const isAllowedStatus = (v) => {
  if (v === "" || v === null || v === undefined) return true; // allow clearing
  return ATTENDANCE_STATUSES.includes(String(v));
};

// ✅ upsert with retry (handles E11000 race)
async function upsertAttendanceWithRetry({ employeeId, d, update }) {
  try {
    return await Attendance.findOneAndUpdate(
      { employee: employeeId, date: d },
      { $set: update },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    ).populate("employee");
  } catch (err) {
    if (err?.code === 11000) {
      return await Attendance.findOneAndUpdate(
        { employee: employeeId, date: d },
        { $set: update },
        { upsert: false, new: true }
      ).populate("employee");
    }
    throw err;
  }
}

// GET /api/attendance?employeeId=&from=YYYY-MM-DD&to=YYYY-MM-DD
router.get("/", async (req, res) => {
  try {
    const { from, to, employeeId } = req.query;

    const q = {};

    // ✅ date range using UTC day boundaries
    if (from || to) {
      q.date = {};

      if (from) {
        const f = toUtcMidnightFromYMD(String(from));
        if (!f) return res.status(400).json({ message: "Invalid from date. Use YYYY-MM-DD" });
        q.date.$gte = f;
      }

      if (to) {
        const t = toUtcMidnightFromYMD(String(to));
        if (!t) return res.status(400).json({ message: "Invalid to date. Use YYYY-MM-DD" });

        // ✅ use "< nextDay" instead of "<= endOfDay" (cleaner + no ms issues)
        const nextDay = addUtcDays(t, 1);
        q.date.$lt = nextDay;
      }
    }

    if (employeeId && employeeId !== "ALL") q.employee = employeeId;

    const ids = await employeeIdsForScope(req.user);
    if (ids) {
      if (q.employee) {
        if (!ids.map(String).includes(String(q.employee))) return res.json([]);
      } else {
        q.employee = { $in: ids };
      }
    }

    const rows = await Attendance.find(q).populate("employee").sort({ date: 1 });
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

// POST /api/attendance/mark
router.post("/mark", async (req, res) => {
  try {
    const { employeeId, date, status, note, checkIn, checkOut } = req.body;

    if (!employeeId || !date) {
      return res.status(400).json({ message: "employeeId & date required" });
    }

    // ✅ date must be YYYY-MM-DD and stored as UTC midnight
    const d = toUtcMidnightFromYMD(String(date));
    if (!d) return res.status(400).json({ message: "Invalid date. Use YYYY-MM-DD" });

    const ids = await employeeIdsForScope(req.user);
    if (ids && !ids.map(String).includes(String(employeeId))) {
      return res.status(403).json({ message: "Forbidden" });
    }

    if (!isAllowedStatus(status)) {
      return res.status(400).json({
        message: `Invalid status "${status}". Allowed: ${ATTENDANCE_STATUSES.join(", ")}`
      });
    }

    const update = {
      status: String(status ?? ""), // allow clearing
      note: String(note ?? ""),
      checkIn: String(checkIn ?? ""),
      checkOut: String(checkOut ?? "")
    };

    const row = await upsertAttendanceWithRetry({ employeeId, d, update });
    res.json(row);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

router.post("/note", async (req, res) => {
  try {
    const { recordId, note } = req.body || {};
    if (!recordId) return res.status(400).json({ message: "recordId required" });

    const row = await Attendance.findById(recordId);
    if (!row) return res.status(404).json({ message: "Attendance record not found" });

    const ids = await employeeIdsForScope(req.user);
    if (ids && !ids.map(String).includes(String(row.employee))) {
      return res.status(403).json({ message: "Forbidden" });
    }

    row.note = String(note ?? "");
    await row.save();

    res.json({ ok: true, recordId, note: row.note });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

export default router;
