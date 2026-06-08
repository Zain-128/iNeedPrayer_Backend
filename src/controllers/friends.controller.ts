import mongoose from "mongoose";
import { Response } from "express";
import { AuthRequest } from "../middleware/auth.middleware.js";
import * as friendsService from "../services/friends.service.js";
import { paramStr } from "../utils/routeParams.js";

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

export const listIncomingRequests = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.userId) return res.status(401).json({ message: "Unauthorized" });
    const requests = await friendsService.listIncomingFriendRequests(req.userId);
    return res.json({ requests });
  } catch (err) {
    return handleError(res, err);
  }
};

export const listOutgoingRequests = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.userId) return res.status(401).json({ message: "Unauthorized" });
    const requests = await friendsService.listOutgoingFriendRequests(req.userId);
    return res.json({ requests });
  } catch (err) {
    return handleError(res, err);
  }
};

export const cancelRequest = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.userId) return res.status(401).json({ message: "Unauthorized" });
    const userId = paramStr(req.params.userId);
    if (!mongoose.isValidObjectId(userId)) {
      return res.status(400).json({ message: "Invalid user id" });
    }
    const result = await friendsService.cancelFriendRequest(req.userId, userId);
    return res.json(result);
  } catch (err) {
    return handleError(res, err);
  }
};

export const removeFriend = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.userId) return res.status(401).json({ message: "Unauthorized" });
    const userId = paramStr(req.params.userId);
    if (!mongoose.isValidObjectId(userId)) {
      return res.status(400).json({ message: "Invalid user id" });
    }
    const result = await friendsService.removeFriend(req.userId, userId);
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
