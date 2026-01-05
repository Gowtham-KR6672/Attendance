import express from "express";
import Employee from "../models/Employee.js";
import Admin from "../models/Admin.js";
import { requireAuth, employeeScopeFilter } from "../middleware/auth.js";

const router = express.Router();
router.use(requireAuth);

const TEAM_TYPES = ["On Going", "One Time", "FTE"];

// helper: admin_tl team check
const isTeamAllowedForTL = (user, teamType) => {
  const teams = user?.scope?.teamTypes || [];
  return Array.isArray(teams) && teams.includes(teamType);
};

// helper: admin team check (admin now can have multiple teams)
const isTeamAllowedForAdmin = (adminDoc, teamType) => {
  if (!teamType) return false;

  // prefer multi
  const teams = Array.isArray(adminDoc?.allowedTeamTypes) ? adminDoc.allowedTeamTypes : [];
  if (teams.length) return teams.includes(teamType);

  // legacy single
  if (adminDoc?.allowedTeamType) return adminDoc.allowedTeamType === teamType;

  return false;
};

// helper: remove forbidden fields from update body
const sanitizeEmployeeUpdateBody = (_user, body) => {
  const cleaned = { ...body };

  // nobody can change these via normal PUT
  delete cleaned.createdBy;
  delete cleaned.createdByRole;
  delete cleaned.teamHeadEmail;

  return cleaned;
};

/**
 * GET /api/employees
 */
router.get("/", async (req, res) => {
  try {
    const filter = employeeScopeFilter(req.user);
    const list = await Employee.find(filter).sort({ createdAt: -1 });
    res.json(list);
  } catch (err) {
    res.status(500).json({ message: err.message || "Failed to fetch employees" });
  }
});

/**
 * POST /api/employees
 */
router.post("/", async (req, res) => {
  try {
    // ✅ enforce TL team scope if admin_tl creates
    if (req.user.role === "admin_tl") {
      if (req.body.teamType && !isTeamAllowedForTL(req.user, req.body.teamType)) {
        return res.status(403).json({ message: "Forbidden: team not in scope" });
      }
    }

    // ✅ enforce Admin team scope if admin creates (optional but safer)
    if (req.user.role === "admin") {
      const me = await Admin.findById(req.user.sub).lean();
      if (!me) return res.status(401).json({ message: "Unauthorized" });

      if (req.body.teamType && !isTeamAllowedForAdmin(me, req.body.teamType)) {
        return res.status(403).json({ message: "Forbidden: team not in your scope" });
      }
    }

    // ✅ read admin email for UX field
    const me = await Admin.findById(req.user.sub).lean();
    const teamHeadEmail = me?.email || null;

    const payload = {
      ...req.body,
      createdBy: req.user.sub,
      createdByRole: req.user.role,
      teamHeadEmail,
    };

    // Optional: validate teamType value
    if (payload.teamType && !TEAM_TYPES.includes(payload.teamType)) {
      return res.status(400).json({ message: "Invalid teamType" });
    }

    const emp = await Employee.create(payload);
    res.status(201).json(emp);
  } catch (err) {
    res.status(400).json({ message: err.message || "Create failed" });
  }
});

/**
 * ✅ REASSIGN OWNER (Admin TL / Super only)
 * PUT /api/employees/:id/reassign
 * body: { newAdminId }
 */
router.put("/:id/reassign", async (req, res) => {
  try {
    const user = req.user;

    if (!user || (user.role !== "super" && user.role !== "admin_tl")) {
      return res.status(403).json({ message: "Forbidden" });
    }

    const { newAdminId } = req.body;
    if (!newAdminId) return res.status(400).json({ message: "newAdminId required" });

    // ✅ get employee (must be in TL scope if admin_tl)
    const scopeFilter = employeeScopeFilter(user);
    const targetEmp = await Employee.findOne({
      _id: req.params.id,
      ...(user.role === "super" ? {} : scopeFilter),
    });

    if (!targetEmp) {
      return res.status(404).json({ message: "Employee not found / out of scope" });
    }

    // ✅ new owner must be an Admin
    const newOwner = await Admin.findById(newAdminId).lean();
    if (!newOwner) return res.status(404).json({ message: "Target admin not found" });
    if (newOwner.role !== "admin") {
      return res.status(400).json({ message: "Only role=admin can be assigned as owner" });
    }

    // ✅ Admin TL rules:
    // 1) selected admin must be within TL scope (intersection check)
    // 2) employee team must be allowed for selected admin
    if (user.role === "admin_tl") {
      const tlTeams = Array.isArray(user.scope?.teamTypes) ? user.scope.teamTypes : [];

      const ownerTeams = Array.isArray(newOwner.allowedTeamTypes) && newOwner.allowedTeamTypes.length
        ? newOwner.allowedTeamTypes
        : newOwner.allowedTeamType
        ? [newOwner.allowedTeamType]
        : [];

      // admin must have at least one team that TL controls
      if (ownerTeams.length && !ownerTeams.some((t) => tlTeams.includes(t))) {
        return res.status(400).json({ message: "Target admin teams are outside your TL scope" });
      }

      // employee must match selected admin team list
      if (targetEmp.teamType && ownerTeams.length && !ownerTeams.includes(targetEmp.teamType)) {
        return res
          .status(400)
          .json({ message: "Employee team is not allowed for the selected Admin" });
      }
    }

    // ✅ (Recommended) DO NOT auto-change employee teamType anymore.
    // If you still want auto-alignment, uncomment below:
    // const ownerTeams = Array.isArray(newOwner.allowedTeamTypes) && newOwner.allowedTeamTypes.length
    //   ? newOwner.allowedTeamTypes
    //   : (newOwner.allowedTeamType ? [newOwner.allowedTeamType] : []);
    // if (ownerTeams.length && targetEmp.teamType !== ownerTeams[0]) {
    //   targetEmp.teamType = ownerTeams[0];
    // }

    // ✅ Assign ownership
    targetEmp.createdBy = newOwner._id;
    targetEmp.createdByRole = "admin";
    targetEmp.teamHeadEmail = newOwner.email;

    const saved = await targetEmp.save();
    res.json({ ok: true, employee: saved });
  } catch (err) {
    res.status(400).json({ message: err.message || "Reassign failed" });
  }
});

/**
 * PUT /api/employees/:id
 */
router.put("/:id", async (req, res) => {
  try {
    const target = await Employee.findById(req.params.id);
    if (!target) return res.status(404).json({ message: "Employee not found" });

    // ✅ Admin can edit only what they created
    if (req.user.role === "admin") {
      if (String(target.createdBy) !== String(req.user.sub)) {
        return res.status(403).json({ message: "Forbidden: not your employee" });
      }

      // prevent admin from changing to a team outside their allowed list
      if (req.body.teamType) {
        const me = await Admin.findById(req.user.sub).lean();
        if (!me) return res.status(401).json({ message: "Unauthorized" });

        if (!isTeamAllowedForAdmin(me, req.body.teamType)) {
          return res.status(403).json({ message: "Forbidden: cannot change team outside scope" });
        }
      }
    }

    // ✅ Admin TL can edit only within assigned teams
    if (req.user.role === "admin_tl") {
      if (!target.teamType || !isTeamAllowedForTL(req.user, target.teamType)) {
        return res.status(403).json({ message: "Forbidden: team not in scope" });
      }
      // prevent moving outside TL scope
      if (req.body.teamType && !isTeamAllowedForTL(req.user, req.body.teamType)) {
        return res.status(403).json({ message: "Forbidden: cannot change team outside scope" });
      }
    }

    // ✅ sanitize: prevent changing ownership fields using normal update
    const cleanedBody = sanitizeEmployeeUpdateBody(req.user, req.body);

    // Optional: validate teamType value
    if (cleanedBody.teamType && !TEAM_TYPES.includes(cleanedBody.teamType)) {
      return res.status(400).json({ message: "Invalid teamType" });
    }

    const updated = await Employee.findByIdAndUpdate(req.params.id, cleanedBody, {
      new: true,
      runValidators: true,
    });

    res.json(updated);
  } catch (err) {
    res.status(400).json({ message: err.message || "Update failed" });
  }
});

/**
 * DELETE /api/employees/:id
 */
router.delete("/:id", async (req, res) => {
  try {
    const target = await Employee.findById(req.params.id);
    if (!target) return res.status(404).json({ message: "Employee not found" });

    if (req.user.role === "admin") {
      if (String(target.createdBy) !== String(req.user.sub)) {
        return res.status(403).json({ message: "Forbidden: not your employee" });
      }
    }

    if (req.user.role === "admin_tl") {
      if (!target.teamType || !isTeamAllowedForTL(req.user, target.teamType)) {
        return res.status(403).json({ message: "Forbidden: team not in scope" });
      }
    }

    await target.deleteOne();
    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ message: err.message || "Delete failed" });
  }
});

export default router;
