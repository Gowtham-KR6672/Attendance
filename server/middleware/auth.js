import jwt from "jsonwebtoken";
import Employee from "../models/Employee.js";

export const requireAuth = (req, res, next) => {
  const hdr = req.headers.authorization || "";
  const token = hdr.startsWith("Bearer ") ? hdr.slice(7) : null;
  if (!token) return res.status(401).json({ message: "No token" });

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.user = payload; // { sub, role, scope, email }
    next();
  } catch {
    return res.status(401).json({ message: "Invalid token" });
  }
};

export const requireSuper = (req, res, next) => {
  if (!req.user || req.user.role !== "super") {
    return res.status(403).json({ message: "Forbidden" });
  }
  next();
};

/**
 * Employee scope filter
 * - super     -> all
 * - admin     -> only employees createdBy this admin
 * - admin_tl  -> within TL scope
 */
export const employeeScopeFilter = (user) => {
  if (!user || user.role === "super") return {};

  const scope = user.scope || {};

  if (user.role === "admin") {
    return { createdBy: user.sub };
  }

  if (user.role === "admin_tl") {
    if (Array.isArray(scope.employeeIds) && scope.employeeIds.length) {
      return { _id: { $in: scope.employeeIds } };
    }

    const teams = Array.isArray(scope.teamTypes)
      ? scope.teamTypes
      : scope.teamType
      ? [scope.teamType]
      : [];

    const f = {};
    if (teams.length) f.teamType = { $in: teams };
    if (scope.shift) f.shift = scope.shift;

    return f;
  }

  return {};
};

export const employeeIdsForScope = async (user) => {
  if (!user || user.role === "super") return null;
  const filter = employeeScopeFilter(user);
  const ids = await Employee.find(filter).distinct("_id");
  return ids;
};
