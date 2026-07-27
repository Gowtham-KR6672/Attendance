import express from "express";
import Process from "../models/Process.js";
import ProcessEntry from "../models/ProcessEntry.js";
import { requireAuth } from "../middleware/auth.js";

const router = express.Router();
router.use(requireAuth);

// ===============================
// ✅ Processes
// ===============================

// GET /api/processes
router.get("/", async (_req, res) => {
  const rows = await Process.find().sort({ createdAt: -1 });
  res.json(rows);
});

// POST /api/processes  { name }
router.post("/", async (req, res) => {
  const name = String(req.body?.name || "").trim();
  if (!name) return res.status(400).json({ message: "Process name required" });

  const exists = await Process.findOne({ name });
  if (exists) return res.status(409).json({ message: "Process already exists" });

  const row = await Process.create({
    name,
    headers: [],
    createdBy: req.user?._id,
    chart: {
      type: "bar",
      xField: "",
      yField: "",
      color: "#111827",
      title: "",
      showLegend: true,
    },
  });

  res.json({ ok: true, process: row });
});

// PUT /api/processes/:id/headers   { headers: [...] }
router.put("/:id/headers", async (req, res) => {
  const { id } = req.params;
  const headers = Array.isArray(req.body?.headers) ? req.body.headers : [];
  if (!headers.length)
    return res.status(400).json({ message: "At least 1 header required" });

  const clean = headers
    .map((h) => ({
      key: String(h.key || "").trim(),
      label: String(h.label || "").trim(),
      type: String(h.type || "text").trim(),
      formula: String(h.formula || "").trim(),
    }))
    .filter((h) => h.key && h.label);

  if (!clean.length) return res.status(400).json({ message: "Invalid headers" });

  // validate formula type
  for (const h of clean) {
    if (h.type === "formula" && !String(h.formula || "").trim()) {
      return res
        .status(400)
        .json({ message: `Formula required for "${h.label}"` });
    }
  }

  const row = await Process.findById(id);
  if (!row) return res.status(404).json({ message: "Process not found" });

  row.headers = clean;
  row.headerVersion = (row.headerVersion || 1) + 1; // ✅ bump version
  await row.save();

  res.json({ ok: true, process: row });
});

// ===============================
// ✅ Chart Settings (Save / Get)
// ===============================

// GET /api/processes/:id/chart
router.get("/:id/chart", async (req, res) => {
  const { id } = req.params;
  const proc = await Process.findById(id, { chart: 1, name: 1 });
  if (!proc) return res.status(404).json({ message: "Process not found" });
  res.json({ ok: true, chart: proc.chart || null });
});

// PUT /api/processes/:id/chart
router.put("/:id/chart", async (req, res) => {
  const { id } = req.params;
  const { type, xField, yField, color, title, showLegend } = req.body || {};

  const proc = await Process.findById(id);
  if (!proc) return res.status(404).json({ message: "Process not found" });

  proc.chart = {
    type: String(type || proc.chart?.type || "bar"),
    xField: String(xField || proc.chart?.xField || ""),
    yField: String(yField || proc.chart?.yField || ""),
    color: String(color || proc.chart?.color || "#111827"),
    title: String(title || proc.chart?.title || ""),
    showLegend: showLegend === false ? false : true,
  };

  await proc.save();
  res.json({ ok: true, process: proc });
});

// DELETE /api/processes/:id  (also deletes all entries)
router.delete("/:id", async (req, res) => {
  const { id } = req.params;

  const proc = await Process.findById(id);
  if (!proc) return res.status(404).json({ message: "Process not found" });

  // optional: only super/admin can delete
  // if (req.user?.role !== "super") return res.status(403).json({ message: "Forbidden" });

  await ProcessEntry.deleteMany({ processId: id });
  await Process.deleteOne({ _id: id });

  res.json({ ok: true });
});


// ===============================
// ✅ Export endpoints (JSON)
// ===============================

// GET /api/processes/:id/export  (single process + entries)
router.get("/:id/export", async (req, res) => {
  const { id } = req.params;

  const proc = await Process.findById(id);
  if (!proc) return res.status(404).json({ message: "Process not found" });

  const entries = await ProcessEntry.find({ processId: id }).sort({ createdAt: 1 });

  res.json({ ok: true, process: proc, entries });
});

// GET /api/processes/export/all   (all processes + entries)
router.get("/export/all", async (_req, res) => {
  const processes = await Process.find().sort({ createdAt: -1 });

  const out = [];
  for (const p of processes) {
    const entries = await ProcessEntry.find({ processId: p._id }).sort({ createdAt: 1 });
    out.push({ process: p, entries });
  }

  res.json({ ok: true, data: out });
});

// ===============================
// ✅ Entries
// ===============================

// GET /api/processes/:id/entries
router.get("/:id/entries", async (req, res) => {
  const { id } = req.params;
  const rows = await ProcessEntry.find({ processId: id }).sort({ createdAt: 1 });
  res.json(rows);
});

// POST /api/processes/:id/entries  { values }
router.post("/:id/entries", async (req, res) => {
  const { id } = req.params;

  const proc = await Process.findById(id);
  if (!proc) return res.status(404).json({ message: "Process not found" });

  const values =
    req.body?.values && typeof req.body.values === "object" ? req.body.values : {};

  const row = await ProcessEntry.create({
    processId: id,
    values,
    createdBy: req.user?._id,
  });

  res.json({ ok: true, entry: row });
});

// PUT /api/processes/:id/entries/:entryId  { values }
router.put("/:id/entries/:entryId", async (req, res) => {
  const { id, entryId } = req.params;
  const values =
    req.body?.values && typeof req.body.values === "object" ? req.body.values : {};

  const row = await ProcessEntry.findOneAndUpdate(
    { _id: entryId, processId: id },
    { $set: { values } },
    { new: true }
  );
  if (!row) return res.status(404).json({ message: "Entry not found" });

  res.json({ ok: true, entry: row });
});

// DELETE /api/processes/:id/entries/:entryId
router.delete("/:id/entries/:entryId", async (req, res) => {
  const { id, entryId } = req.params;
  const row = await ProcessEntry.findOneAndDelete({ _id: entryId, processId: id });
  if (!row) return res.status(404).json({ message: "Entry not found" });
  res.json({ ok: true });
});

export default router;
