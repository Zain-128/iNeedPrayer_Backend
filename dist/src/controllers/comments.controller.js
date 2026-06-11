import mongoose from "mongoose";
import * as commentsService from "../services/comments.service.js";
import * as reportsService from "../services/reports.service.js";
import { paramStr } from "../utils/routeParams.js";
export const editComment = async (req, res) => {
    try {
        if (!req.userId)
            return res.status(401).json({ message: "Unauthorized" });
        const id = paramStr(req.params.id);
        if (!mongoose.isValidObjectId(id)) {
            return res.status(400).json({ message: "Invalid id" });
        }
        const { text } = req.body ?? {};
        if (!text || typeof text !== "string") {
            return res.status(400).json({ message: "text is required" });
        }
        const comment = await commentsService.editComment(id, req.userId, text);
        return res.json({ comment });
    }
    catch (err) {
        const e = err;
        return res.status(e.statusCode ?? 500).json({ message: e.message });
    }
};
export const deleteComment = async (req, res) => {
    try {
        if (!req.userId)
            return res.status(401).json({ message: "Unauthorized" });
        const id = paramStr(req.params.id);
        if (!mongoose.isValidObjectId(id)) {
            return res.status(400).json({ message: "Invalid id" });
        }
        await commentsService.deleteComment(id, req.userId);
        return res.json({ message: "Deleted" });
    }
    catch (err) {
        const e = err;
        return res.status(e.statusCode ?? 500).json({ message: e.message });
    }
};
export const reportComment = async (req, res) => {
    try {
        if (!req.userId)
            return res.status(401).json({ message: "Unauthorized" });
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
    }
    catch (err) {
        const e = err;
        return res.status(e.statusCode ?? 500).json({ message: e.message });
    }
};
export const prayComment = async (req, res) => {
    try {
        if (!req.userId)
            return res.status(401).json({ message: "Unauthorized" });
        const id = paramStr(req.params.id);
        if (!mongoose.isValidObjectId(id)) {
            return res.status(400).json({ message: "Invalid id" });
        }
        const result = await commentsService.togglePray(id, req.userId);
        return res.json(result);
    }
    catch (err) {
        const e = err;
        return res.status(e.statusCode ?? 500).json({ message: e.message });
    }
};
export const praiseComment = async (req, res) => {
    try {
        if (!req.userId)
            return res.status(401).json({ message: "Unauthorized" });
        const id = paramStr(req.params.id);
        if (!mongoose.isValidObjectId(id)) {
            return res.status(400).json({ message: "Invalid id" });
        }
        const result = await commentsService.togglePraise(id, req.userId);
        return res.json(result);
    }
    catch (err) {
        const e = err;
        return res.status(e.statusCode ?? 500).json({ message: e.message });
    }
};
