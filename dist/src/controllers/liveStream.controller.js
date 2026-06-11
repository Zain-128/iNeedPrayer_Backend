import mongoose from "mongoose";
import * as liveStreamService from "../services/liveStream.service.js";
import { paramStr } from "../utils/routeParams.js";
function invalidId(res) {
    return res.status(400).json({ message: "Invalid id" });
}
function parseScope(raw) {
    return raw === "church" || raw === "group" ? raw : null;
}
export const getLiveStatus = async (req, res) => {
    try {
        const scope = parseScope(req.params.scope);
        const entityId = paramStr(req.params.entityId);
        if (!scope || !mongoose.isValidObjectId(entityId))
            return invalidId(res);
        const result = await liveStreamService.getLiveStatus(scope, entityId);
        return res.json(result);
    }
    catch (err) {
        const e = err;
        return res.status(e.statusCode ?? 500).json({ message: e.message });
    }
};
export const startLiveStream = async (req, res) => {
    try {
        if (!req.userId)
            return res.status(401).json({ message: "Unauthorized" });
        const scope = parseScope(req.params.scope);
        const entityId = paramStr(req.params.entityId);
        if (!scope || !mongoose.isValidObjectId(entityId))
            return invalidId(res);
        const title = typeof req.body?.title === "string" ? req.body.title : undefined;
        const result = await liveStreamService.startLiveStream({
            scope,
            entityId,
            userId: req.userId,
            title,
        });
        return res.status(201).json(result);
    }
    catch (err) {
        const e = err;
        return res.status(e.statusCode ?? 500).json({ message: e.message });
    }
};
export const stopLiveStream = async (req, res) => {
    try {
        if (!req.userId)
            return res.status(401).json({ message: "Unauthorized" });
        const scope = parseScope(req.params.scope);
        const entityId = paramStr(req.params.entityId);
        if (!scope || !mongoose.isValidObjectId(entityId))
            return invalidId(res);
        const result = await liveStreamService.stopLiveStream({
            scope,
            entityId,
            userId: req.userId,
        });
        return res.json(result);
    }
    catch (err) {
        const e = err;
        return res.status(e.statusCode ?? 500).json({ message: e.message });
    }
};
export const joinLiveStream = async (req, res) => {
    try {
        if (!req.userId)
            return res.status(401).json({ message: "Unauthorized" });
        const scope = parseScope(req.params.scope);
        const entityId = paramStr(req.params.entityId);
        if (!scope || !mongoose.isValidObjectId(entityId))
            return invalidId(res);
        const result = await liveStreamService.joinLiveStream({
            scope,
            entityId,
            userId: req.userId,
        });
        return res.json(result);
    }
    catch (err) {
        const e = err;
        return res.status(e.statusCode ?? 500).json({ message: e.message });
    }
};
export const getSession = async (req, res) => {
    try {
        const sessionId = paramStr(req.params.sessionId);
        if (!mongoose.isValidObjectId(sessionId))
            return invalidId(res);
        const session = await liveStreamService.getSessionById(sessionId);
        return res.json({ session });
    }
    catch (err) {
        const e = err;
        return res.status(e.statusCode ?? 500).json({ message: e.message });
    }
};
export const refreshLiveToken = async (req, res) => {
    try {
        if (!req.userId)
            return res.status(401).json({ message: "Unauthorized" });
        const scope = parseScope(req.params.scope);
        const entityId = paramStr(req.params.entityId);
        if (!scope || !mongoose.isValidObjectId(entityId))
            return invalidId(res);
        const result = await liveStreamService.refreshLiveToken({
            scope,
            entityId,
            userId: req.userId,
        });
        return res.json(result);
    }
    catch (err) {
        const e = err;
        return res.status(e.statusCode ?? 500).json({ message: e.message });
    }
};
export const hostHeartbeat = async (req, res) => {
    try {
        if (!req.userId)
            return res.status(401).json({ message: "Unauthorized" });
        const scope = parseScope(req.params.scope);
        const entityId = paramStr(req.params.entityId);
        if (!scope || !mongoose.isValidObjectId(entityId))
            return invalidId(res);
        const result = await liveStreamService.recordHostHeartbeat({
            scope,
            entityId,
            userId: req.userId,
        });
        return res.json(result);
    }
    catch (err) {
        const e = err;
        return res.status(e.statusCode ?? 500).json({ message: e.message });
    }
};
