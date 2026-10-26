import { Request, Response } from "express";
import * as socialAuthService from "../services/socialAuth.service.js";

export const socialLogin = async (req: Request, res: Response) => {
  try {
    const {
      email,
      name,
      socialId,
      provider,
      socialLoginId,
      socialLoginProvider,
    } = req.body as {
      email?: string;
      name?: string;
      socialId?: string;
      provider?: string;
      socialLoginId?: string;
      socialLoginProvider?: string;
    };
    const result = await socialAuthService.socialLogin({
      email,
      name,
      socialId: socialId || socialLoginId,
      provider: provider || socialLoginProvider,
      socialLoginId: socialLoginId || socialId,
      socialLoginProvider: socialLoginProvider || provider,
    });
    return res.status(200).json(result);
  } catch (err) {
    const e = err as Error & { statusCode?: number };
    const status = e.statusCode ?? 500;
    return res
      .status(status)
      .json({ message: e.message ?? "Social authentication failed" });
  }
};

