import mongoose from "mongoose";
import { Response } from "express";
import { AuthRequest } from "../middleware/auth.middleware.js";
import * as friendsService from "../services/friends.service.js";

function parseTargetUserId(body: unknown): string | null {
  const userId = (body as { userId?: string })?.userId;
  if (!userId || typeof userId !== "string") return null;
  if (!mongoose.isValidObjectId(userId)) return null;
  return userId;
}

function handleError(res: Response, err: unknown) {
  const e = err as Error & { statusCode?: number };
  return res.status(e.statusCode ?? 500).json({ message: e.message });
}

export const sendRequest = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.userId) return res.status(401).json({ message: "Unauthorized" });
    const toId = parseTargetUserId(req.body);
    if (!toId) return res.status(400).json({ message: "userId is required" });
    const result = await friendsService.sendFriendRequest(req.userId, toId);
    return res.json(result);
  } catch (err) {
    return handleError(res, err);
  }
};

export const acceptRequest = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.userId) return res.status(401).json({ message: "Unauthorized" });
    const requesterId = parseTargetUserId(req.body);
    if (!requesterId) {
      return res.status(400).json({ message: "userId is required" });
    }
    const result = await friendsService.acceptFriendRequest(req.userId, requesterId);
    return res.json(result);
  } catch (err) {
    return handleError(res, err);
  }
};

export const rejectRequest = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.userId) return res.status(401).json({ message: "Unauthorized" });
    const requesterId = parseTargetUserId(req.body);
    if (!requesterId) {
      return res.status(400).json({ message: "userId is required" });
    }
    const result = await friendsService.rejectFriendRequest(req.userId, requesterId);
    return res.json(result);
  } catch (err) {
    return handleError(res, err);
  }
};

export const listFriends = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.userId) return res.status(401).json({ message: "Unauthorized" });
    const friends = await friendsService.listFriends(req.userId);
    return res.json({ friends });
  } catch (err) {
    return handleError(res, err);
  }
};
