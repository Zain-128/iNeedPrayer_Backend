import type { Server } from "socket.io";
import jwt from "jsonwebtoken";
import { JWT_SECRET } from "../contants.js";
import { Conversation } from "../models/conversation.model.js";
import { persistInboundChatMessage } from "../services/chat.service.js";
import { broadcastNewMessage, broadcastChatUpdated } from "./chat.emit.js";

export function registerChatSocket(io: Server) {
  io.use((socket, next) => {
    const t =
      (socket.handshake.auth as { token?: string } | undefined)?.token ??
      socket.handshake.query?.token;
    const raw = Array.isArray(t) ? t[0] : t;
    if (!raw || typeof raw !== "string") {
      return next(new Error("auth_required"));
    }
    try {
      const decoded = jwt.verify(raw, JWT_SECRET) as { userId: string };
      (socket.data as { userId?: string }).userId = decoded.userId;
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
