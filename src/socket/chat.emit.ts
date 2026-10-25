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
        lastMessageText: conv.lastMessageText,
        lastMessageAt: conv.lastMessageAt,
        members,
      },
      m._id.toString()
    );
    io.to(`user:${m._id.toString()}`).emit("chat-updated", item);
  }
}
