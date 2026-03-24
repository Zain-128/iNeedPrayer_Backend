import jwt from "jsonwebtoken";
import { User } from "../models/user.model.js";
import { JWT_SECRET, JWT_EXPIRES_IN, PASSWORD_RESET_CODE } from "../contants.js";

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
  const token = jwt.sign(
    { userId: user._id.toString() },
    JWT_SECRET as jwt.Secret,
    { expiresIn: JWT_EXPIRES_IN } as jwt.SignOptions
  );
  return {
    user: {
      _id: user._id.toString(),
      email: user.email,
      name: user.name,
      createdAt: user.createdAt,
    },
    token,
  };
};

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
  const token = jwt.sign(
    { userId: user._id.toString() },
    JWT_SECRET as jwt.Secret,
    { expiresIn: JWT_EXPIRES_IN } as jwt.SignOptions
  );
  return {
    user: {
      _id: user._id.toString(),
      email: user.email,
      name: user.name,
      createdAt: user.createdAt,
    },
    token,
  };
};

export const getMe = async (userId: string) => {
  const user = await User.findById(userId);
  if (!user) {
    const err = new Error("User not found");
    (err as Error & { statusCode?: number }).statusCode = 404;
    throw err;
  }
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
