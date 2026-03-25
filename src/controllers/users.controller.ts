import { Response } from "express";
import mongoose from "mongoose";
import { AuthRequest } from "../middleware/auth.middleware.js";
import * as usersService from "../services/users.service.js";
import { paramStr } from "../utils/routeParams.js";

export const getMeProfile = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.userId) return res.status(401).json({ message: "Unauthorized" });
    const profile = await usersService.getMyProfile(req.userId);
    return res.json({ profile });
  } catch (err) {
    const e = err as Error & { statusCode?: number };
    return res.status(e.statusCode ?? 500).json({ message: e.message });
  }
};

export const patchMe = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.userId) return res.status(401).json({ message: "Unauthorized" });
    const profile = await usersService.updateMe(req.userId, req.body ?? {});
    return res.json({ profile });
  } catch (err) {
    const e = err as Error & { statusCode?: number };
    return res.status(e.statusCode ?? 500).json({ message: e.message });
  }
};

export const searchUsers = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.userId) return res.status(401).json({ message: "Unauthorized" });
    const q = typeof req.query.q === "string" ? req.query.q : "";
    if (!q.trim()) return res.json({ users: [] });
    const users = await usersService.searchUsers(q, req.userId);
    return res.json({ users });
  } catch (err) {
    const e = err as Error & { statusCode?: number };
    return res.status(e.statusCode ?? 500).json({ message: e.message });
  }
};

export const getUserProfile = async (req: AuthRequest, res: Response) => {
  try {
    const userId = paramStr(req.params.userId);
    if (!mongoose.isValidObjectId(userId)) {
      return res.status(400).json({ message: "Invalid user id" });
    }
    const profile = await usersService.getPublicProfile(req.userId, userId);
    return res.json({ profile });
  } catch (err) {
    const e = err as Error & { statusCode?: number };
    return res.status(e.statusCode ?? 500).json({ message: e.message });
  }
};

export const followUser = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.userId) return res.status(401).json({ message: "Unauthorized" });
    const targetId = paramStr(req.params.userId);
    if (!mongoose.isValidObjectId(targetId)) {
      return res.status(400).json({ message: "Invalid user id" });
    }
    const result = await usersService.toggleFollow(req.userId, targetId);
    return res.json(result);
  } catch (err) {
    const e = err as Error & { statusCode?: number };
    return res.status(e.statusCode ?? 500).json({ message: e.message });
  }
};

export const listBlocked = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.userId) return res.status(401).json({ message: "Unauthorized" });
    const users = await usersService.listBlocked(req.userId);
    return res.json({ users });
  } catch (err) {
    const e = err as Error & { statusCode?: number };
    return res.status(e.statusCode ?? 500).json({ message: e.message });
  }
};

export const blockUser = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.userId) return res.status(401).json({ message: "Unauthorized" });
    const { userId: blockedId } = req.body ?? {};
    if (!blockedId || typeof blockedId !== "string") {
      return res.status(400).json({ message: "userId is required" });
    }
    if (!mongoose.isValidObjectId(blockedId)) {
      return res.status(400).json({ message: "Invalid user id" });
    }
    await usersService.blockUser(req.userId, blockedId);
    return res.json({ message: "Blocked" });
  } catch (err) {
    const e = err as Error & { statusCode?: number };
    return res.status(e.statusCode ?? 500).json({ message: e.message });
  }
};

export const unblockUser = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.userId) return res.status(401).json({ message: "Unauthorized" });
    const blockedId = paramStr(req.params.blockedUserId);
    if (!mongoose.isValidObjectId(blockedId)) {
      return res.status(400).json({ message: "Invalid user id" });
    }
    await usersService.unblockUser(req.userId, blockedId);
    return res.json({ message: "Unblocked" });
  } catch (err) {
    const e = err as Error & { statusCode?: number };
    return res.status(e.statusCode ?? 500).json({ message: e.message });
  }
};
