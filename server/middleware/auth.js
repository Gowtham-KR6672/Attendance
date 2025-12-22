import jwt from 'jsonwebtoken';
import Employee from '../models/Employee.js';

export const requireAuth = (req, res, next) => {
  const hdr = req.headers.authorization || '';
  const token = hdr.startsWith('Bearer ') ? hdr.slice(7) : null;
  if (!token) return res.status(401).json({ message: 'No token' });

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.user = payload; // { sub, role, scope }
    next();
  } catch {
    res.status(401).json({ message: 'Invalid token' });
  }
};

export const requireSuper = (req, res, next) => {
  if (!req.user || req.user.role !== 'super') {
    return res.status(403).json({ message: 'Forbidden' });
  }
  next();
};

// ✅ Employee scope filter (UPDATED)
export const employeeScopeFilter = (user) => {
  if (!user || user.role === 'super') return {};

  // ✅ Admin: only employees created by that admin
  if (user.role === 'admin') {
    return { createdBy: user.sub };
  }

  // ✅ Admin TL: employees under his allowed teams / shift / list
  if (user.role === 'admin_tl') {
    const scope = user.scope || {};

    // if TL has explicit employee IDs list
    if (Array.isArray(scope.employeeIds) && scope.employeeIds.length) {
      return { _id: { $in: scope.employeeIds } };
    }

    const teams =
      Array.isArray(scope.teamTypes) ? scope.teamTypes :
      (scope.teamType ? [scope.teamType] : []);

    const f = {};
    if (teams.length) f.teamType = { $in: teams };
    if (scope.shift) f.shift = scope.shift;

    return f;
  }

  return {};
};

export const employeeIdsForScope = async (user) => {
  if (!user || user.role === 'super') return null;
  const filter = employeeScopeFilter(user);
  const ids = await Employee.find(filter).distinct('_id');
  return ids;
};
