import { Request, Response } from "express";
import * as authService from "../services/auth.service.js";
import { AuthRequest } from "../middleware/auth.middleware.js";

export const register = async (req: Request, res: Response) => {
  try {
    const { email, password, name } = req.body;
    if (!email || !password || !name) {
      return res.status(400).json({
        message: "Please provide email, password, and name",
      });
    }
    const result = await authService.register({ email, password, name });
    return res.status(201).json(result);
  } catch (err) {
    const e = err as Error & { statusCode?: number };
    const status = e.statusCode ?? 500;
    return res.status(status).json({ message: e.message ?? "Registration failed" });
  }
};

export const login = async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({
        message: "Please provide email and password",
      });
    }
    const result = await authService.login({ email, password });
    return res.status(200).json(result);
  } catch (err) {
    const e = err as Error & { statusCode?: number };
    const status = e.statusCode ?? 500;
    return res.status(status).json({ message: e.message ?? "Login failed" });
  }
};

export const getMe = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.userId) {
      return res.status(401).json({ message: "Not authorized" });
    }
    const user = await authService.getMe(req.userId);
    return res.status(200).json({ user });
  } catch (err) {
    const e = err as Error & { statusCode?: number };
    const status = e.statusCode ?? 500;
    return res.status(status).json({ message: e.message ?? "Failed to get user" });
  }
};

export const forgotPassword = async (req: Request, res: Response) => {
  try {
    const { email } = req.body;
    if (!email || typeof email !== "string") {
      return res.status(400).json({ message: "Please provide email" });
    }
    const result = await authService.forgotPassword(email);
    return res.status(200).json(result);
  } catch (err) {
    const e = err as Error & { statusCode?: number };
    const status = e.statusCode ?? 500;
    return res
      .status(status)
      .json({ message: e.message ?? "Failed to process request" });
  }
};

export const resetPassword = async (req: Request, res: Response) => {
  try {
    const { email, code, password } = req.body;
    if (!email || code === undefined || code === null || !password) {
      return res.status(400).json({
        message: "Please provide email, code, and password",
      });
    }
    await authService.resetPassword(email, String(code), password);
    return res.status(200).json({ message: "Password has been reset" });
  } catch (err) {
    const e = err as Error & { statusCode?: number };
    const status = e.statusCode ?? 500;
    return res
      .status(status)
      .json({ message: e.message ?? "Password reset failed" });
  }
};
