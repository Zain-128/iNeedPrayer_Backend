import mongoose from "mongoose";
import { LiveStreamComment } from "../models/liveStreamComment.model.js";
export async function saveLiveComment(input) {
    const createdAt = input.createdAt ?? new Date();
    const doc = await LiveStreamComment.create({
        _id: input.commentId,
        sessionId: input.sessionId,
        userId: input.userId,
        userName: input.userName,
        avatar: input.avatar,
        text: input.text,
        createdAt,
    });
    return mapComment(doc);
}
/** Fire-and-forget persistence — realtime path broadcasts first. */
export function persistLiveCommentAsync(input) {
    saveLiveComment(input).catch((err) => {
        console.error("[live] comment persist failed:", err);
    });
}
export async function getRecentLiveComments(sessionId, limit = 40) {
    if (!mongoose.isValidObjectId(sessionId))
        return [];
    const docs = await LiveStreamComment.find({ sessionId })
        .sort({ createdAt: -1 })
        .limit(limit)
        .lean();
    return docs
        .map((d) => mapComment({
        _id: d._id,
        sessionId: d.sessionId,
        userId: d.userId,
        userName: d.userName,
        avatar: d.avatar,
        text: d.text,
        createdAt: d.createdAt,
    }))
        .reverse();
}
function mapComment(doc) {
    return {
        id: doc._id.toString(),
        sessionId: doc.sessionId.toString(),
        userId: doc.userId.toString(),
        userName: doc.userName,
        avatar: doc.avatar ?? "",
        text: doc.text,
        createdAt: doc.createdAt.toISOString(),
    };
}
