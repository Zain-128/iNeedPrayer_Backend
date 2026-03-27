import { Response, NextFunction } from "express";
import { AuthRequest } from "./auth.middleware.js";
import { verifyAccessToken } from "../utils/jwt.util.js";

/** Attaches req.userId when a valid Bearer token is present; always calls next(). */
export const optionalAuth = (
  req: AuthRequest,
  _res: Response,
  next: NextFunction
) => {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token) return next();
  try {
    const { userId } = verifyAccessToken(token);
    req.userId = userId;
  } catch {
    /* ignore invalid token for optional routes */
  }
  next();
};
