// report.js (routes) ✅ FULL UPDATED CODE
// Includes: Process Type support + Type filter + trend by type + bulk upload supports type
// ✅ NEW: entries list for same process+type + update (only within 24 hrs) + delete

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

// ✅ allowed process types (keep same as Schema enum)
const PROCESS_TYPES = ["On Going", "One-Time", "FTE", "Long Time"];
const normalizeProcessType = (v) => {
  const s = String(v || "").trim();
  if (!s) return null;
  // accept few common variants
  const map = {
    ongoing: "On Going",
    "on going": "On Going",
    one: "One-Time",
    "one time": "One-Time",
    "one-time": "One-Time",
    fte: "FTE",
    "long time": "Long Time",
    long: "Long Time",
  };
  const key = s.toLowerCase();
  return map[key] || s;
};

/** ✅ scope filter (Admin + Admin_Tl see ALL like Super) */
const reportScopeFilter = (user) => {
  if (!user) return {};
  if (user.role === "super") return {};
  if (user.role === "admin") return {}; // ✅ admin see all
  if (user.role === "admin_tl") return {}; // ✅ admin_tl see all
  return {};
};

/** ✅ 24-hour update rule (backend enforcement) */
const HOURS_24_MS = 24 * 60 * 60 * 1000;
const canUpdateWithin24h = (doc) => {
  const createdAt = new Date(doc?.createdAt || 0).getTime();
  if (!createdAt) return false;
  return Date.now() - createdAt <= HOURS_24_MS;
};

/* ---------------- routes ---------------- */

/** ✅ POST /api/report  (manual add) */
router.post("/", requireAuth, async (req, res) => {
  try {
    const user = req.user;

    const { date, processName, processType, processId, uom, tat, teamHours, teamCount } = req.body || {};

    const dt = parseDDMMYYYY(date);
    if (!dt) return res.status(400).json({ message: "Invalid date. Use DD-MM-YYYY" });

    const pName = String(processName || "").trim();
    if (!pName) return res.status(400).json({ message: "Process Name required" });

    const pType = normalizeProcessType(processType);
    if (!pType) return res.status(400).json({ message: "Process Type required" });
    if (!PROCESS_TYPES.includes(pType)) {
      return res.status(400).json({
        message: `Invalid Process Type. Allowed: ${PROCESS_TYPES.join(", ")}`,
      });
    }

    const TAT = Number(tat);
    const TH = Number(teamHours);
    const TC = Number(teamCount);

    if (!Number.isFinite(TAT) || TAT < 0) return res.status(400).json({ message: "TAT must be >= 0" });
    if (!Number.isFinite(TH) || TH < 0) return res.status(400).json({ message: "Team Hours must be >= 0" });
    if (!Number.isFinite(TC) || TC < 0) return res.status(400).json({ message: "Team Count must be >= 0" });

    const actualCount = TH * TAT;
    const actualHours = TAT === 0 ? 0 : TC / TAT;

    const teamHeadEmail = String(user?.email || "").trim().toLowerCase();
    if (!teamHeadEmail) {
      return res.status(400).json({ message: "Missing admin email in token. Logout and login again." });
    }

    const doc = await ReportEntry.create({
      date: dt,
      processName: pName,
      processType: pType,
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

/** ✅ POST /api/report/bulk  (upload) */
router.post("/bulk", requireAuth, async (req, res) => {
  try {
    const user = req.user;
    const rows = Array.isArray(req.body?.rows) ? req.body.rows : [];
    if (!rows.length) return res.status(400).json({ message: "No rows provided" });

    const teamHeadEmail = String(user?.email || "").trim().toLowerCase();
    if (!teamHeadEmail) {
      return res.status(400).json({ message: "Missing admin email in token. Logout and login again." });
    }

    const errors = [];
    const docs = [];

    rows.forEach((r, idx) => {
      const dt = parseDDMMYYYY(r?.date);
      if (!dt) return errors.push(`Row ${idx + 1}: Invalid date (DD-MM-YYYY)`);

      const pName = String(r?.processName || "").trim();
      if (!pName) return errors.push(`Row ${idx + 1}: Process Name required`);

      const pType = normalizeProcessType(r?.processType);
      if (!pType) return errors.push(`Row ${idx + 1}: Process Type required`);
      if (!PROCESS_TYPES.includes(pType)) {
        return errors.push(`Row ${idx + 1}: Invalid Process Type (${pType}). Allowed: ${PROCESS_TYPES.join(", ")}`);
      }

      const TAT = Number(r?.tat);
      const TH = Number(r?.teamHours);
      const TC = Number(r?.teamCount);

      if (!Number.isFinite(TAT) || TAT < 0) return errors.push(`Row ${idx + 1}: TAT must be >= 0`);
      if (!Number.isFinite(TH) || TH < 0) return errors.push(`Row ${idx + 1}: Team Hours must be >= 0`);
      if (!Number.isFinite(TC) || TC < 0) return errors.push(`Row ${idx + 1}: Team Count must be >= 0`);

      const actualCount = TH * TAT;
      const actualHours = TAT === 0 ? 0 : TC / TAT;

      docs.push({
        date: dt,
        processName: pName,
        processType: pType,
        processId: r?.processId ? String(r.processId).trim() : undefined,
        uom: r?.uom ? String(r.uom).trim() : undefined,
        tat: TAT,
        teamHours: TH,
        teamCount: TC,
        actualCount,
        actualHours,
        createdBy: user.sub,
        createdByRole: user.role,
        teamHeadEmail,
      });
    });

    if (errors.length) return res.status(400).json({ message: "Validation failed", errors });

    const inserted = await ReportEntry.insertMany(docs);
    return res.json({ message: "Bulk saved", insertedCount: inserted.length });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ message: e?.message || "Server error" });
  }
});

/** ✅ GET /api/report?from&to&processType=All|On Going|One-Time|FTE|Long Time */
router.get("/", requireAuth, async (req, res) => {
  try {
    const user = req.user;
    const { from, to, processType } = req.query;

    const f = parseDDMMYYYY(from);
    const t = parseDDMMYYYY(to);
    if (!f || !t) return res.status(400).json({ message: "from/to required (DD-MM-YYYY)" });

    const match = {
      ...reportScopeFilter(user),
      date: { $gte: startOfDay(f), $lte: endOfDay(t) },
    };

    const pType = normalizeProcessType(processType);
    if (pType && pType !== "All") {
      if (!PROCESS_TYPES.includes(pType)) {
        return res.status(400).json({
          message: `Invalid Process Type filter. Allowed: All, ${PROCESS_TYPES.join(", ")}`,
        });
      }
      match.processType = pType;
    }

    const rows = await ReportEntry.find(match).sort({ date: 1, processName: 1 }).lean();
    return res.json(rows);
  } catch (e) {
    console.error(e);
    return res.status(500).json({ message: "Server error" });
  }
});

/**
 * ✅ GET /api/report/aggregate?from&to&processType=All|On Going|One-Time|FTE|Long Time
 * series: grouped by processName + processType
 */
router.get("/aggregate", requireAuth, async (req, res) => {
  try {
    const user = req.user;
    const { from, to, processType } = req.query;

    const f = parseDDMMYYYY(from);
    const t = parseDDMMYYYY(to);
    if (!f || !t) return res.status(400).json({ message: "from/to required (DD-MM-YYYY)" });

    const match = {
      ...reportScopeFilter(user),
      date: { $gte: startOfDay(f), $lte: endOfDay(t) },
    };

    const pType = normalizeProcessType(processType);
    if (pType && pType !== "All") {
      if (!PROCESS_TYPES.includes(pType)) {
        return res.status(400).json({
          message: `Invalid Process Type filter. Allowed: All, ${PROCESS_TYPES.join(", ")}`,
        });
      }
      match.processType = pType;
    }

    const series = await ReportEntry.aggregate([
      { $match: match },
      {
        $group: {
          _id: { processName: "$processName", processType: "$processType" },
          actualCount: { $sum: "$actualCount" },
          actualHours: { $sum: "$actualHours" },
          teamCount: { $sum: "$teamCount" },
          teamHours: { $sum: "$teamHours" },
        },
      },
      { $sort: { "_id.processName": 1, "_id.processType": 1 } },
      {
        $project: {
          _id: 0,
          processName: "$_id.processName",
          processType: "$_id.processType",
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

    return res.json({
      series,
      totals,
      totalProcesses: series.length,
      processTypes: PROCESS_TYPES,
    });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ message: "Server error" });
  }
});

/**
 * ✅ GET /api/report/trend
 * /api/report/trend?processName=...&processType=...&from=dd-mm-yyyy&to=dd-mm-yyyy&limit=3
 * Comparison must be for SAME process + SAME type
 */
router.get("/trend", requireAuth, async (req, res) => {
  try {
    const user = req.user;
    const { processName, processType, from, to, limit } = req.query;

    const f = parseDDMMYYYY(from);
    const t = parseDDMMYYYY(to);
    if (!f || !t) return res.status(400).json({ message: "from/to required (DD-MM-YYYY)" });

    const proc = String(processName || "").trim();
    if (!proc) return res.status(400).json({ message: "processName required" });

    const pType = normalizeProcessType(processType);
    if (!pType) return res.status(400).json({ message: "processType required" });
    if (!PROCESS_TYPES.includes(pType)) {
      return res.status(400).json({
        message: `Invalid processType. Allowed: ${PROCESS_TYPES.join(", ")}`,
      });
    }

    const lim = Math.max(1, Math.min(Number(limit || 3), 10));

    const match = {
      ...reportScopeFilter(user),
      processName: proc,
      processType: pType,
      date: { $gte: startOfDay(f), $lte: endOfDay(t) },
    };

    const distinctDates = await ReportEntry.distinct("date", match);
    const totalDates = distinctDates.length;

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
      { $sort: { _id: -1 } },
      { $limit: lim },
      { $sort: { _id: 1 } },
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

    const points = (agg || []).map((x) => ({
      date: fmtDDMMYYYY(x.date),
      actualCount: x.actualCount || 0,
      actualHours: x.actualHours || 0,
      teamCount: x.teamCount || 0,
      teamHours: x.teamHours || 0,
    }));

    return res.json({ totalDates, points, processName: proc, processType: pType });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ message: "Server error" });
  }
});

/* ======================= ✅ NEW ROUTES (View/Edit/Delete) ======================= */

/**
 * ✅ GET /api/report/entries?from&to&processName&processType
 * Returns all added rows for that process+type within date range (used in modal)
 */
router.get("/entries", requireAuth, async (req, res) => {
  try {
    const user = req.user;
    const { from, to, processName, processType } = req.query;

    const f = parseDDMMYYYY(from);
    const t = parseDDMMYYYY(to);
    if (!f || !t) return res.status(400).json({ message: "from/to required (DD-MM-YYYY)" });

    const pn = String(processName || "").trim();
    if (!pn) return res.status(400).json({ message: "processName required" });

    const pt = normalizeProcessType(processType);
    if (!pt) return res.status(400).json({ message: "processType required" });
    if (!PROCESS_TYPES.includes(pt)) {
      return res.status(400).json({ message: `Invalid processType. Allowed: ${PROCESS_TYPES.join(", ")}` });
    }

    const rows = await ReportEntry.find({
      ...reportScopeFilter(user),
      processName: pn,
      processType: pt,
      date: { $gte: startOfDay(f), $lte: endOfDay(t) },
    })
      .sort({ date: 1, createdAt: 1 })
      .lean();

    return res.json({ rows });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ message: e?.message || "Server error" });
  }
});

/**
 * ✅ PUT /api/report/:id
 * Update allowed only within 24 hours from createdAt
 * Body: { uom, tat, teamHours, teamCount }
 */
router.put("/:id", requireAuth, async (req, res) => {
  try {
    const user = req.user;
    const { id } = req.params;

    const doc = await ReportEntry.findOne({ _id: id, ...reportScopeFilter(user) });
    if (!doc) return res.status(404).json({ message: "Entry not found" });

    if (!canUpdateWithin24h(doc)) {
      return res.status(403).json({ message: "Update disabled after 24 hours." });
    }

    const { uom, tat, teamHours, teamCount } = req.body || {};

    const TAT = Number(tat);
    const TH = Number(teamHours);
    const TC = Number(teamCount);

    if (!Number.isFinite(TAT) || TAT < 0) return res.status(400).json({ message: "TAT must be >= 0" });
    if (!Number.isFinite(TH) || TH < 0) return res.status(400).json({ message: "Team Hours must be >= 0" });
    if (!Number.isFinite(TC) || TC < 0) return res.status(400).json({ message: "Team Count must be >= 0" });

    doc.uom = uom !== undefined ? String(uom || "").trim() : doc.uom;
    doc.tat = TAT;
    doc.teamHours = TH;
    doc.teamCount = TC;

    // formulas
    doc.actualCount = TH * TAT;
    doc.actualHours = TAT === 0 ? 0 : TC / TAT;

    await doc.save();
    return res.json({ message: "Updated", row: doc });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ message: e?.message || "Server error" });
  }
});

/**
 * ✅ DELETE /api/report/:id
 * Deletes the entry (no 24-hr lock by default)
 * If you want 24-hr lock for delete also, tell me and I will add it.
 */
router.delete("/:id", requireAuth, async (req, res) => {
  try {
    const user = req.user;
    const { id } = req.params;

    const doc = await ReportEntry.findOne({ _id: id, ...reportScopeFilter(user) }).lean();
    if (!doc) return res.status(404).json({ message: "Entry not found" });

    await ReportEntry.deleteOne({ _id: id });
    return res.json({ message: "Deleted" });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ message: e?.message || "Server error" });
  }
});

export default router;
