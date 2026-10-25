import mongoose from "mongoose";
import { Response } from "express";
import { AuthRequest } from "../middleware/auth.middleware.js";
import * as usersService from "../services/users.service.js";

function handleError(res: Response, err: unknown) {
  const e = err as Error & { statusCode?: number };
  return res.status(e.statusCode ?? 500).json({ message: e.message });
}

export const checkBlockStatus = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.userId) return res.status(401).json({ message: "Unauthorized" });
    const userId =
      typeof req.query.userId === "string" ? req.query.userId : "";
    if (!userId || !mongoose.isValidObjectId(userId)) {
      return res.status(400).json({ message: "userId is required" });
    }
    const status = await usersService.getBlockStatus(req.userId, userId);
    return res.json(status);
  } catch (err) {
    return handleError(res, err);
  }
};
