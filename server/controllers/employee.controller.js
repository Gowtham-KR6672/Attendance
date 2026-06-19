import Employee from "../models/Employee.js";
import Admin from "../models/Admin.js";
import { employeeScopeFilter } from "../middleware/auth.js";

export const reassignEmployeeOwner = async (req, res) => {
  try {
    const user = req.user;
    if (!user || (user.role !== "super" && user.role !== "admin_tl")) {
      return res.status(403).json({ message: "Forbidden" });
    }

    const { id } = req.params;
    const { newAdminId } = req.body;
    if (!newAdminId) return res.status(400).json({ message: "newAdminId required" });

    // employee must be within TL scope (or super)
    const scopeFilter = employeeScopeFilter(user);
    const emp = await Employee.findOne({
      _id: id,
      ...(user.role === "super" ? {} : scopeFilter),
    });
    if (!emp) return res.status(404).json({ message: "Employee not found / out of scope" });

    // target admin must exist and must be admin (not super)
    const target = await Admin.findById(newAdminId).lean();
    if (!target) return res.status(404).json({ message: "Target admin not found" });
    if (target.role !== "admin") {
      return res.status(400).json({ message: "Only Admin role can be assigned as owner" });
    }

    // ✅ Build target admin teams (admin now supports multi)
    const ownerTeams =
      Array.isArray(target.allowedTeamTypes) && target.allowedTeamTypes.length
        ? target.allowedTeamTypes
        : target.allowedTeamType
        ? [target.allowedTeamType] // legacy fallback
        : [];

    // IMPORTANT: ensure TL is allowed to assign into this admin's teams
    if (user.role === "admin_tl") {
      const tlTeams = Array.isArray(user.scope?.teamTypes) ? user.scope.teamTypes : [];

      // 1) admin must have at least one team that TL controls
      if (ownerTeams.length && !ownerTeams.some((t) => tlTeams.includes(t))) {
        return res.status(400).json({ message: "Target admin teams are outside your TL scope" });
      }

      // 2) employee must belong to a team that the selected admin is allowed to own
      if (emp.teamType && ownerTeams.length && !ownerTeams.includes(emp.teamType)) {
        return res
          .status(400)
          .json({ message: "Employee team is not allowed for the selected Admin" });
      }
    }

    // ✅ Recommended: do NOT auto-change employee teamType anymore (safer)
    // If you still want auto-alignment, uncomment ONE of the options below:

    // A) Block mismatch (strict)
    // if (emp.teamType && ownerTeams.length && !ownerTeams.includes(emp.teamType)) {
    //   return res.status(400).json({ message: "Employee teamType must match target admin team list" });
    // }

    // B) Auto-move employee to first allowed team (not recommended)
    // if (emp.teamType && ownerTeams.length && !ownerTeams.includes(emp.teamType)) {
    //   emp.teamType = ownerTeams[0];
    // }

    // Assign ownership
    await Employee.findByIdAndUpdate(
      emp._id,
      {
        createdBy: target._id,
        createdByRole: "admin",
        teamHeadEmail: target.email,
      },
      { new: true, runValidators: true }
    );

    const updated = await Employee.findById(emp._id);
    return res.json({ message: "Employee reassigned", employee: updated });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ message: e?.message || "Server error" });
  }
};
