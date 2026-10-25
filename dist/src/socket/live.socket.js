import mongoose from "mongoose";
import { LIVE_COMMENT_BATCH_MS, LIVE_COMMENT_BUFFER_SIZE, LIVE_COMMENT_MAX_LEN, LIVE_HEART_BATCH_MS, LIVE_HEART_BURST_BUFFER, LIVE_HEART_DB_FLUSH_MS, LIVE_VIEWER_COUNT_THROTTLE_MS, checkCommentRateLimit, checkHeartRateLimit, pruneCommentRateLimits, } from "../utils/liveStreamRateLimit.js";
import { assertSessionIsLive, flushPendingViewerCount, getSessionLikeCount, incrementLikeCount, isSessionActiveInMemory, touchHostHeartbeat, syncViewerCount, } from "../services/liveStream.service.js";
import { getRecentLiveComments, persistLiveCommentAsync, } from "../services/liveStreamComments.service.js";
const sessionRooms = new Map();
function getRoomState(sessionId) {
    let state = sessionRooms.get(sessionId);
    if (!state) {
        state = {
            comments: [],
            pendingBatch: [],
            batchTimer: null,
            lastViewerEmitAt: 0,
            likeCount: 0,
            pendingHeartDelta: 0,
            pendingHeartBursts: [],
            heartTimer: null,
            pendingDbHearts: 0,
            lastHeartDbFlushAt: 0,
            heartDbTimer: null,
        };
        sessionRooms.set(sessionId, state);
    }
    return state;
}
function flushCommentBatch(io, sessionId) {
    const state = sessionRooms.get(sessionId);
    if (!state || state.pendingBatch.length === 0)
        return;
    const batch = state.pendingBatch.splice(0, state.pendingBatch.length);
    io.to(`live:${sessionId}`).emit("live-comments-batch", {
        sessionId,
        comments: batch,
    });
}
function scheduleCommentBatch(io, sessionId) {
    const state = getRoomState(sessionId);
    if (state.batchTimer)
        return;
    state.batchTimer = setTimeout(() => {
        state.batchTimer = null;
        flushCommentBatch(io, sessionId);
    }, LIVE_COMMENT_BATCH_MS);
}
function pushComment(io, sessionId, comment) {
    const state = getRoomState(sessionId);
    state.comments.push(comment);
    if (state.comments.length > LIVE_COMMENT_BUFFER_SIZE) {
        state.comments.splice(0, state.comments.length - LIVE_COMMENT_BUFFER_SIZE);
    }
    state.pendingBatch.push(comment);
    scheduleCommentBatch(io, sessionId);
}
function flushHeartDb(sessionId) {
    const state = sessionRooms.get(sessionId);
    if (!state || state.pendingDbHearts <= 0)
        return;
    const delta = state.pendingDbHearts;
    state.pendingDbHearts = 0;
    state.lastHeartDbFlushAt = Date.now();
    void incrementLikeCount(sessionId, delta);
}
function scheduleHeartDbFlush(sessionId) {
    const state = getRoomState(sessionId);
    if (state.heartDbTimer)
        return;
    const elapsed = Date.now() - state.lastHeartDbFlushAt;
    const wait = Math.max(0, LIVE_HEART_DB_FLUSH_MS - elapsed);
    state.heartDbTimer = setTimeout(() => {
        state.heartDbTimer = null;
        flushHeartDb(sessionId);
    }, wait);
}
function flushHeartBatch(io, sessionId) {
    const state = sessionRooms.get(sessionId);
    if (!state || state.pendingHeartDelta <= 0)
        return;
    const delta = state.pendingHeartDelta;
    const bursts = state.pendingHeartBursts.splice(0, state.pendingHeartBursts.length);
    state.pendingHeartDelta = 0;
    state.likeCount += delta;
    state.pendingDbHearts += delta;
    scheduleHeartDbFlush(sessionId);
    io.to(`live:${sessionId}`).emit("live-hearts-batch", {
        sessionId,
        count: state.likeCount,
        delta,
        bursts: bursts.slice(0, LIVE_HEART_BURST_BUFFER),
    });
}
function scheduleHeartBatch(io, sessionId) {
    const state = getRoomState(sessionId);
    if (state.heartTimer)
        return;
    state.heartTimer = setTimeout(() => {
        state.heartTimer = null;
        flushHeartBatch(io, sessionId);
    }, LIVE_HEART_BATCH_MS);
}
function pushHeart(io, sessionId, burst) {
    const state = getRoomState(sessionId);
    state.pendingHeartDelta += 1;
    if (state.pendingHeartBursts.length < LIVE_HEART_BURST_BUFFER) {
        state.pendingHeartBursts.push(burst);
    }
    scheduleHeartBatch(io, sessionId);
}
function emitViewerCount(io, sessionId, force = false) {
    const state = getRoomState(sessionId);
    const now = Date.now();
    if (!force && now - state.lastViewerEmitAt < LIVE_VIEWER_COUNT_THROTTLE_MS) {
        return;
    }
    state.lastViewerEmitAt = now;
    const room = io.sockets.adapter.rooms.get(`live:${sessionId}`);
    const count = room ? room.size : 0;
    syncViewerCount(sessionId, count);
    io.to(`live:${sessionId}`).emit("viewer-count", { sessionId, count });
}
function cleanupSessionRoom(sessionId) {
    const state = sessionRooms.get(sessionId);
    if (state?.batchTimer)
        clearTimeout(state.batchTimer);
    if (state?.heartTimer)
        clearTimeout(state.heartTimer);
    if (state?.heartDbTimer)
        clearTimeout(state.heartDbTimer);
    if (state && state.pendingDbHearts > 0) {
        void incrementLikeCount(sessionId, state.pendingDbHearts);
    }
    sessionRooms.delete(sessionId);
}
async function loadCommentHistory(sessionId) {
    const state = sessionRooms.get(sessionId);
    if (state && state.comments.length > 0) {
        return state.comments.slice(-40);
    }
    const fromDb = await getRecentLiveComments(sessionId, 40);
    const roomState = getRoomState(sessionId);
    roomState.comments = fromDb.slice(-LIVE_COMMENT_BUFFER_SIZE);
    return fromDb;
}
async function ensureLikeCount(sessionId) {
    const state = getRoomState(sessionId);
    if (state.likeCount > 0 || state.pendingHeartDelta > 0) {
        return state.likeCount + state.pendingHeartDelta;
    }
    const fromDb = await getSessionLikeCount(sessionId);
    state.likeCount = fromDb;
    return fromDb;
}
export function registerLiveSocket(io) {
    setInterval(() => pruneCommentRateLimits(), 60_000);
    io.on("connection", (socket) => {
        const socketData = socket.data;
        const userId = socketData.userId;
        socket.on("subscribe-live-scope", (data) => {
            const scope = data?.scope;
            const entityId = data?.entityId;
            if ((scope !== "church" && scope !== "group") ||
                !entityId ||
                !mongoose.isValidObjectId(entityId)) {
                return;
            }
            socket.join(`live-scope:${scope}:${entityId}`);
        });
        socket.on("unsubscribe-live-scope", (data) => {
            const scope = data?.scope;
            const entityId = data?.entityId;
            if (!scope || !entityId)
                return;
            socket.leave(`live-scope:${scope}:${entityId}`);
        });
        socket.on("host-heartbeat", async (data) => {
            const scope = data?.scope;
            const entityId = data?.entityId;
            if ((scope !== "church" && scope !== "group") ||
                !entityId ||
                !mongoose.isValidObjectId(entityId)) {
                return;
            }
            try {
                await touchHostHeartbeat({
                    scope,
                    entityId,
                    userId,
                });
                socket.emit("host-heartbeat-ack", { ok: true });
            }
            catch (e) {
                socket.emit("live-error", {
                    message: e.message ?? "Heartbeat failed",
                });
            }
        });
        socket.on("join-live", async (data) => {
            const sessionId = data?.sessionId;
            if (!sessionId || !mongoose.isValidObjectId(sessionId)) {
                socket.emit("live-error", { message: "Invalid session" });
                return;
            }
            try {
                const isLive = await assertSessionIsLive(sessionId);
                if (!isLive) {
                    socket.emit("stream-ended", {
                        sessionId,
                        reason: "already_ended",
                    });
                    return;
                }
                socket.join(`live:${sessionId}`);
                socket.data.liveSessionId = sessionId;
                const [history, likeCount] = await Promise.all([
                    loadCommentHistory(sessionId),
                    ensureLikeCount(sessionId),
                ]);
                socket.emit("live-history", {
                    sessionId,
                    comments: history,
                    likeCount,
                });
                emitViewerCount(io, sessionId, true);
            }
            catch (e) {
                socket.emit("live-error", {
                    message: e.message ?? "Unable to join live",
                });
            }
        });
        socket.on("leave-live", (data) => {
            const sessionId = data?.sessionId;
            if (!sessionId)
                return;
            socket.leave(`live:${sessionId}`);
            if (socket.data.liveSessionId === sessionId) {
                delete socket.data.liveSessionId;
            }
            emitViewerCount(io, sessionId);
        });
        socket.on("live-comment", async (data) => {
            const sessionId = data?.sessionId;
            const text = typeof data?.text === "string" ? data.text.trim() : "";
            if (!sessionId || !text) {
                socket.emit("live-error", { message: "Missing comment text" });
                return;
            }
            if (socket.data.liveSessionId !==
                sessionId) {
                socket.emit("live-error", {
                    message: "Join the live session before commenting",
                });
                return;
            }
            if (text.length > LIVE_COMMENT_MAX_LEN) {
                socket.emit("live-error", {
                    message: `Comment too long (max ${LIVE_COMMENT_MAX_LEN})`,
                });
                return;
            }
            const rate = checkCommentRateLimit(sessionId, userId);
            if (!rate.ok) {
                socket.emit("live-error", {
                    message: "Slow down — wait before sending another comment",
                    retryAfterMs: rate.retryAfterMs,
                });
                return;
            }
            if (!isSessionActiveInMemory(sessionId)) {
                socket.emit("stream-ended", { sessionId, reason: "already_ended" });
                return;
            }
            try {
                const commentId = new mongoose.Types.ObjectId();
                const createdAt = new Date();
                const userName = socketData.userName ?? "User";
                const avatar = socketData.userAvatar ?? "";
                const comment = {
                    id: commentId.toString(),
                    _id: commentId.toString(),
                    sessionId,
                    userId,
                    userName,
                    avatar,
                    text,
                    createdAt: createdAt.toISOString(),
                };
                pushComment(io, sessionId, comment);
                persistLiveCommentAsync({
                    sessionId,
                    userId,
                    userName,
                    avatar,
                    text,
                    commentId: commentId.toString(),
                    createdAt,
                });
            }
            catch (e) {
                socket.emit("live-error", {
                    message: e.message ?? "Failed to send comment",
                });
            }
        });
        socket.on("live-heart", (data) => {
            const sessionId = data?.sessionId;
            if (!sessionId || !mongoose.isValidObjectId(sessionId)) {
                socket.emit("live-error", { message: "Invalid session" });
                return;
            }
            if (socket.data.liveSessionId !==
                sessionId) {
                return;
            }
            if (!isSessionActiveInMemory(sessionId)) {
                socket.emit("stream-ended", { sessionId, reason: "already_ended" });
                return;
            }
            const rate = checkHeartRateLimit(sessionId, userId);
            if (!rate.ok) {
                // Soft drop — client may spam hearts; no error noise
                return;
            }
            pushHeart(io, sessionId, {
                userId,
                userName: socketData.userName ?? "User",
                avatar: socketData.userAvatar ?? "",
            });
        });
        socket.on("disconnect", () => {
            const sessionId = socket.data
                .liveSessionId;
            if (sessionId)
                emitViewerCount(io, sessionId);
        });
    });
}
export function notifyLiveSessionEnded(sessionId) {
    void flushPendingViewerCount(sessionId);
    cleanupSessionRoom(sessionId);
}
