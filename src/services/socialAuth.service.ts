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
): AuthResult & { socialId?: string; provider?: string } => ({
  user: {
    _id: user._id.toString(),
    email: user.email,
    name: user.name,
    createdAt: user.createdAt,
  },
  token: signToken(user._id.toString()),
  socialId: user.socialId,
  provider: user.provider,
});

interface SocialLoginInput {
  email?: string;
  name?: string;
  socialId?: string;
  provider?: string;
}

export const socialLogin = async ({
  email,
  name,
  socialId,
  provider,
}: SocialLoginInput): Promise<AuthResult> => {
  if (!email || !socialId || !provider) {
    const err = new Error("email, socialId and provider are required");
    (err as Error & { statusCode?: number }).statusCode = 400;
    throw err;
  }

  const normalizedEmail = email.toLowerCase();

  let user = await User.findOne({
    $or: [{ socialId, provider }, { email: normalizedEmail }],
  });

  if (!user) {
    user = await User.create({
      email: normalizedEmail,
      password: crypto.randomUUID(),
      name: name || normalizedEmail.split("@")[0],
      socialId,
      provider,
    });
  } else {
    // optional: attach provider/socialId if missing on existing user
    if (!user.socialId || !user.provider) {
      user.socialId = socialId;
      user.provider = provider;
      await user.save();
    }
  }

  return formatResult(user);
};
