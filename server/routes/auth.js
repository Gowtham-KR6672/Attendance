import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import Admin from "../models/Admin.js";
import { requireAuth } from "../middleware/auth.js";

const router = express.Router();
const normEmail = (v) => String(v || "").trim().toLowerCase();

const buildScopeFromAdmin = (admin) => {
  if (!admin) return {};
  if (admin.role === "super") return {};

  const teams = new Set();
  (admin.allowedTeamTypes || []).forEach((t) => t && teams.add(t));
  if (admin.allowedTeamType) teams.add(admin.allowedTeamType);

  const teamTypes = Array.from(teams);

  return {
    teamTypes,
    teamType: teamTypes[0] || undefined,
    shift: admin.allowedShift || undefined,
  };
};

// POST /api/auth/login
router.post("/login", async (req, res) => {
  try {
    const email = normEmail(req.body?.email);
    const password = String(req.body?.password || "");

    if (!email || !password) return res.status(400).json({ message: "Email & password required" });

    const admin = await Admin.findOne({ email });
    if (!admin) return res.status(401).json({ message: "Invalid credentials" });

    const ok = await bcrypt.compare(password, admin.passwordHash);
    if (!ok) return res.status(401).json({ message: "Invalid credentials" });

    const scope = buildScopeFromAdmin(admin);

    // ✅ include email inside token
    const token = jwt.sign(
      {
        id: admin._id.toString(),
        sub: admin._id.toString(),
        role: admin.role,
        email: admin.email, // ✅ REQUIRED FOR REPORT
        scope,
      },
      process.env.JWT_SECRET,
      { expiresIn: "2d" }
    );

    res.json({
      token,
      role: admin.role,
      scope,
      id: admin._id.toString(),
      email: admin.email,
    });
  } catch (err) {
    res.status(500).json({ message: err?.message || "Server error" });
  }
});

// GET /api/auth/me
router.get("/me", requireAuth, async (req, res) => {
  try {
    const myId = req.user?.id || req.user?.sub || req.user?._id;
    const admin = await Admin.findById(myId).lean();
    if (!admin) return res.status(404).json({ message: "Not found" });

    const scope = buildScopeFromAdmin(admin);

    res.json({
      email: admin.email,
      role: admin.role,
      scope,
      id: admin._id.toString(),
    });
  } catch (err) {
    res.status(500).json({ message: err?.message || "Server error" });
  }
});

// GET /api/auth/has-super
router.get("/has-super", requireAuth, (req, res) => {
  res.json({ ok: true, isSuper: req.user?.role === "super" });
});

export default router;
