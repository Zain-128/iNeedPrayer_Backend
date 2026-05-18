import { Response } from "express";
import mongoose from "mongoose";
import { AuthRequest } from "../middleware/auth.middleware.js";
import * as churchesService from "../services/churches.service.js";
import { paramStr } from "../utils/routeParams.js";

function invalidId(res: Response) {
  return res.status(400).json({ message: "Invalid id" });
}

export const listChurches = async (req: AuthRequest, res: Response) => {
  try {
    const filter = typeof req.query.filter === "string" ? req.query.filter : undefined;
    const tab =
      req.query.tab === "followed"
        ? "followed"
        : req.query.tab === "my"
          ? "my"
          : undefined;
    const churches = await churchesService.listChurches({
      userId: req.userId,
      q: typeof req.query.q === "string" ? req.query.q : undefined,
      filter: filter as churchesService.ChurchFilter | undefined,
      tab,
    });
    return res.json({ churches });
  } catch (err) {
    const e = err as Error & { statusCode?: number };
    return res.status(e.statusCode ?? 500).json({ message: e.message });
  }
};

export const discoverChurches = async (req: AuthRequest, res: Response) => {
  try {
    const churches = await churchesService.discoverChurches({
      userId: req.userId,
      q: typeof req.query.q === "string" ? req.query.q : undefined,
    });
    return res.json({ churches });
  } catch (err) {
    const e = err as Error & { statusCode?: number };
    return res.status(e.statusCode ?? 500).json({ message: e.message });
  }
};

export const getChurch = async (req: AuthRequest, res: Response) => {
  try {
    const id = paramStr(req.params.id);
    if (!mongoose.isValidObjectId(id)) return invalidId(res);
    const church = await churchesService.getChurch(id, req.userId);
    return res.json({ church });
  } catch (err) {
    const e = err as Error & { statusCode?: number };
    return res.status(e.statusCode ?? 500).json({ message: e.message });
  }
};

export const createChurch = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.userId) return res.status(401).json({ message: "Unauthorized" });
    const result = await churchesService.createChurch(req.userId, req.body ?? {});
    return res.status(201).json(result);
  } catch (err) {
    const e = err as Error & { statusCode?: number };
    return res.status(e.statusCode ?? 500).json({ message: e.message });
  }
};

export const updateChurch = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.userId) return res.status(401).json({ message: "Unauthorized" });
    const id = paramStr(req.params.id);
    if (!mongoose.isValidObjectId(id)) return invalidId(res);
    const church = await churchesService.updateChurch(id, req.userId, req.body ?? {});
    return res.json({ church });
  } catch (err) {
    const e = err as Error & { statusCode?: number };
    return res.status(e.statusCode ?? 500).json({ message: e.message });
  }
};

export const deleteChurch = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.userId) return res.status(401).json({ message: "Unauthorized" });
    const id = paramStr(req.params.id);
    if (!mongoose.isValidObjectId(id)) return invalidId(res);
    const result = await churchesService.deleteChurch(id, req.userId);
    return res.json(result);
  } catch (err) {
    const e = err as Error & { statusCode?: number };
    return res.status(e.statusCode ?? 500).json({ message: e.message });
  }
};

export const followChurch = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.userId) return res.status(401).json({ message: "Unauthorized" });
    const id = paramStr(req.params.id);
    if (!mongoose.isValidObjectId(id)) return invalidId(res);
    const result = await churchesService.toggleFollowChurch(req.userId, id);
    return res.json(result);
  } catch (err) {
    const e = err as Error & { statusCode?: number };
    return res.status(e.statusCode ?? 500).json({ message: e.message });
  }
};

export const sendVerification = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.userId) return res.status(401).json({ message: "Unauthorized" });
    const id = paramStr(req.params.id);
    if (!mongoose.isValidObjectId(id)) return invalidId(res);
    const result = await churchesService.sendChurchVerification(id, req.userId);
    return res.json(result);
  } catch (err) {
    const e = err as Error & { statusCode?: number };
    return res.status(e.statusCode ?? 500).json({ message: e.message });
  }
};

export const verifyChurch = async (req: AuthRequest, res: Response) => {
  try {
    const id = paramStr(req.params.id);
    if (!mongoose.isValidObjectId(id)) return invalidId(res);
    const { code } = req.body ?? {};
    const result = await churchesService.verifyChurch(
      id,
      String(code ?? ""),
      req.userId
    );
    return res.json(result);
  } catch (err) {
    const e = err as Error & { statusCode?: number };
    return res.status(e.statusCode ?? 500).json({ message: e.message });
  }
};

export const listMembers = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.userId) return res.status(401).json({ message: "Unauthorized" });
    const id = paramStr(req.params.id);
    if (!mongoose.isValidObjectId(id)) return invalidId(res);
    const members = await churchesService.listChurchMembers(id, req.userId);
    return res.json({ members });
  } catch (err) {
    const e = err as Error & { statusCode?: number };
    return res.status(e.statusCode ?? 500).json({ message: e.message });
  }
};

export const addMember = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.userId) return res.status(401).json({ message: "Unauthorized" });
    const id = paramStr(req.params.id);
    if (!mongoose.isValidObjectId(id)) return invalidId(res);
    const result = await churchesService.addChurchMember(id, req.userId, req.body ?? {});
    return res.status(201).json(result);
  } catch (err) {
    const e = err as Error & { statusCode?: number };
    return res.status(e.statusCode ?? 500).json({ message: e.message });
  }
};

export const removeMember = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.userId) return res.status(401).json({ message: "Unauthorized" });
    const id = paramStr(req.params.id);
    const userId = paramStr(req.params.userId);
    if (!mongoose.isValidObjectId(id) || !mongoose.isValidObjectId(userId)) {
      return invalidId(res);
    }
    const result = await churchesService.removeChurchMember(id, req.userId, userId);
    return res.json(result);
  } catch (err) {
    const e = err as Error & { statusCode?: number };
    return res.status(e.statusCode ?? 500).json({ message: e.message });
  }
};

export const updateMemberRole = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.userId) return res.status(401).json({ message: "Unauthorized" });
    const id = paramStr(req.params.id);
    const userId = paramStr(req.params.userId);
    if (!mongoose.isValidObjectId(id) || !mongoose.isValidObjectId(userId)) {
      return invalidId(res);
    }
    const { role } = req.body ?? {};
    const result = await churchesService.updateChurchMemberRole(
      id,
      req.userId,
      userId,
      role
    );
    return res.json(result);
  } catch (err) {
    const e = err as Error & { statusCode?: number };
    return res.status(e.statusCode ?? 500).json({ message: e.message });
  }
};
