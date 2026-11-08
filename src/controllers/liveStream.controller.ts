import { Response } from "express";
import mongoose from "mongoose";
import { AuthRequest } from "../middleware/auth.middleware.js";
import * as liveStreamService from "../services/liveStream.service.js";
import * as liveStreamCommentsService from "../services/liveStreamComments.service.js";
import * as churchesService from "../services/churches.service.js";
import { paramStr } from "../utils/routeParams.js";

function invalidId(res: Response) {
  return res.status(400).json({ message: "Invalid id" });
}

function parseScope(raw: unknown): liveStreamService.LiveScope | null {
  return raw === "church" || raw === "group" ? raw : null;
}

export const getLiveStatus = async (req: AuthRequest, res: Response) => {
  try {
    const scope = parseScope(req.params.scope);
    const entityId = paramStr(req.params.entityId);
    if (!scope || !mongoose.isValidObjectId(entityId)) return invalidId(res);

    const result = await liveStreamService.getLiveStatus(scope, entityId);
    return res.json(result);
  } catch (err) {
    const e = err as Error & { statusCode?: number };
    return res.status(e.statusCode ?? 500).json({ message: e.message });
  }
};

export const startLiveStream = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.userId) return res.status(401).json({ message: "Unauthorized" });
    const scope = parseScope(req.params.scope);
    const entityId = paramStr(req.params.entityId);
    if (!scope || !mongoose.isValidObjectId(entityId)) return invalidId(res);

    const title =
      typeof req.body?.title === "string" ? req.body.title : undefined;

    const result = await liveStreamService.startLiveStream({
      scope,
      entityId,
      userId: req.userId,
      title,
    });
    return res.status(201).json(result);
  } catch (err) {
    const e = err as Error & { statusCode?: number };
    return res.status(e.statusCode ?? 500).json({ message: e.message });
  }
};

export const stopLiveStream = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.userId) return res.status(401).json({ message: "Unauthorized" });
    const scope = parseScope(req.params.scope);
    const entityId = paramStr(req.params.entityId);
    if (!scope || !mongoose.isValidObjectId(entityId)) return invalidId(res);

    const result = await liveStreamService.stopLiveStream({
      scope,
      entityId,
      userId: req.userId,
    });
    return res.json(result);
  } catch (err) {
    const e = err as Error & { statusCode?: number };
    return res.status(e.statusCode ?? 500).json({ message: e.message });
  }
};

export const joinLiveStream = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.userId) return res.status(401).json({ message: "Unauthorized" });
    const scope = parseScope(req.params.scope);
    const entityId = paramStr(req.params.entityId);
    if (!scope || !mongoose.isValidObjectId(entityId)) return invalidId(res);

    const result = await liveStreamService.joinLiveStream({
      scope,
      entityId,
      userId: req.userId,
    });
    return res.json(result);
  } catch (err) {
    const e = err as Error & { statusCode?: number };
    return res.status(e.statusCode ?? 500).json({ message: e.message });
  }
};

export const getSession = async (req: AuthRequest, res: Response) => {
  try {
    const sessionId = paramStr(req.params.sessionId);
    if (!mongoose.isValidObjectId(sessionId)) return invalidId(res);
    const session = await liveStreamService.getSessionById(sessionId);
    return res.json({ session });
  } catch (err) {
    const e = err as Error & { statusCode?: number };
    return res.status(e.statusCode ?? 500).json({ message: e.message });
  }
};

export const refreshLiveToken = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.userId) return res.status(401).json({ message: "Unauthorized" });
    const scope = parseScope(req.params.scope);
    const entityId = paramStr(req.params.entityId);
    if (!scope || !mongoose.isValidObjectId(entityId)) return invalidId(res);

    const result = await liveStreamService.refreshLiveToken({
      scope,
      entityId,
      userId: req.userId,
    });
    return res.json(result);
  } catch (err) {
    const e = err as Error & { statusCode?: number };
    return res.status(e.statusCode ?? 500).json({ message: e.message });
  }
};

export const hostHeartbeat = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.userId) return res.status(401).json({ message: "Unauthorized" });
    const scope = parseScope(req.params.scope);
    const entityId = paramStr(req.params.entityId);
    if (!scope || !mongoose.isValidObjectId(entityId)) return invalidId(res);

    const result = await liveStreamService.recordHostHeartbeat({
      scope,
      entityId,
      userId: req.userId,
    });
    return res.json(result);
  } catch (err) {
    const e = err as Error & { statusCode?: number };
    return res.status(e.statusCode ?? 500).json({ message: e.message });
  }
};

export const getComments = async (req: AuthRequest, res: Response) => {
  try {
    const sessionId = paramStr(req.params.sessionId);
    if (!mongoose.isValidObjectId(sessionId)) return invalidId(res);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 40));
    const comments = await liveStreamCommentsService.getRecentLiveComments(
      sessionId,
      limit
    );
    return res.json({ comments });
  } catch (err) {
    const e = err as Error & { statusCode?: number };
    return res.status(e.statusCode ?? 500).json({ message: e.message });
  }
};

export const getSettings = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.userId) return res.status(401).json({ message: "Unauthorized" });
    const rawType = (req.query.sourceType || req.query.scope || req.body?.sourceType || "").toString().toLowerCase();
    const sourceId = (req.query.sourceId || req.query.entityId || req.body?.sourceId || "").toString();

    const sourceType = rawType === "church" ? "church" : rawType === "group" || rawType === "community" ? "group" : null;
    if (!sourceType || !mongoose.isValidObjectId(sourceId)) {
      return res.status(400).json({ message: "Valid sourceType ('church' | 'group') and sourceId are required" });
    }

    const result = await churchesService.getLiveStreamSettings(sourceType, sourceId, req.userId);
    return res.json(result);
  } catch (err) {
    const e = err as Error & { statusCode?: number };
    return res.status(e.statusCode ?? 500).json({ message: e.message });
  }
};

export const updateSettings = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.userId) return res.status(401).json({ message: "Unauthorized" });
    const rawType = (req.body?.sourceType || req.query.sourceType || "").toString().toLowerCase();
    const sourceId = (req.body?.sourceId || req.query.sourceId || "").toString();
    const settings = req.body?.settings || req.body || {};

    const sourceType = rawType === "church" ? "church" : rawType === "group" || rawType === "community" ? "group" : null;
    if (!sourceType || !mongoose.isValidObjectId(sourceId)) {
      return res.status(400).json({ message: "Valid sourceType ('church' | 'group') and sourceId are required" });
    }

    const result = await churchesService.updateLiveStreamSettings(
      sourceType,
      sourceId,
      req.userId,
      settings
    );
    return res.json(result);
  } catch (err) {
    const e = err as Error & { statusCode?: number };
    return res.status(e.statusCode ?? 500).json({ message: e.message });
  }
};

export const getLiveReplays = async (req: AuthRequest, res: Response) => {
  try {
    const scope = parseScope(req.params.scope);
    const entityId = paramStr(req.params.entityId);
    if (!scope || !mongoose.isValidObjectId(entityId)) return invalidId(res);

    const page = parseInt((req.query.page as string) || "1", 10) || 1;
    const limit = parseInt((req.query.limit as string) || "20", 10) || 20;

    const result = await liveStreamService.getLiveReplays({
      scope,
      entityId,
      page,
      limit,
    });
    return res.json(result);
  } catch (err) {
    const e = err as Error & { statusCode?: number };
    return res.status(e.statusCode ?? 500).json({ message: e.message });
  }
};
