import express from 'express';
import Employee from '../models/Employee.js';
import Admin from '../models/Admin.js';
import { requireAuth, employeeScopeFilter } from '../middleware/auth.js';

const router = express.Router();
router.use(requireAuth);

// helper: admin_tl team check
const isTeamAllowedForTL = (user, teamType) => {
  const teams = user?.scope?.teamTypes || [];
  return Array.isArray(teams) && teams.includes(teamType);
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
router.get('/', async (req, res) => {
  try {
    const filter = employeeScopeFilter(req.user);
    const list = await Employee.find(filter).sort({ createdAt: -1 });
    res.json(list);
  } catch (err) {
    res.status(500).json({ message: err.message || 'Failed to fetch employees' });
  }
});

/**
 * POST /api/employees
 */
router.post('/', async (req, res) => {
  try {
    // ✅ enforce TL team scope if admin_tl creates
    if (req.user.role === 'admin_tl') {
      if (req.body.teamType && !isTeamAllowedForTL(req.user, req.body.teamType)) {
        return res.status(403).json({ message: 'Forbidden: team not in scope' });
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

    const emp = await Employee.create(payload);
    res.status(201).json(emp);
  } catch (err) {
    res.status(400).json({ message: err.message || 'Create failed' });
  }
});

/**
 * ✅ REASSIGN OWNER (Admin TL / Super only)
 * PUT /api/employees/:id/reassign
 * body: { newAdminId }
 */
router.put('/:id/reassign', async (req, res) => {
  try {
    const user = req.user;

    if (!user || (user.role !== 'super' && user.role !== 'admin_tl')) {
      return res.status(403).json({ message: 'Forbidden' });
    }

    const { newAdminId } = req.body;
    if (!newAdminId) return res.status(400).json({ message: 'newAdminId required' });

    // ✅ get employee (must be in TL scope if admin_tl)
    const scopeFilter = employeeScopeFilter(user);
    const targetEmp = await Employee.findOne({
      _id: req.params.id,
      ...(user.role === 'super' ? {} : scopeFilter),
    });

    if (!targetEmp) {
      return res.status(404).json({ message: 'Employee not found / out of scope' });
    }

    // ✅ new owner must be an Admin
    const newOwner = await Admin.findById(newAdminId).lean();
    if (!newOwner) return res.status(404).json({ message: 'Target admin not found' });
    if (newOwner.role !== 'admin') {
      return res.status(400).json({ message: 'Only role=admin can be assigned as owner' });
    }

    // ✅ Admin TL can only assign to admin whose team is inside TL scope
    if (user.role === 'admin_tl') {
      const tlTeams = user.scope?.teamTypes || [];
      if (newOwner.allowedTeamType && !tlTeams.includes(newOwner.allowedTeamType)) {
        return res.status(400).json({ message: 'Target admin team not in your TL scope' });
      }
    }

    // ✅ IMPORTANT: keep employee teamType in sync with admin’s allowedTeamType
    if (newOwner.allowedTeamType && targetEmp.teamType !== newOwner.allowedTeamType) {
      targetEmp.teamType = newOwner.allowedTeamType;
    }

    // ✅ Assign ownership
    targetEmp.createdBy = newOwner._id;
    targetEmp.createdByRole = 'admin';
    targetEmp.teamHeadEmail = newOwner.email;

    const saved = await targetEmp.save();
    res.json({ ok: true, employee: saved });
  } catch (err) {
    res.status(400).json({ message: err.message || 'Reassign failed' });
  }
});

/**
 * PUT /api/employees/:id
 */
router.put('/:id', async (req, res) => {
  try {
    const target = await Employee.findById(req.params.id);
    if (!target) return res.status(404).json({ message: 'Employee not found' });

    // ✅ Admin can edit only what they created
    if (req.user.role === 'admin') {
      if (String(target.createdBy) !== String(req.user.sub)) {
        return res.status(403).json({ message: 'Forbidden: not your employee' });
      }
    }

    // ✅ Admin TL can edit only within assigned teams
    if (req.user.role === 'admin_tl') {
      if (!target.teamType || !isTeamAllowedForTL(req.user, target.teamType)) {
        return res.status(403).json({ message: 'Forbidden: team not in scope' });
      }
      // prevent moving outside TL scope
      if (req.body.teamType && !isTeamAllowedForTL(req.user, req.body.teamType)) {
        return res.status(403).json({ message: 'Forbidden: cannot change team outside scope' });
      }
    }

    // ✅ sanitize: prevent changing ownership fields using normal update
    const cleanedBody = sanitizeEmployeeUpdateBody(req.user, req.body);

    const updated = await Employee.findByIdAndUpdate(
      req.params.id,
      cleanedBody,
      { new: true, runValidators: true }
    );

    res.json(updated);
  } catch (err) {
    res.status(400).json({ message: err.message || 'Update failed' });
  }
});

/**
 * DELETE /api/employees/:id
 */
router.delete('/:id', async (req, res) => {
  try {
    const target = await Employee.findById(req.params.id);
    if (!target) return res.status(404).json({ message: 'Employee not found' });

    if (req.user.role === 'admin') {
      if (String(target.createdBy) !== String(req.user.sub)) {
        return res.status(403).json({ message: 'Forbidden: not your employee' });
      }
    }

    if (req.user.role === 'admin_tl') {
      if (!target.teamType || !isTeamAllowedForTL(req.user, target.teamType)) {
        return res.status(403).json({ message: 'Forbidden: team not in scope' });
      }
    }

    await target.deleteOne();
    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ message: err.message || 'Delete failed' });
  }
});

export default router;
