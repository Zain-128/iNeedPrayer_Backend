import { User } from "../../models/user.model.js";
import { httpError } from "./admin.helpers.js";
import jwt from "jsonwebtoken";
import { JWT_SECRET, JWT_ACCESS_EXPIRES_IN } from "../../contants.js";

function signAdminToken(userId: string) {
  return jwt.sign(
    { userId, typ: "access", role: "admin" },
    JWT_SECRET as jwt.Secret,
    { expiresIn: JWT_ACCESS_EXPIRES_IN } as jwt.SignOptions
  );
}

function mapAdmin(u: {
  _id: { toString(): string };
  email: string;
  name: string;
  avatar?: string;
  role: string;
}) {
  return {
    id: u._id.toString(),
    name: u.name,
    email: u.email,
    avatar: u.avatar ?? "",
    role: u.role,
  };
}

export async function adminLogin(email: string, password: string) {
  const user = await User.findOne({ email: email.toLowerCase().trim() }).select(
    "+password"
  );
  if (!user) throw httpError("Invalid email or password", 401);

  const ok = await user.comparePassword(password);
  if (!ok) throw httpError("Invalid email or password", 401);

  if (user.role !== "admin") throw httpError("Admin access required", 403);
  if (user.status === "blocked") throw httpError("Account is blocked", 403);

  const token = signAdminToken(user._id.toString());
  return {
    token,
    admin: mapAdmin(user),
  };
}

export async function getAdminMe(userId: string) {
  const user = await User.findById(userId);
  if (!user || user.role !== "admin") throw httpError("Admin not found", 404);
  return mapAdmin(user);
}

/** One-time / ops helper: promote an existing user to admin by email. */
export async function promoteToAdmin(email: string) {
  const user = await User.findOne({ email: email.toLowerCase().trim() });
  if (!user) throw httpError("User not found", 404);
  user.role = "admin";
  user.status = "active";
  await user.save();
  return mapAdmin(user);
}

export async function adminLogout() {
  return { message: "Logged out" };
}

export async function adminForgotPassword(email: string) {
  return {
    message:
      "If this admin email is registered, you can reset your password using the reset code.",
  };
}

export async function adminResetPassword(
  email: string,
  code: string,
  newPassword: string
) {
  const { resetPassword } = await import("../auth.service.js");
  const user = await User.findOne({ email: email.toLowerCase().trim() });
  if (!user || user.role !== "admin") {
    throw httpError("Invalid email or reset code", 400);
  }
  await resetPassword(email, code, newPassword);
  return { message: "Password has been reset" };
}
