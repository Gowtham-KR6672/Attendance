import Employee from '../models/Employee.js';
import Admin from '../models/Admin.js';
import { employeeScopeFilter } from '../middleware/auth.js';

export const reassignEmployeeOwner = async (req, res) => {
  try {
    const user = req.user;
    if (!user || (user.role !== 'super' && user.role !== 'admin_tl')) {
      return res.status(403).json({ message: 'Forbidden' });
    }

    const { id } = req.params;
    const { newAdminId } = req.body;
    if (!newAdminId) return res.status(400).json({ message: 'newAdminId required' });

    // employee must be within TL scope (or super)
    const scopeFilter = employeeScopeFilter(user);
    const emp = await Employee.findOne({ _id: id, ...(user.role === 'super' ? {} : scopeFilter) });
    if (!emp) return res.status(404).json({ message: 'Employee not found / out of scope' });

    // target admin must exist and must be admin (not super)
    const target = await Admin.findById(newAdminId);
    if (!target) return res.status(404).json({ message: 'Target admin not found' });
    if (target.role !== 'admin') {
      return res.status(400).json({ message: 'Only Admin role can be assigned as owner' });
    }

    // IMPORTANT: ensure TL is allowed to assign into this admin's team
    // (Admin has single allowedTeamType; TL has multiple teamTypes)
    if (user.role === 'admin_tl') {
      const tlTeams = user.scope?.teamTypes || [];
      if (target.allowedTeamType && !tlTeams.includes(target.allowedTeamType)) {
        return res.status(400).json({ message: 'Target admin team not in your TL scope' });
      }
    }

    // OPTIONAL SAFETY:
    // If employee.teamType doesn't match target admin allowedTeamType,
    // you can either block or auto-update.
    if (target.allowedTeamType && emp.teamType !== target.allowedTeamType) {
      // Choose ONE:
      // A) block:
      // return res.status(400).json({ message: 'Employee teamType must match target admin team' });

      // B) auto-move employee to that team:
      emp.teamType = target.allowedTeamType;
    }

    // Assign ownership
    emp.createdBy = target._id;
    emp.createdByRole = target.role;
    emp.teamHeadEmail = target.email;

    await emp.save();

    return res.json({ message: 'Employee reassigned', employee: emp });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ message: 'Server error' });
  }
};
