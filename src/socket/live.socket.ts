import type { Server, Socket } from "socket.io";
import mongoose from "mongoose";
import { User } from "../models/user.model.js";
import {
  LIVE_COMMENT_BATCH_MS,
  LIVE_COMMENT_BUFFER_SIZE,
  LIVE_COMMENT_MAX_LEN,
  LIVE_VIEWER_COUNT_THROTTLE_MS,
  checkCommentRateLimit,
  pruneCommentRateLimits,
} from "../utils/liveStreamRateLimit.js";
import {
  getSessionById,
  isSessionActiveInMemory,
  recordHostHeartbeat,
  syncViewerCount,
} from "../services/liveStream.service.js";
import {
  getRecentLiveComments,
  saveLiveComment,
  type PersistedLiveComment,
} from "../services/liveStreamComments.service.js";

type LiveComment = PersistedLiveComment;

type SessionRoomState = {
  comments: LiveComment[];
  pendingBatch: LiveComment[];
  batchTimer: ReturnType<typeof setTimeout> | null;
  lastViewerEmitAt: number;
};

const sessionRooms = new Map<string, SessionRoomState>();

function getRoomState(sessionId: string): SessionRoomState {
  let state = sessionRooms.get(sessionId);
  if (!state) {
    state = {
      comments: [],
      pendingBatch: [],
      batchTimer: null,
      lastViewerEmitAt: 0,
    };
    sessionRooms.set(sessionId, state);
  }
  return state;
}

function flushCommentBatch(io: Server, sessionId: string) {
  const state = sessionRooms.get(sessionId);
  if (!state || state.pendingBatch.length === 0) return;

  const batch = state.pendingBatch.splice(0, state.pendingBatch.length);
  io.to(`live:${sessionId}`).emit("live-comments-batch", { sessionId, comments: batch });
}

function scheduleCommentBatch(io: Server, sessionId: string) {
  const state = getRoomState(sessionId);
  if (state.batchTimer) return;

  state.batchTimer = setTimeout(() => {
    state.batchTimer = null;
    flushCommentBatch(io, sessionId);
  }, LIVE_COMMENT_BATCH_MS);
}

function pushComment(io: Server, sessionId: string, comment: LiveComment) {
  const state = getRoomState(sessionId);
  state.comments.push(comment);
  if (state.comments.length > LIVE_COMMENT_BUFFER_SIZE) {
    state.comments.splice(0, state.comments.length - LIVE_COMMENT_BUFFER_SIZE);
  }
  state.pendingBatch.push(comment);
  scheduleCommentBatch(io, sessionId);
}

function emitViewerCount(io: Server, sessionId: string, force = false) {
  const state = getRoomState(sessionId);
  const now = Date.now();
  if (!force && now - state.lastViewerEmitAt < LIVE_VIEWER_COUNT_THROTTLE_MS) {
    return;
  }
  state.lastViewerEmitAt = now;

  const room = io.sockets.adapter.rooms.get(`live:${sessionId}`);
  const count = room ? room.size : 0;
  syncViewerCount(sessionId, count).catch(() => {});
  io.to(`live:${sessionId}`).emit("viewer-count", { sessionId, count });
}

function cleanupSessionRoom(sessionId: string) {
  const state = sessionRooms.get(sessionId);
  if (state?.batchTimer) clearTimeout(state.batchTimer);
  sessionRooms.delete(sessionId);
}

async function loadCommentHistory(sessionId: string): Promise<LiveComment[]> {
  const cached = getRoomState(sessionId).comments;
  if (cached.length > 0) {
    return cached.slice(-40);
  }
  const fromDb = await getRecentLiveComments(sessionId, 40);
  const state = getRoomState(sessionId);
  state.comments = fromDb.slice(-LIVE_COMMENT_BUFFER_SIZE);
  return fromDb;
}

export function registerLiveSocket(io: Server) {
  setInterval(() => pruneCommentRateLimits(), 60_000);

  io.on("connection", (socket: Socket) => {
    const userId = (socket.data as { userId: string }).userId;

    socket.on("subscribe-live-scope", (data: { scope?: string; entityId?: string }) => {
      const scope = data?.scope;
      const entityId = data?.entityId;
      if (
        (scope !== "church" && scope !== "group") ||
        !entityId ||
        !mongoose.isValidObjectId(entityId)
      ) {
        return;
      }
      socket.join(`live-scope:${scope}:${entityId}`);
    });

    socket.on("unsubscribe-live-scope", (data: { scope?: string; entityId?: string }) => {
      const scope = data?.scope;
      const entityId = data?.entityId;
      if (!scope || !entityId) return;
      socket.leave(`live-scope:${scope}:${entityId}`);
    });

    socket.on(
      "host-heartbeat",
      async (data: { scope?: string; entityId?: string }) => {
        const scope = data?.scope;
        const entityId = data?.entityId;
        if (
          (scope !== "church" && scope !== "group") ||
          !entityId ||
          !mongoose.isValidObjectId(entityId)
        ) {
          return;
        }
        try {
          await recordHostHeartbeat({
            scope,
            entityId,
            userId,
          });
          socket.emit("host-heartbeat-ack", { ok: true });
        } catch (e) {
          socket.emit("live-error", {
            message: (e as Error).message ?? "Heartbeat failed",
          });
        }
      }
    );

    socket.on("join-live", async (data: { sessionId?: string }) => {
      const sessionId = data?.sessionId;
      if (!sessionId || !mongoose.isValidObjectId(sessionId)) {
        socket.emit("live-error", { message: "Invalid session" });
        return;
      }

      try {
        const session = await getSessionById(sessionId);
        if (session.status !== "live") {
          socket.emit("stream-ended", {
            sessionId,
            reason: "already_ended",
          });
          return;
        }

        socket.join(`live:${sessionId}`);
        (socket.data as { liveSessionId?: string }).liveSessionId = sessionId;

        const history = await loadCommentHistory(sessionId);
        socket.emit("live-history", { sessionId, comments: history });

        emitViewerCount(io, sessionId, true);
      } catch (e) {
        socket.emit("live-error", {
          message: (e as Error).message ?? "Unable to join live",
        });
      }
    });

    socket.on("leave-live", (data: { sessionId?: string }) => {
      const sessionId = data?.sessionId;
      if (!sessionId) return;
      socket.leave(`live:${sessionId}`);
      if ((socket.data as { liveSessionId?: string }).liveSessionId === sessionId) {
        delete (socket.data as { liveSessionId?: string }).liveSessionId;
      }
      emitViewerCount(io, sessionId);
    });

    socket.on(
      "live-comment",
      async (data: { sessionId?: string; text?: string }) => {
        const sessionId = data?.sessionId;
        const text = typeof data?.text === "string" ? data.text.trim() : "";
        if (!sessionId || !text) {
          socket.emit("live-error", { message: "Missing comment text" });
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
          const user = await User.findById(userId).select("name avatar").lean();
          const comment = await saveLiveComment({
            sessionId,
            userId,
            userName: user?.name ?? "User",
            avatar: user?.avatar ?? "",
            text,
          });

          pushComment(io, sessionId, comment);
        } catch (e) {
          socket.emit("live-error", {
            message: (e as Error).message ?? "Failed to send comment",
          });
        }
      }
    );

    socket.on("disconnect", () => {
      const sessionId = (socket.data as { liveSessionId?: string }).liveSessionId;
      if (sessionId) emitViewerCount(io, sessionId);
    });
  });
}

export function notifyLiveSessionEnded(sessionId: string) {
  cleanupSessionRoom(sessionId);
}
