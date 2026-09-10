import crypto from "crypto";
import jwt from "jsonwebtoken";
import { User } from "../models/user.model.js";
import {
  JWT_SECRET,
  JWT_REFRESH_SECRET,
  JWT_ACCESS_EXPIRES_IN,
  JWT_REFRESH_EXPIRES_IN,
  PASSWORD_RESET_CODE,
} from "../contants.js";

export interface RegisterInput {
  email: string;
  password: string;
  name: string;
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface AuthResult {
  user: {
    _id: string;
    email: string;
    name: string;
    createdAt: Date;
  };
  token: string;
}

export type SocialLoginInput = {
  email: string;
  socialLoginProvider: string;
  socialLoginId: string;
  name: string;
  profilePicture?: string | null;
};

export type SocialAuthResult = {
  user: {
    _id: string;
    email: string;
    name: string;
    avatar?: string;
    createdAt: Date;
  };
  accessToken: string;
  refreshToken: string;
  /** Same as accessToken — for clients expecting `token`. */
  token: string;
};

const SOCIAL_PROVIDERS = ["google", "apple", "facebook", "twitter"] as const;

function signAccessToken(userId: string): string {
  return jwt.sign(
    { userId, typ: "access" },
    JWT_SECRET as jwt.Secret,
    { expiresIn: JWT_ACCESS_EXPIRES_IN } as jwt.SignOptions
  );
}

function signRefreshToken(userId: string): string {
  return jwt.sign(
    { userId, typ: "refresh" },
    JWT_REFRESH_SECRET as jwt.Secret,
    { expiresIn: JWT_REFRESH_EXPIRES_IN } as jwt.SignOptions
  );
}

function randomPassword(): string {
  return crypto.randomBytes(18).toString("base64url").slice(0, 24);
}

function mapUser(u: {
  _id: { toString(): string };
  email: string;
  name: string;
  createdAt: Date;
  avatar?: string;
}) {
  return {
    _id: u._id.toString(),
    email: u.email,
    name: u.name,
    createdAt: u.createdAt,
  };
}

export const register = async (input: RegisterInput): Promise<AuthResult> => {
  const existing = await User.findOne({ email: input.email.toLowerCase() });
  if (existing) {
    const err = new Error("User already exists with this email");
    (err as Error & { statusCode?: number }).statusCode = 409;
    throw err;
  }
  const user = await User.create({
    email: input.email.toLowerCase(),
    password: input.password,
    name: input.name,
  });
  const token = signAccessToken(user._id.toString());

  const { recordAdminActivity } = await import(
    "./admin/adminActivity.service.js"
  );
  void recordAdminActivity({
    type: "user_registered",
    title: "New user registered",
    message: `${user.name} joined the platform`,
    refType: "user",
    refId: user._id.toString(),
    actorId: user._id.toString(),
  });

  return {
    user: mapUser(user),
    token,
  };
};

function assertNotBlocked(user: { status?: string; deletedAt?: Date | null }) {
  if (user.deletedAt) {
    const err = new Error("Account has been deleted");
    (err as Error & { statusCode?: number }).statusCode = 403;
    throw err;
  }
  if (user.status === "blocked") {
    const err = new Error("Account is blocked");
    (err as Error & { statusCode?: number; code?: string }).statusCode = 403;
    (err as Error & { code?: string }).code = "ACCOUNT_BLOCKED";
    throw err;
  }
}

export const login = async (input: LoginInput): Promise<AuthResult> => {
  const user = await User.findOne({ email: input.email.toLowerCase() }).select(
    "+password"
  );
  if (!user) {
    const err = new Error("Invalid email or password");
    (err as Error & { statusCode?: number }).statusCode = 401;
    throw err;
  }
  const match = await user.comparePassword(input.password);
  if (!match) {
    const err = new Error("Invalid email or password");
    (err as Error & { statusCode?: number }).statusCode = 401;
    throw err;
  }
  assertNotBlocked(user);
  const token = signAccessToken(user._id.toString());
  return {
    user: mapUser(user),
    token,
  };
};

export const socialLogin = async (
  input: SocialLoginInput
): Promise<SocialAuthResult> => {
  const email = input.email?.toLowerCase().trim();
  const name = input.name?.trim();
  const socialLoginId = String(input.socialLoginId ?? "").trim();
  const provider = String(input.socialLoginProvider ?? "")
    .toLowerCase()
    .trim();

  if (!email || !name || !socialLoginId || !provider) {
    const err = new Error(
      "Please provide email, name, socialLoginProvider, and socialLoginId"
    );
    (err as Error & { statusCode?: number }).statusCode = 400;
    throw err;
  }

  if (!SOCIAL_PROVIDERS.includes(provider as (typeof SOCIAL_PROVIDERS)[number])) {
    const err = new Error(
      `socialLoginProvider must be one of: ${SOCIAL_PROVIDERS.join(", ")}`
    );
    (err as Error & { statusCode?: number }).statusCode = 400;
    throw err;
  }

  let user = await User.findOne({
    socialLoginProvider: provider,
    socialLoginId,
  });

  if (user && user.email !== email) {
    const err = new Error("Email does not match this social account");
    (err as Error & { statusCode?: number }).statusCode = 400;
    throw err;
  }

  if (!user) {
    const emailTaken = await User.findOne({ email });
    if (emailTaken) {
      const err = new Error(
        "An account with this email already exists. Sign in with password or use the same social provider."
      );
      (err as Error & { statusCode?: number }).statusCode = 409;
      throw err;
    }

    user = await User.create({
      email,
      password: randomPassword(),
      name,
      avatar: input.profilePicture?.trim() || "",
      socialLoginProvider: provider,
      socialLoginId,
    });

    const { recordAdminActivity } = await import(
      "./admin/adminActivity.service.js"
    );
    void recordAdminActivity({
      type: "user_registered",
      title: "New user registered",
      message: `${user.name} joined via ${provider}`,
      refType: "user",
      refId: user._id.toString(),
      actorId: user._id.toString(),
      meta: { provider },
    });
  }

  assertNotBlocked(user);

  const accessToken = signAccessToken(user._id.toString());
  const refreshToken = signRefreshToken(user._id.toString());

  return {
    user: {
      ...mapUser(user),
      avatar: user.avatar ?? "",
    },
    accessToken,
    refreshToken,
    token: accessToken,
  };
};

export const getMe = async (userId: string) => {
  const user = await User.findById(userId);
  if (!user) {
    const err = new Error("User not found");
    (err as Error & { statusCode?: number }).statusCode = 404;
    throw err;
  }
  assertNotBlocked(user);
  return user;
};

export const forgotPassword = async (
  _email: string
): Promise<{ message: string }> => ({
  message:
    "If this email is registered, you can reset your password using the reset code.",
});

export const resetPassword = async (
  email: string,
  code: string,
  newPassword: string
): Promise<void> => {
  if (!email || !code || !newPassword) {
    const err = new Error("Please provide email, code, and password");
    (err as Error & { statusCode?: number }).statusCode = 400;
    throw err;
  }
  if (newPassword.length < 6) {
    const err = new Error("Password must be at least 6 characters");
    (err as Error & { statusCode?: number }).statusCode = 400;
    throw err;
  }

  const normalizedCode = String(code).trim();
  const user = await User.findOne({
    email: email.toLowerCase().trim(),
  }).select("+password");

  const invalid = new Error("Invalid email or reset code");
  (invalid as Error & { statusCode?: number }).statusCode = 400;

  if (!user || normalizedCode !== PASSWORD_RESET_CODE) {
    throw invalid;
  }

  user.password = newPassword;
  await user.save();
};

export const deleteAccount = async (userId: string): Promise<{ message: string }> => {
  const user = await User.findById(userId);
  if (!user) {
    const err = new Error("User not found");
    (err as Error & { statusCode?: number }).statusCode = 404;
    throw err;
  }
  if (user.deletedAt) {
    const err = new Error("Account is already deleted");
    (err as Error & { statusCode?: number }).statusCode = 400;
    throw err;
  }

  user.deletedAt = new Date();
  user.status = "inactive";
  await user.save();

  const { recordAdminActivity } = await import(
    "./admin/adminActivity.service.js"
  );
  void recordAdminActivity({
    type: "user_deleted",
    title: "User deleted account",
    message: `${user.name} soft-deleted their account`,
    refType: "user",
    refId: userId,
    actorId: userId,
  });

  return { message: "Account deleted successfully" };
};
