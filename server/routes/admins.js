import express from "express";
import bcrypt from "bcryptjs";
import Admin from "../models/Admin.js";
import { requireAuth, requireSuper } from "../middleware/auth.js";

const router = express.Router();

const normEmail = (v) => String(v || "").trim().toLowerCase();
const TEAM_TYPES = ["On Going", "One Time", "FTE"];
const SHIFTS = ["Day Shift", "Night Shift"];
const ROLES = ["super", "admin", "admin_tl"];

const cleanTeamArray = (arr) => {
  if (!Array.isArray(arr)) return [];
  const out = [];
  for (const t of arr) {
    if (TEAM_TYPES.includes(t) && !out.includes(t)) out.push(t);
  }
  return out;
};

// allow super + admin_tl to read transfer targets
const requireSuperOrTL = (req, res, next) => {
  if (!req.user || !["super", "admin_tl"].includes(req.user.role)) {
    return res.status(403).json({ message: "Forbidden" });
  }
  next();
};

router.use(requireAuth);

/**
 * ✅ For Transfer Dropdown
 * GET /api/admins/transfer-targets
 * Super + Admin TL can access (SAFE fields only)
 */
router.get("/transfer-targets", requireSuperOrTL, async (_req, res) => {
  const list = await Admin.find(
    { role: "admin" },
    { passwordHash: 0, password_plain: 0, __v: 0 }
  ).sort({ email: 1 });

  res.json(list);
});

/**
 * =========================
 * SUPER ONLY BELOW THIS
 * =========================
 */
router.use(requireSuper);

// GET /api/admins (super only)
router.get("/", async (_req, res) => {
  const list = await Admin.find({}, { passwordHash: 0 }).sort({ createdAt: -1 });
  res.json(list);
});

// POST /api/admins (super only)
router.post("/", async (req, res) => {
  try {
    const email = normEmail(req.body?.email);
    const password = String(req.body?.password || "");
    const role = String(req.body?.role || "admin");

    if (!email || !password) {
      return res.status(400).json({ message: "Email & password required" });
    }
    if (!ROLES.includes(role)) {
      return res.status(400).json({ message: "Invalid role" });
    }

    const allowedShift = SHIFTS.includes(req.body?.allowedShift)
      ? req.body.allowedShift
      : null;

    let allowedTeamType = null; // legacy single
    let allowedTeamTypes = []; // multi for admin + admin_tl

    // ✅ Admin now supports MULTI team (same as Admin TL)
    if (role === "admin") {
      allowedTeamTypes = cleanTeamArray(req.body?.allowedTeamTypes);
      if (TEAM_TYPES.includes(req.body?.allowedTeamType)) {
        allowedTeamTypes.push(req.body.allowedTeamType);
      }
      allowedTeamTypes = cleanTeamArray(allowedTeamTypes);

      if (!allowedTeamTypes.length) {
        return res
          .status(400)
          .json({ message: "At least 1 team is required for Admin" });
      }

      // keep legacy field in sync (optional)
      allowedTeamType = allowedTeamTypes[0];
    }

    if (role === "admin_tl") {
      allowedTeamTypes = cleanTeamArray(req.body?.allowedTeamTypes);

      // optional support if UI sends allowedTeamType
      if (TEAM_TYPES.includes(req.body?.allowedTeamType)) {
        allowedTeamTypes.push(req.body.allowedTeamType);
      }

      allowedTeamTypes = cleanTeamArray(allowedTeamTypes);

      if (!allowedTeamTypes.length) {
        return res
          .status(400)
          .json({ message: "At least 1 team is required for Admin TL" });
      }
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const doc = await Admin.create({
      email,
      passwordHash,
      role,
      // ✅ store team list for admin + admin_tl
      allowedTeamType: role === "admin" ? allowedTeamType : null, // legacy mirror
      allowedTeamTypes: role === "admin" || role === "admin_tl" ? allowedTeamTypes : [],
      allowedShift: role === "super" ? null : allowedShift,
    });

    const safe = doc.toObject();
    delete safe.passwordHash;

    res.status(201).json(safe);
  } catch (err) {
    res.status(400).json({ message: err.message || "Create failed" });
  }
});

// ✅ PUT /api/admins/:id (super only) + PASSWORD CHANGE IN EDIT
router.put("/:id", async (req, res) => {
  try {
    const role = String(req.body?.role || "admin");
    if (!ROLES.includes(role)) return res.status(400).json({ message: "Invalid role" });

    const target = await Admin.findById(req.params.id);
    if (!target) return res.status(404).json({ message: "Not found" });
    if (target.role === "super") {
      return res.status(403).json({ message: "Cannot edit Super Admin" });
    }

    const allowedShift = SHIFTS.includes(req.body?.allowedShift)
      ? req.body.allowedShift
      : null;

    const update = { role };

    // ✅ CHANGE PASSWORD (optional)
    const newPassword = String(req.body?.newPassword || "").trim();
    if (newPassword) {
      if (newPassword.length < 6) {
        return res
          .status(400)
          .json({ message: "Password must be at least 6 characters" });
      }
      update.passwordHash = await bcrypt.hash(newPassword, 10);
    }

    // ✅ Admin now supports MULTI team
    if (role === "admin") {
      let teams = cleanTeamArray(req.body?.allowedTeamTypes);
      if (TEAM_TYPES.includes(req.body?.allowedTeamType)) teams.push(req.body.allowedTeamType);
      teams = cleanTeamArray(teams);

      if (!teams.length) {
        return res
          .status(400)
          .json({ message: "At least 1 team is required for Admin" });
      }

      update.allowedTeamTypes = teams;
      update.allowedTeamType = teams[0]; // legacy mirror
      update.allowedShift = allowedShift;
    }

    if (role === "admin_tl") {
      let teams = cleanTeamArray(req.body?.allowedTeamTypes);
      if (TEAM_TYPES.includes(req.body?.allowedTeamType)) teams.push(req.body.allowedTeamType);
      teams = cleanTeamArray(teams);

      if (!teams.length) {
        return res
          .status(400)
          .json({ message: "At least 1 team is required for Admin TL" });
      }

      update.allowedTeamType = null;
      update.allowedTeamTypes = teams;
      update.allowedShift = allowedShift;
    }

    if (role === "super") {
      update.allowedTeamType = null;
      update.allowedTeamTypes = [];
      update.allowedShift = null;
    }

    await Admin.findByIdAndUpdate(req.params.id, update, { new: true });

    const saved = await Admin.findById(req.params.id).select("-passwordHash");
    res.json(saved);
  } catch (err) {
    res.status(400).json({ message: err.message || "Update failed" });
  }
});

// DELETE /api/admins/:id (super only)
router.delete("/:id", async (req, res) => {
  const target = await Admin.findById(req.params.id);
  if (!target) return res.status(404).json({ message: "Not found" });
  if (target.role === "super") {
    return res.status(403).json({ message: "Cannot delete Super Admin" });
  }

  await target.deleteOne();
  res.json({ ok: true });
});

export default router;
