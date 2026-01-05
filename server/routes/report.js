import express from "express";
import ReportEntry from "../models/ReportEntry.js";
import { requireAuth } from "../middleware/auth.js";

const router = express.Router();

/* ---------------- helpers ---------------- */

/** dd-mm-yyyy -> Date(00:00) */
const parseDDMMYYYY = (s) => {
  const raw = String(s || "").trim();
  const m = raw.match(/^(\d{2})-(\d{2})-(\d{4})$/);
  if (!m) return null;

  const dd = Number(m[1]);
  const mm = Number(m[2]);
  const yy = Number(m[3]);

  const d = new Date(yy, mm - 1, dd, 0, 0, 0, 0);
  if (Number.isNaN(d.getTime())) return null;

  // guard invalid dates like 32-13-2026
  if (d.getFullYear() !== yy || d.getMonth() !== mm - 1 || d.getDate() !== dd) return null;

  return d;
};

const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
const endOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);

const fmtDDMMYYYY = (d) => {
  const dt = d instanceof Date ? d : new Date(d);
  const dd = String(dt.getDate()).padStart(2, "0");
  const mm = String(dt.getMonth() + 1).padStart(2, "0");
  const yy = dt.getFullYear();
  return `${dd}-${mm}-${yy}`;
};

/** scope filter */
const reportScopeFilter = (user) => {
  if (!user || user.role === "super") return {};
  if (user.role === "admin") return { createdBy: user.sub };
  if (user.role === "admin_tl") return {};
  return {};
};

/* ---------------- routes ---------------- */

/** POST /api/report */
router.post("/", requireAuth, async (req, res) => {
  try {
    const user = req.user;

    const { date, processName, processId, uom, tat, teamHours, teamCount } = req.body || {};

    const dt = parseDDMMYYYY(date);
    if (!dt) return res.status(400).json({ message: "Invalid date. Use DD-MM-YYYY" });

    const pName = String(processName || "").trim();
    if (!pName) return res.status(400).json({ message: "Process Name required" });

    const TAT = Number(tat);
    const TH = Number(teamHours);
    const TC = Number(teamCount);

    if (!Number.isFinite(TAT) || TAT <= 0) return res.status(400).json({ message: "TAT must be > 0" });
    if (!Number.isFinite(TH) || TH < 0) return res.status(400).json({ message: "Team Hours must be >= 0" });
    if (!Number.isFinite(TC) || TC < 0) return res.status(400).json({ message: "Team Count must be >= 0" });

    // formulas
    const actualCount = TH * TAT;
    const actualHours = TC / TAT;

    // email from token
    const teamHeadEmail = String(user?.email || "").trim().toLowerCase();
    if (!teamHeadEmail) {
      return res.status(400).json({ message: "Missing admin email in token. Logout and login again." });
    }

    const doc = await ReportEntry.create({
      date: dt,
      processName: pName,
      processId: processId ? String(processId).trim() : undefined,
      uom: uom ? String(uom).trim() : undefined,
      tat: TAT,
      teamHours: TH,
      teamCount: TC,
      actualCount,
      actualHours,
      createdBy: user.sub,
      createdByRole: user.role,
      teamHeadEmail,
    });

    return res.json({ message: "Saved", row: doc });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ message: e?.message || "Server error" });
  }
});

/** (optional) GET /api/report?from&to -> rows list */
router.get("/", requireAuth, async (req, res) => {
  try {
    const user = req.user;
    const { from, to } = req.query;

    const f = parseDDMMYYYY(from);
    const t = parseDDMMYYYY(to);
    if (!f || !t) return res.status(400).json({ message: "from/to required (DD-MM-YYYY)" });

    const rows = await ReportEntry.find({
      ...reportScopeFilter(user),
      date: { $gte: startOfDay(f), $lte: endOfDay(t) },
    })
      .sort({ date: 1, processName: 1 })
      .lean();

    return res.json(rows);
  } catch (e) {
    console.error(e);
    return res.status(500).json({ message: "Server error" });
  }
});

/** GET /api/report/aggregate?from&to */
router.get("/aggregate", requireAuth, async (req, res) => {
  try {
    const user = req.user;
    const { from, to } = req.query;

    const f = parseDDMMYYYY(from);
    const t = parseDDMMYYYY(to);
    if (!f || !t) return res.status(400).json({ message: "from/to required (DD-MM-YYYY)" });

    const match = {
      ...reportScopeFilter(user),
      date: { $gte: startOfDay(f), $lte: endOfDay(t) },
    };

    const series = await ReportEntry.aggregate([
      { $match: match },
      {
        $group: {
          _id: "$processName",
          actualCount: { $sum: "$actualCount" },
          actualHours: { $sum: "$actualHours" },
          teamCount: { $sum: "$teamCount" },
          teamHours: { $sum: "$teamHours" },
        },
      },
      { $sort: { _id: 1 } },
      {
        $project: {
          _id: 0,
          processName: "$_id",
          actualCount: 1,
          actualHours: 1,
          teamCount: 1,
          teamHours: 1,
        },
      },
    ]);

    const totals = series.reduce(
      (a, x) => {
        a.actualCount += x.actualCount || 0;
        a.actualHours += x.actualHours || 0;
        a.teamCount += x.teamCount || 0;
        a.teamHours += x.teamHours || 0;
        return a;
      },
      { actualCount: 0, actualHours: 0, teamCount: 0, teamHours: 0 }
    );

    return res.json({ series, totals });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ message: "Server error" });
  }
});

/**
 * ✅ GET /api/report/trend
 * /api/report/trend?processName=...&from=dd-mm-yyyy&to=dd-mm-yyyy&limit=3
 * Returns:
 * - totalDates: count of distinct dates available
 * - points: last N recent dates (by date), summed values for each date
 */
router.get("/trend", requireAuth, async (req, res) => {
  try {
    const user = req.user;
    const { processName, from, to, limit } = req.query;

    const f = parseDDMMYYYY(from);
    const t = parseDDMMYYYY(to);
    if (!f || !t) return res.status(400).json({ message: "from/to required (DD-MM-YYYY)" });

    const proc = String(processName || "").trim();
    if (!proc) return res.status(400).json({ message: "processName required" });

    const lim = Math.max(1, Math.min(Number(limit || 3), 10));

    const match = {
      ...reportScopeFilter(user),
      processName: proc,
      date: { $gte: startOfDay(f), $lte: endOfDay(t) },
    };

    // total distinct dates count
    const distinctDates = await ReportEntry.distinct("date", match);
    const totalDates = distinctDates.length;

    // last N dates aggregation
    const agg = await ReportEntry.aggregate([
      { $match: match },
      {
        $group: {
          _id: "$date",
          actualCount: { $sum: "$actualCount" },
          actualHours: { $sum: "$actualHours" },
          teamCount: { $sum: "$teamCount" },
          teamHours: { $sum: "$teamHours" },
        },
      },
      { $sort: { _id: -1 } }, // newest first
      { $limit: lim },
      { $sort: { _id: 1 } }, // oldest -> newest for chart
      {
        $project: {
          _id: 0,
          date: "$_id",
          actualCount: 1,
          actualHours: 1,
          teamCount: 1,
          teamHours: 1,
        },
      },
    ]);

    // format date as DD-MM-YYYY
    const points = (agg || []).map((x) => ({
      date: fmtDDMMYYYY(x.date),
      actualCount: x.actualCount || 0,
      actualHours: x.actualHours || 0,
      teamCount: x.teamCount || 0,
      teamHours: x.teamHours || 0,
    }));

    return res.json({ totalDates, points });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ message: "Server error" });
  }
});

export default router;
