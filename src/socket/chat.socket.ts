import type { Server } from "socket.io";
import { verifyAccessToken } from "../utils/jwt.util.js";
import { Conversation } from "../models/conversation.model.js";
import { User } from "../models/user.model.js";
import { persistInboundChatMessage } from "../services/chat.service.js";
import { broadcastNewMessage, broadcastChatUpdated } from "./chat.emit.js";

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
    const userId = (socket.data as { userId: string }).userId;

    socket.on("user-online", (uid: unknown) => {
      if (String(uid) !== userId) return;
      socket.join(`user:${userId}`);
    });

    socket.on("join-chat", async (conversationId: unknown) => {
      const id = typeof conversationId === "string" ? conversationId : "";
      if (!id) return;
      const conv = await Conversation.findById(id);
      if (
        !conv ||
        !conv.members.some((m) => m.toString() === userId)
      ) {
        socket.emit("message-error", { message: "Cannot join this chat" });
        return;
      }
      socket.join(`chat:${id}`);
    });

    socket.on("leave-chat", (conversationId: unknown) => {
      const id = typeof conversationId === "string" ? conversationId : "";
      if (id) socket.leave(`chat:${id}`);
    });

    socket.on(
      "send-message",
      async (data: {
        conversationId?: string;
        chatId?: string;
        text?: string;
        content?: string;
        messageType?: string;
      }) => {
        try {
          const conversationId = data?.conversationId ?? data?.chatId;
          const text = data?.text ?? data?.content;
          if (!conversationId || text === undefined || text === null) {
            socket.emit("message-error", {
              message: "Missing conversationId or text",
            });
            return;
          }
          const persisted = await persistInboundChatMessage(
            conversationId,
            userId,
            String(text),
            data?.messageType || "text"
          );
          broadcastNewMessage(io, conversationId, persisted.socketPayload);
          await broadcastChatUpdated(io, conversationId);
        } catch (e) {
          socket.emit("message-error", {
            message: (e as Error).message ?? "Failed to send",
          });
        }
      }
    );
  });
}
