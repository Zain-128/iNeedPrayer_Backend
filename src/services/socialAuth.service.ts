import jwt from "jsonwebtoken";
import crypto from "crypto";
import { User } from "../models/user.model.js";
import { JWT_SECRET, JWT_EXPIRES_IN } from "../contants.js";
import type { AuthResult } from "./auth.service.js";

const signToken = (userId: string) =>
  jwt.sign({ userId: userId.toString() }, JWT_SECRET, {
    expiresIn: JWT_EXPIRES_IN as any,
  });

const formatResult = (
  user: any
) => {
  const token = signToken(user._id.toString());
  return {
    message: "User login successfully",
    user: {
      _id: user._id.toString(),
      email: user.email,
      name: user.name,
      avatar: user.avatar || "",
      createdAt: user.createdAt,
    },
    token,
    accessToken: token,
    socialId: user.socialId,
    provider: user.provider,
  };
};

interface SocialLoginInput {
  email?: string;
  name?: string;
  socialId?: string;
  provider?: string;
  socialLoginId?: string;
  socialLoginProvider?: string;
}

export const socialLogin = async ({
  email,
  name,
  socialId,
  provider,
  socialLoginId,
  socialLoginProvider,
}: SocialLoginInput): Promise<any> => {
  const actualSocialId = socialId || socialLoginId;
  const actualProvider = provider || socialLoginProvider;

  if (!email || !actualSocialId || !actualProvider) {
    const err = new Error("email, socialId and provider are required");
    (err as Error & { statusCode?: number }).statusCode = 400;
    throw err;
  }

  const normalizedEmail = email.toLowerCase();

  let user = await User.findOne({
    $or: [{ socialId: actualSocialId, provider: actualProvider }, { email: normalizedEmail }],
  });

  if (!user) {
    user = await User.create({
      email: normalizedEmail,
      password: crypto.randomUUID(),
      name: name || normalizedEmail.split("@")[0],
      socialId: actualSocialId,
      provider: actualProvider,
    });
  } else {
    // optional: attach provider/socialId if missing on existing user
    if (!user.socialId || !user.provider) {
      user.socialId = actualSocialId;
      user.provider = actualProvider;
      await user.save();
    }
  }

  return formatResult(user);
};
