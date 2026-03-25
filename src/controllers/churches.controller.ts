import { Response } from "express";
import mongoose from "mongoose";
import { AuthRequest } from "../middleware/auth.middleware.js";
import * as churchesService from "../services/churches.service.js";
import { CHURCH_VERIFY_CODE } from "../contants.js";
import { paramStr } from "../utils/routeParams.js";

export const listChurches = async (req: AuthRequest, res: Response) => {
  try {
    const filter = typeof req.query.filter === "string" ? req.query.filter : undefined;
    const tab = req.query.tab === "followed" ? "followed" : req.query.tab === "my" ? "my" : undefined;
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

export const getChurch = async (req: AuthRequest, res: Response) => {
  try {
    const id = paramStr(req.params.id);
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ message: "Invalid id" });
    }
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
    const church = await churchesService.createChurch(req.userId, req.body ?? {});
    return res.status(201).json({ church });
  } catch (err) {
    const e = err as Error & { statusCode?: number };
    return res.status(e.statusCode ?? 500).json({ message: e.message });
  }
};

export const updateChurch = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.userId) return res.status(401).json({ message: "Unauthorized" });
    const id = paramStr(req.params.id);
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ message: "Invalid id" });
    }
    const church = await churchesService.updateChurch(
      id,
      req.userId,
      req.body ?? {}
    );
    return res.json({ church });
  } catch (err) {
    const e = err as Error & { statusCode?: number };
    return res.status(e.statusCode ?? 500).json({ message: e.message });
  }
};

export const followChurch = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.userId) return res.status(401).json({ message: "Unauthorized" });
    const id = paramStr(req.params.id);
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ message: "Invalid id" });
    }
    const result = await churchesService.toggleFollowChurch(req.userId, id);
    return res.json(result);
  } catch (err) {
    const e = err as Error & { statusCode?: number };
    return res.status(e.statusCode ?? 500).json({ message: e.message });
  }
};

export const verifyChurch = async (req: AuthRequest, res: Response) => {
  try {
    const id = paramStr(req.params.id);
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ message: "Invalid id" });
    }
    const church = await churchesService.getChurch(id, req.userId);
    const { code } = req.body ?? {};
    if (String(code ?? "").trim() !== CHURCH_VERIFY_CODE) {
      return res.status(400).json({ message: "Invalid code" });
    }
    return res.json({ ok: true, church });
  } catch (err) {
    const e = err as Error & { statusCode?: number };
    return res.status(e.statusCode ?? 500).json({ message: e.message });
  }
};
