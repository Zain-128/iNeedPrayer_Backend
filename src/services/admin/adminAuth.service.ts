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

/** Ops helper: create a new admin account (or upgrade existing email to admin). */
export async function createAdmin(input: {
  email: string;
  password: string;
  name: string;
  role?: string;
}) {
  const email = input.email.toLowerCase().trim();
  const password = input.password;
  const name = input.name.trim();
  const roleRaw = (input.role ?? "admin").toLowerCase().trim();

  if (!email || !password || !name) {
    throw httpError("email, password, name, and role are required", 400);
  }
  if (roleRaw !== "admin") {
    throw httpError('role must be "admin"', 400);
  }
  if (password.length < 6) {
    throw httpError("Password must be at least 6 characters", 400);
  }

  const role = "admin" as const;

  const existing = await User.findOne({ email }).select("+password");
  if (existing) {
    if (existing.role === "admin") {
      throw httpError("Admin with this email already exists", 409);
    }
    existing.name = name;
    existing.password = password;
    existing.role = role;
    existing.status = "active";
    existing.blockedReason = "";
    existing.blockedAt = null;
    await existing.save();
    return { admin: mapAdmin(existing), created: false, upgraded: true };
  }

  const user = await User.create({
    email,
    password,
    name,
    role,
    status: "active",
  });

  return { admin: mapAdmin(user), created: true, upgraded: false };
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
