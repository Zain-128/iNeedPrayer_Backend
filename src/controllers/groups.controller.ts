import { Response } from "express";
import mongoose from "mongoose";
import { AuthRequest } from "../middleware/auth.middleware.js";
import * as groupsService from "../services/groups.service.js";
import { paramStr } from "../utils/routeParams.js";

export const listGroups = async (req: AuthRequest, res: Response) => {
  try {
    const mine = req.query.mine === "1" || req.query.mine === "true";
    const groups = await groupsService.listGroups({
      userId: req.userId,
      q: typeof req.query.q === "string" ? req.query.q : undefined,
      mine,
    });
    return res.json({ groups });
  } catch (err) {
    const e = err as Error & { statusCode?: number };
    return res.status(e.statusCode ?? 500).json({ message: e.message });
  }
};

export const listMyGroups = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.userId) return res.status(401).json({ message: "Unauthorized" });
    const groups = await groupsService.listGroups({
      userId: req.userId,
      q: typeof req.query.q === "string" ? req.query.q : undefined,
      mine: true,
    });
    return res.json({ groups });
  } catch (err) {
    const e = err as Error & { statusCode?: number };
    return res.status(e.statusCode ?? 500).json({ message: e.message });
  }
};

export const discoverGroups = async (req: AuthRequest, res: Response) => {
  try {
    const groups = await groupsService.listGroups({
      userId: req.userId,
      q: typeof req.query.q === "string" ? req.query.q : undefined,
      mine: false,
    });
    return res.json({ groups });
  } catch (err) {
    const e = err as Error & { statusCode?: number };
    return res.status(e.statusCode ?? 500).json({ message: e.message });
  }
};

export const getGroup = async (req: AuthRequest, res: Response) => {
  try {
    const id = paramStr(req.params.id);
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ message: "Invalid id" });
    }
    const group = await groupsService.getGroup(id, req.userId);
    return res.json({ group });
  } catch (err) {
    const e = err as Error & { statusCode?: number };
    return res.status(e.statusCode ?? 500).json({ message: e.message });
  }
};

export const createGroup = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.userId) return res.status(401).json({ message: "Unauthorized" });
    const group = await groupsService.createGroup(req.userId, req.body ?? {});
    return res.status(201).json({ group });
  } catch (err) {
    const e = err as Error & { statusCode?: number };
    return res.status(e.statusCode ?? 500).json({ message: e.message });
  }
};

export const joinGroup = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.userId) return res.status(401).json({ message: "Unauthorized" });
    const id = paramStr(req.params.id);
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ message: "Invalid id" });
    }
    const group = await groupsService.joinGroup(req.userId, id);
    return res.json({ group });
  } catch (err) {
    const e = err as Error & { statusCode?: number };
    return res.status(e.statusCode ?? 500).json({ message: e.message });
  }
};

export const leaveGroup = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.userId) return res.status(401).json({ message: "Unauthorized" });
    const id = paramStr(req.params.id);
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ message: "Invalid id" });
    }
    await groupsService.leaveGroup(req.userId, id);
    return res.json({ message: "Left group" });
  } catch (err) {
    const e = err as Error & { statusCode?: number };
    return res.status(e.statusCode ?? 500).json({ message: e.message });
  }
};

export const inviteGroup = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.userId) return res.status(401).json({ message: "Unauthorized" });
    const id = paramStr(req.params.id);
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ message: "Invalid id" });
    }
    const { userIds } = req.body ?? {};
    if (!Array.isArray(userIds) || !userIds.length) {
      return res.status(400).json({ message: "userIds array required" });
    }
    const result = await groupsService.inviteToGroup(
      req.userId,
      id,
      userIds.filter((x: unknown) => typeof x === "string")
    );
    return res.json(result);
  } catch (err) {
    const e = err as Error & { statusCode?: number };
    return res.status(e.statusCode ?? 500).json({ message: e.message });
  }
};
