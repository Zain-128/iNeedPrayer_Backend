import { Request, Response } from "express";
import * as socialAuthService from "../services/socialAuth.service.js";

export const googleLogin = async (req: Request, res: Response) => {
  try {
    const { email, name, socialId } = req.body as {
      email?: string;
      name?: string;
      socialId?: string;
    };
    const result = await socialAuthService.googleLogin({
      email,
      name,
      socialId,
    });
    return res.status(200).json(result);
  } catch (err) {
    const e = err as Error & { statusCode?: number };
    const status = e.statusCode ?? 500;
    return res
      .status(status)
      .json({ message: e.message ?? "Google authentication failed" });
  }
};

export const appleLogin = async (req: Request, res: Response) => {
  try {
    const { email, name, socialId } = req.body as {
      email?: string;
      name?: string;
      socialId?: string;
    };
    const result = await socialAuthService.appleLogin({
      email,
      name,
      socialId,
    });
    return res.status(200).json(result);
  } catch (err) {
    const e = err as Error & { statusCode?: number };
    const status = e.statusCode ?? 500;
    return res
      .status(status)
      .json({ message: e.message ?? "Apple authentication failed" });
  }
};

