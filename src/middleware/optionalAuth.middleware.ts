import { Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { JWT_SECRET } from "../contants.js";
import { AuthRequest } from "./auth.middleware.js";

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
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: string };
    req.userId = decoded.userId;
  } catch {
    /* ignore invalid token for optional routes */
  }
  next();
};
