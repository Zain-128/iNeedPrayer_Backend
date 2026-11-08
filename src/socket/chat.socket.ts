import type { Server } from "socket.io";
import { verifyAccessToken } from "../utils/jwt.util.js";
import { Conversation } from "../models/conversation.model.js";
import { User } from "../models/user.model.js";
import {
  persistInboundChatMessage,
  editMessage,
  deleteMessage,
} from "../services/chat.service.js";
import {
  broadcastNewMessage,
  broadcastChatUpdated,
  broadcastMessageUpdated,
  broadcastMessageDeleted,
} from "./chat.emit.js";

type CachedProfile = { name: string; avatar: string; at: number };
const userProfileCache = new Map<string, CachedProfile>();
const USER_PROFILE_CACHE_MS = 5 * 60_000;

async function loadUserProfile(userId: string): Promise<CachedProfile> {
  const cached = userProfileCache.get(userId);
  if (cached && Date.now() - cached.at < USER_PROFILE_CACHE_MS) {
    return cached;
  }
  const user = await User.findById(userId).select("name avatar").lean();
  const profile: CachedProfile = {
    name: user?.name ?? "User",
    avatar: user?.avatar ?? "",
    at: Date.now(),
  };
  userProfileCache.set(userId, profile);
  return profile;
}

// In-memory registry for typing state with automatic expiration
const typingTimers = new Map<string, NodeJS.Timeout>();
const TYPING_TIMEOUT_MS = 4000;

function emitTypingState(
  socket: any,
  conversationId: string,
  userId: string,
  userName: string,
  userAvatar: string,
  isTyping: boolean
) {
  const payload = {
    conversationId,
    userId,
    userName,
    userAvatar,
    isTyping,
  };
  socket.to(`chat:${conversationId}`).emit("typing:update", payload);
  if (isTyping) {
    socket.to(`chat:${conversationId}`).emit("user-typing", {
      conversationId,
      userId,
      userName,
      userAvatar,
    });
  } else {
    socket.to(`chat:${conversationId}`).emit("user-stop-typing", {
      conversationId,
      userId,
    });
  }
}

function handleTypingStart(
  socket: any,
  conversationId: string,
  userId: string,
  userName: string,
  userAvatar: string
) {
  const key = `${conversationId}:${userId}`;
  const existingTimer = typingTimers.get(key);
  if (existingTimer) {
    clearTimeout(existingTimer);
  }

  const timer = setTimeout(() => {
    typingTimers.delete(key);
    emitTypingState(socket, conversationId, userId, userName, userAvatar, false);
  }, TYPING_TIMEOUT_MS);

  typingTimers.set(key, timer);
  emitTypingState(socket, conversationId, userId, userName, userAvatar, true);
}

function handleTypingStop(
  socket: any,
  conversationId: string,
  userId: string,
  userName: string,
  userAvatar: string
) {
  const key = `${conversationId}:${userId}`;
  const existingTimer = typingTimers.get(key);
  if (existingTimer) {
    clearTimeout(existingTimer);
    typingTimers.delete(key);
  }
  emitTypingState(socket, conversationId, userId, userName, userAvatar, false);
}

export function registerChatSocket(io: Server) {
  io.use(async (socket, next) => {
    const t =
      (socket.handshake.auth as { token?: string } | undefined)?.token ??
      socket.handshake.query?.token;
    const raw = Array.isArray(t) ? t[0] : t;
    if (!raw || typeof raw !== "string") {
      return next(new Error("auth_required"));
    }
    try {
      const { userId } = verifyAccessToken(raw);
      const profile = await loadUserProfile(userId);
      const data = socket.data as {
        userId?: string;
        userName?: string;
        userAvatar?: string;
      };
      data.userId = userId;
      data.userName = profile.name;
      data.userAvatar = profile.avatar;
      next();
    } catch {
      next(new Error("auth_invalid"));
    }
  });

  io.on("connection", (socket) => {
    const data = socket.data as {
      userId: string;
      userName?: string;
      userAvatar?: string;
    };
    const userId = data.userId;
    const userName = data.userName || "User";
    const userAvatar = data.userAvatar || "";

    socket.on("user-online", (uid: unknown) => {
      if (String(uid) !== userId) return;
      socket.join(`user:${userId}`);
    });

    socket.on("join-chat", async (conversationId: unknown) => {
      const id = typeof conversationId === "string" ? conversationId : "";
      if (!id) return;
      const conv = await Conversation.findById(id);
      if (!conv || !conv.members.some((m) => m.toString() === userId)) {
        socket.emit("message-error", { message: "Cannot join this chat" });
        return;
      }
      socket.join(`chat:${id}`);
    });

    socket.on("leave-chat", (data: unknown) => {
      const id =
        typeof data === "string"
          ? data
          : (data as { conversationId?: string })?.conversationId ?? "";
      if (id) {
        handleTypingStop(socket, id, userId, userName, userAvatar);
        socket.leave(`chat:${id}`);
      }
    });

    // Real-Time Typing Indicators (supports typing:start, typing-start, typing:stop, typing-stop)
    const onStartTyping = async (payload: unknown) => {
      const id =
        typeof payload === "string"
          ? payload
          : (payload as { conversationId?: string })?.conversationId ?? "";
      if (!id) return;
      const conv = await Conversation.findById(id).select("members").lean();
      if (!conv || !conv.members.some((m) => m.toString() === userId)) return;
      handleTypingStart(socket, id, userId, userName, userAvatar);
    };

    const onStopTyping = (payload: unknown) => {
      const id =
        typeof payload === "string"
          ? payload
          : (payload as { conversationId?: string })?.conversationId ?? "";
      if (!id) return;
      handleTypingStop(socket, id, userId, userName, userAvatar);
    };

    socket.on("typing:start", onStartTyping);
    socket.on("typing-start", onStartTyping);
    socket.on("typing:stop", onStopTyping);
    socket.on("typing-stop", onStopTyping);

    // Send Message with idempotency & retry support
    socket.on(
      "send-message",
      async (data: {
        conversationId?: string;
        chatId?: string;
        clientMessageId?: string;
        text?: string;
        content?: string;
        messageType?: string;
        fileUrl?: string;
        fileName?: string;
        fileSize?: number;
        mimeType?: string;
        duration?: number;
        metadata?: {
          fileUrl?: string;
          fileName?: string;
          fileSize?: number;
          mimeType?: string;
          duration?: number;
          clientMessageId?: string;
        };
      }) => {
        try {
          const conversationId = data?.conversationId ?? data?.chatId;
          const text = data?.text ?? data?.content ?? "";
          const effectiveFileUrl =
            typeof data?.fileUrl === "string" && data.fileUrl.trim()
              ? data.fileUrl.trim()
              : typeof data?.metadata?.fileUrl === "string"
              ? data.metadata.fileUrl.trim()
              : "";
          const effectiveClientMessageId =
            typeof data?.clientMessageId === "string" &&
            data.clientMessageId.trim()
              ? data.clientMessageId.trim()
              : typeof data?.metadata?.clientMessageId === "string" &&
                data.metadata.clientMessageId.trim()
              ? data.metadata.clientMessageId.trim()
              : undefined;

          if (!conversationId || (!String(text).trim() && !effectiveFileUrl)) {
            socket.emit("message-error", {
              message: "Missing conversationId, text, or media",
            });
            return;
          }

          // Stop typing on send
          handleTypingStop(socket, conversationId, userId, userName, userAvatar);

          const persisted = await persistInboundChatMessage(
            conversationId,
            userId,
            String(text),
            data?.messageType || "text",
            {
              clientMessageId: effectiveClientMessageId,
              fileUrl: effectiveFileUrl,
              fileName:
                data?.fileName ?? data?.metadata?.fileName ?? "",
              fileSize:
                data?.fileSize ?? data?.metadata?.fileSize ?? 0,
              mimeType:
                data?.mimeType ?? data?.metadata?.mimeType ?? "",
              duration:
                data?.duration ?? data?.metadata?.duration ?? 0,
            }
          );

          if (!persisted.isDuplicate) {
            broadcastNewMessage(io, conversationId, persisted.socketPayload);
            await broadcastChatUpdated(io, conversationId);
          }

          socket.emit("message-sent", {
            message: persisted.restForSender,
            isDuplicate: !!persisted.isDuplicate,
          });
        } catch (e) {
          socket.emit("message-error", {
            message: (e as Error).message ?? "Failed to send",
          });
        }
      }
    );

    // Socket-based Edit Message
    const onEditMessage = async (data: {
      conversationId?: string;
      chatId?: string;
      messageId?: string;
      id?: string;
      text?: string;
      messageType?: string;
      fileUrl?: string;
      fileName?: string;
      fileSize?: number;
      mimeType?: string;
      duration?: number;
    }) => {
      try {
        const conversationId = data?.conversationId ?? data?.chatId;
        const messageId = data?.messageId ?? data?.id;
        if (!conversationId || !messageId) {
          socket.emit("message-error", {
            message: "Missing conversationId or messageId",
          });
          return;
        }
        const updated = await editMessage(conversationId, messageId, userId, data);
        broadcastMessageUpdated(io, conversationId, messageId, updated);
        await broadcastChatUpdated(io, conversationId);
        socket.emit("message-edited-success", { message: updated });
      } catch (e) {
        socket.emit("message-error", {
          message: (e as Error).message ?? "Failed to edit message",
        });
      }
    };

    socket.on("message:edit", onEditMessage);
    socket.on("edit-message", onEditMessage);

    // Socket-based Delete Message
    const onDeleteMessage = async (data: {
      conversationId?: string;
      chatId?: string;
      messageId?: string;
      id?: string;
    }) => {
      try {
        const conversationId = data?.conversationId ?? data?.chatId;
        const messageId = data?.messageId ?? data?.id;
        if (!conversationId || !messageId) {
          socket.emit("message-error", {
            message: "Missing conversationId or messageId",
          });
          return;
        }
        await deleteMessage(conversationId, messageId, userId);
        broadcastMessageDeleted(io, conversationId, messageId);
        await broadcastChatUpdated(io, conversationId);
        socket.emit("message-deleted-success", { conversationId, messageId });
      } catch (e) {
        socket.emit("message-error", {
          message: (e as Error).message ?? "Failed to delete message",
        });
      }
    };

    socket.on("message:delete", onDeleteMessage);
    socket.on("delete-message", onDeleteMessage);

    // Disconnect cleanup: clear user's typing indicators
    socket.on("disconnect", () => {
      for (const [key, timer] of typingTimers.entries()) {
        if (key.endsWith(`:${userId}`)) {
          clearTimeout(timer);
          typingTimers.delete(key);
          const convId = key.split(":")[0];
          emitTypingState(socket, convId, userId, userName, userAvatar, false);
        }
      }
    });
  });
}
