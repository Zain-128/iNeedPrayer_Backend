import mongoose from "mongoose";
import * as notificationsService from "../services/notifications.service.js";
import { paramStr } from "../utils/routeParams.js";
export const listNotifications = async (req, res) => {
    try {
        if (!req.userId)
            return res.status(401).json({ message: "Unauthorized" });
        const cursor = typeof req.query.cursor === "string" ? req.query.cursor : undefined;
        const limit = req.query.limit ? Number(req.query.limit) : undefined;
        const result = await notificationsService.listNotifications(req.userId, {
            cursor,
            limit,
        });
        return res.json(result);
    }
    catch (err) {
        const e = err;
        return res.status(e.statusCode ?? 500).json({ message: e.message });
    }
};
export const getUnreadCount = async (req, res) => {
    try {
        if (!req.userId)
            return res.status(401).json({ message: "Unauthorized" });
        const result = await notificationsService.getUnreadCount(req.userId);
        return res.json(result);
    }
    catch (err) {
        const e = err;
        return res.status(e.statusCode ?? 500).json({ message: e.message });
    }
};
export const getSettings = async (req, res) => {
    try {
        if (!req.userId)
            return res.status(401).json({ message: "Unauthorized" });
        const settings = await notificationsService.getNotificationSettings(req.userId);
        return res.json({ settings });
    }
    catch (err) {
        const e = err;
        return res.status(e.statusCode ?? 500).json({ message: e.message });
    }
};
export const updateSettings = async (req, res) => {
    try {
        if (!req.userId)
            return res.status(401).json({ message: "Unauthorized" });
        const settings = await notificationsService.updateNotificationSettings(req.userId, req.body ?? {});
        return res.json({ settings });
    }
    catch (err) {
        const e = err;
        return res.status(e.statusCode ?? 500).json({ message: e.message });
    }
};
export const muteNotifications = async (req, res) => {
    try {
        if (!req.userId)
            return res.status(401).json({ message: "Unauthorized" });
        const body = req.body ?? {};
        const settings = await notificationsService.muteNotifications(req.userId, {
            muted: typeof body.muted === "boolean" ? body.muted : undefined,
            durationMinutes: typeof body.durationMinutes === "number"
                ? body.durationMinutes
                : undefined,
            durationHours: typeof body.durationHours === "number" ? body.durationHours : undefined,
        });
        return res.json({ settings });
    }
    catch (err) {
        const e = err;
        return res.status(e.statusCode ?? 500).json({ message: e.message });
    }
};
export const markRead = async (req, res) => {
    try {
        if (!req.userId)
            return res.status(401).json({ message: "Unauthorized" });
        const id = paramStr(req.params.id);
        if (!mongoose.isValidObjectId(id)) {
            return res.status(400).json({ message: "Invalid id" });
        }
        await notificationsService.markRead(req.userId, id);
        return res.json({ message: "OK" });
    }
    catch (err) {
        const e = err;
        return res.status(e.statusCode ?? 500).json({ message: e.message });
    }
};
export const markUnread = async (req, res) => {
    try {
        if (!req.userId)
            return res.status(401).json({ message: "Unauthorized" });
        const id = paramStr(req.params.id);
        if (!mongoose.isValidObjectId(id)) {
            return res.status(400).json({ message: "Invalid id" });
        }
        await notificationsService.markUnread(req.userId, id);
        return res.json({ message: "OK" });
    }
    catch (err) {
        const e = err;
        return res.status(e.statusCode ?? 500).json({ message: e.message });
    }
};
export const markAllRead = async (req, res) => {
    try {
        if (!req.userId)
            return res.status(401).json({ message: "Unauthorized" });
        await notificationsService.markAllRead(req.userId);
        return res.json({ message: "OK" });
    }
    catch (err) {
        const e = err;
        return res.status(e.statusCode ?? 500).json({ message: e.message });
    }
};
export const deleteNotification = async (req, res) => {
    try {
        if (!req.userId)
            return res.status(401).json({ message: "Unauthorized" });
        const id = paramStr(req.params.id);
        if (!mongoose.isValidObjectId(id)) {
            return res.status(400).json({ message: "Invalid id" });
        }
        await notificationsService.deleteNotification(req.userId, id);
        return res.json({ message: "Deleted" });
    }
    catch (err) {
        const e = err;
        return res.status(e.statusCode ?? 500).json({ message: e.message });
    }
};
export const clearAllNotifications = async (req, res) => {
    try {
        if (!req.userId)
            return res.status(401).json({ message: "Unauthorized" });
        const result = await notificationsService.clearAllNotifications(req.userId);
        return res.json(result);
    }
    catch (err) {
        const e = err;
        return res.status(e.statusCode ?? 500).json({ message: e.message });
    }
};
