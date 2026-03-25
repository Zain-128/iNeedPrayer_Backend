import { Response } from "express";
import mongoose from "mongoose";
import { AuthRequest } from "../middleware/auth.middleware.js";
import * as commentsService from "../services/comments.service.js";
import * as reportsService from "../services/reports.service.js";
import { paramStr } from "../utils/routeParams.js";

export const deleteComment = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.userId) return res.status(401).json({ message: "Unauthorized" });
    const id = paramStr(req.params.id);
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ message: "Invalid id" });
    }
    await commentsService.deleteComment(id, req.userId);
    return res.json({ message: "Deleted" });
  } catch (err) {
    const e = err as Error & { statusCode?: number };
    return res.status(e.statusCode ?? 500).json({ message: e.message });
  }
};

export const reportComment = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.userId) return res.status(401).json({ message: "Unauthorized" });
    const id = paramStr(req.params.id);
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ message: "Invalid id" });
    }
    const { reasonKey, otherText } = req.body ?? {};
    if (!reasonKey || typeof reasonKey !== "string") {
      return res.status(400).json({ message: "reasonKey is required" });
    }
    await reportsService.reportComment(req.userId, id, reasonKey, otherText);
    return res.json({ message: "Report submitted" });
  } catch (err) {
    const e = err as Error & { statusCode?: number };
    return res.status(e.statusCode ?? 500).json({ message: e.message });
  }
};
