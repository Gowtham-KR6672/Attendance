import jwt from 'jsonwebtoken';
import Admin from '../models/Admin.js';

export const verifyToken = async (token) => {
  if (!token) throw new Error('No token');
  const payload = jwt.verify(token, process.env.JWT_SECRET);
  const user = await Admin.findById(payload.id, { email: 1, role: 1 });
  if (!user) throw new Error('User not found');
  return { _id: user._id.toString(), role: user.role, email: user.email };
};
