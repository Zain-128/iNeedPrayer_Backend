import type { Server } from "socket.io";
import mongoose from "mongoose";
import { Conversation } from "../models/conversation.model.js";
import { toConversationListItem } from "../services/chat.service.js";

type LeanMember = { _id: mongoose.Types.ObjectId; name: string; avatar?: string };

export function broadcastNewMessage(
  io: Server,
  conversationId: string,
  payload: unknown
) {
  io.to(`chat:${conversationId}`).emit("new-message", payload);
  io.to(`chat:${conversationId}`).emit("message:created", payload);
}

export function broadcastMessageUpdated(
  io: Server,
  conversationId: string,
  messageId: string,
  message: unknown
) {
  const payload = {
    conversationId,
    messageId,
    message,
  };
  io.to(`chat:${conversationId}`).emit("message:updated", payload);
  io.to(`chat:${conversationId}`).emit("message-edited", payload);
}

export function broadcastMessageDeleted(
  io: Server,
  conversationId: string,
  messageId: string
) {
  const payload = {
    conversationId,
    messageId,
  };
  io.to(`chat:${conversationId}`).emit("message:deleted", payload);
  io.to(`chat:${conversationId}`).emit("message-deleted", payload);
}

export async function broadcastChatUpdated(io: Server, conversationId: string) {
  const conv = await Conversation.findById(conversationId)
    .populate("members", "name avatar")
    .lean();
  if (!conv) return;
  const members = (conv.members as unknown as LeanMember[]) || [];
  for (const m of members) {
    const item = await toConversationListItem(
      {
        _id: conv._id,
        kind: (conv as { kind?: string }).kind,
        title: (conv as { title?: string }).title,
        image: (conv as { image?: string }).image,
        description: (conv as any).description,
        group: (conv as any).group,
        isCommunityGroup: (conv as any).isCommunityGroup,
        privacy: (conv as any).privacy,
        status: (conv as any).status,
        requestedBy: (conv as any).requestedBy,
        lastMessageText: conv.lastMessageText,
        lastMessageAt: conv.lastMessageAt,
        lastReadAt: (conv as any).lastReadAt,
        archivedBy: (conv as any).archivedBy,
        mutedBy: (conv as any).mutedBy,
        members,
      },
      m._id.toString()
    );
    io.to(`user:${m._id.toString()}`).emit("chat-updated", item);
  }
}
