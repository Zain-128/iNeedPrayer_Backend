import { Conversation } from "../models/conversation.model.js";
import { toConversationListItem } from "../services/chat.service.js";
export function broadcastNewMessage(io, conversationId, payload) {
    io.to(`chat:${conversationId}`).emit("new-message", payload);
}
export async function broadcastChatUpdated(io, conversationId) {
    const conv = await Conversation.findById(conversationId)
        .populate("members", "name avatar")
        .lean();
    if (!conv)
        return;
    const members = conv.members || [];
    for (const m of members) {
        const item = await toConversationListItem({
            _id: conv._id,
            kind: conv.kind,
            title: conv.title,
            image: conv.image,
            lastMessageText: conv.lastMessageText,
            lastMessageAt: conv.lastMessageAt,
            members,
        }, m._id.toString());
        io.to(`user:${m._id.toString()}`).emit("chat-updated", item);
    }
}
