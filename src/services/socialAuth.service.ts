import jwt from "jsonwebtoken";
import crypto from "crypto";
import { User } from "../models/user.model.js";
import { JWT_SECRET, JWT_EXPIRES_IN } from "../contants.js";
import type { AuthResult } from "./auth.service.js";

const signToken = (userId: string) =>
  jwt.sign({ userId: userId.toString() }, JWT_SECRET, {
    expiresIn: JWT_EXPIRES_IN,
  });

const formatResult = (
  user: any
): AuthResult & { socialId?: string } => ({
  user: {
    _id: user._id.toString(),
    email: user.email,
    name: user.name,
    createdAt: user.createdAt,
  },
  token: signToken(user._id.toString()),
  socialId: user.googleId ?? user.appleId,
});

interface SocialLoginInput {
  email?: string;
  name?: string;
  socialId?: string;
}

export const googleLogin = async ({
  email,
  name,
  socialId,
}: SocialLoginInput): Promise<AuthResult> => {
  if (!email || !socialId) {
    const err = new Error("email and socialId are required");
    (err as Error & { statusCode?: number }).statusCode = 400;
    throw err;
  }

  const normalizedEmail = email.toLowerCase();

  let user = await User.findOne({
    $or: [{ googleId: socialId }, { email: normalizedEmail }],
  });

  if (!user) {
    user = await User.create({
      email: normalizedEmail,
      password: crypto.randomUUID(),
      name: name || normalizedEmail.split("@")[0],
      googleId: socialId,
    });
  }

  return formatResult(user);
};

export const appleLogin = async ({
  email,
  name,
  socialId,
}: SocialLoginInput): Promise<AuthResult> => {
  if (!email || !socialId) {
    const err = new Error("email and socialId are required");
    (err as Error & { statusCode?: number }).statusCode = 400;
    throw err;
  }

  const normalizedEmail = email.toLowerCase();

  let user = await User.findOne({
    $or: [{ appleId: socialId }, { email: normalizedEmail }],
  });

  if (!user) {
    user = await User.create({
      email: normalizedEmail,
      password: crypto.randomUUID(),
      name: name || normalizedEmail.split("@")[0],
      appleId: socialId,
    });
  }

  return formatResult(user);
};

