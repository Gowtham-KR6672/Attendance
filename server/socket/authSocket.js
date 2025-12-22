import jwt from "jsonwebtoken";
import Admin from "../models/Admin.js";

export async function verifySocketToken(token) {
  if (!token) throw new Error("No token");
  if (!process.env.JWT_SECRET) throw new Error("JWT_SECRET missing");

  let payload;
  try {
    payload = jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    throw new Error("Invalid token");
  }

  // ✅ your login token uses { sub: admin._id }
  const id =
    payload?.sub ||
    payload?.id ||
    payload?._id ||
    payload?.adminId ||
    payload?.userId;

  if (!id) throw new Error("Token has no user id");

  const user = await Admin.findById(id, { email: 1, role: 1 });
  if (!user) throw new Error("User not found");

  return {
    _id: user._id.toString(),
    email: user.email,
    role: user.role,
  };
}
