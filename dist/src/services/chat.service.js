import mongoose from "mongoose";
import { Conversation, conversationMemberKey, newGroupMemberKey, } from "../models/conversation.model.js";
import { Message } from "../models/message.model.js";
import { ConversationHide } from "../models/conversationHide.model.js";
import { Notification } from "../models/notification.model.js";
import { User } from "../models/user.model.js";
import { UserBlock } from "../models/userBlock.model.js";
import { timeAgo } from "../utils/timeAgo.js";
export async function toConversationListItem(conv, viewerId) {
    const base = {
        id: conv._id.toString(),
        lastMessage: conv.lastMessageText ?? "",
        time: conv.lastMessageAt ? timeAgo(conv.lastMessageAt) : "",
    };
    const kind = conv.kind || "direct";
    if (kind === "group") {
        return {
            ...base,
            isGroup: true,
            title: (conv.title || "Group").trim(),
            image: conv.image ?? "",
            memberCount: conv.members.length,
        };
    }
    const peerId = conv.members
        .map((m) => m._id.toString())
        .find((id) => id !== viewerId);
    const peer = peerId
        ? conv.members.find((m) => m._id.toString() === peerId)
        : null;
    return {
        ...base,
        isGroup: false,
        peer: peer
            ? {
                id: peer._id.toString(),
                name: peer.name,
                avatar: peer.avatar ?? "",
            }
            : { id: "", name: "Unknown", avatar: "" },
    };
}
export async function listConversations(userId) {
    const hidden = await ConversationHide.find({ user: userId }).distinct("conversation");
    const hiddenSet = new Set(hidden.map((id) => id.toString()));
    const convs = await Conversation.find({
        members: new mongoose.Types.ObjectId(userId),
    })
        .sort({ lastMessageAt: -1 })
        .populate("members", "name avatar")
        .lean();
    const out = [];
    for (const c of convs) {
        if (hiddenSet.has(c._id.toString()))
            continue;
        const members = c.members || [];
        out.push(await toConversationListItem({
            _id: c._id,
            kind: c.kind,
            title: c.title,
            image: c.image,
            lastMessageText: c.lastMessageText,
            lastMessageAt: c.lastMessageAt,
            members,
        }, userId));
    }
    return out;
}
export async function getOrCreateConversation(userId, peerUserId) {
    if (userId === peerUserId) {
        const err = new Error("Invalid peer");
        err.statusCode = 400;
        throw err;
    }
    const blocked = await UserBlock.findOne({
        $or: [
            { blocker: userId, blocked: peerUserId },
            { blocker: peerUserId, blocked: userId },
        ],
    });
    if (blocked) {
        const err = new Error("Cannot message this user");
        err.statusCode = 403;
        throw err;
    }
    const peer = await User.findById(peerUserId);
    if (!peer) {
        const err = new Error("User not found");
        err.statusCode = 404;
        throw err;
    }
    const key = conversationMemberKey(userId, peerUserId);
    let conv = await Conversation.findOne({
        memberKey: key,
        $or: [{ kind: "direct" }, { kind: { $exists: false } }],
    });
    if (!conv) {
        conv = await Conversation.create({
            memberKey: key,
            kind: "direct",
            members: [
                new mongoose.Types.ObjectId(userId),
                new mongoose.Types.ObjectId(peerUserId),
            ].sort((a, b) => a.toString().localeCompare(b.toString())),
        });
    }
    await ConversationHide.deleteOne({
        user: userId,
        conversation: conv._id,
    });
    return { conversationId: conv._id.toString() };
}
export async function createGroupConversation(creatorId, body) {
    if (!body.title?.trim()) {
        const err = new Error("title is required");
        err.statusCode = 400;
        throw err;
    }
    const ids = new Set();
    ids.add(creatorId);
    for (const id of body.memberIds || []) {
        if (mongoose.isValidObjectId(id))
            ids.add(id);
    }
    if (ids.size < 2) {
        const err = new Error("At least one other member is required");
        err.statusCode = 400;
        throw err;
    }
    const members = [...ids].map((id) => new mongoose.Types.ObjectId(id));
    const conv = await Conversation.create({
        memberKey: newGroupMemberKey(),
        kind: "group",
        members,
        title: body.title.trim(),
        image: body.image?.trim() ?? "",
        admins: [new mongoose.Types.ObjectId(creatorId)],
    });
    await ConversationHide.deleteOne({
        user: creatorId,
        conversation: conv._id,
    });
    return { conversationId: conv._id.toString() };
}
export async function leaveGroupConversation(conversationId, userId) {
    const conv = await Conversation.findById(conversationId);
    if (!conv) {
        const err = new Error("Conversation not found");
        err.statusCode = 404;
        throw err;
    }
    if (conv.kind !== "group") {
        const err = new Error("Not a group conversation");
        err.statusCode = 400;
        throw err;
    }
    if (!conv.members.some((m) => m.toString() === userId)) {
        const err = new Error("Not a member");
        err.statusCode = 403;
        throw err;
    }
    const formerMemberIds = conv.members.map((m) => m.toString());
    conv.members = conv.members.filter((m) => m.toString() !== userId);
    conv.admins = conv.admins.filter((a) => a.toString() !== userId);
    if (conv.members.length && !conv.admins.length) {
        conv.admins = [conv.members[0]];
    }
    if (conv.members.length < 2) {
        await Message.deleteMany({ conversation: conv._id });
        await ConversationHide.deleteMany({ conversation: conv._id });
        await conv.deleteOne();
        return { left: true, deleted: true, formerMemberIds };
    }
    await conv.save();
    return { left: true, deleted: false };
}
function mapMessageRow(m, viewerId) {
    const pop = m.sender;
    let senderId;
    let senderName = "";
    let senderAvatar = "";
    if (pop &&
        typeof pop === "object" &&
        "_id" in pop &&
        pop._id) {
        const d = pop;
        senderId = d._id.toString();
        senderName = d.name ?? "";
        senderAvatar = d.avatar ?? "";
    }
    else {
        senderId = pop.toString();
    }
    const isMe = senderId === viewerId;
    return {
        id: m._id.toString(),
        text: m.text,
        messageType: m.messageType ?? "text",
        sender: isMe ? "me" : "other",
        senderUserId: senderId,
        senderName,
        senderAvatar,
        time: timeAgo(m.createdAt),
        createdAt: m.createdAt,
    };
}
export async function listMessages(conversationId, userId, opts) {
    const conv = await Conversation.findById(conversationId);
    if (!conv || !conv.members.some((m) => m.toString() === userId)) {
        const err = new Error("Conversation not found");
        err.statusCode = 404;
        throw err;
    }
    const limit = Math.min(100, Math.max(1, opts?.limit ?? 50));
    const filter = { conversation: conversationId };
    if (opts?.before) {
        const beforeMsg = await Message.findById(opts.before);
        if (beforeMsg)
            filter.createdAt = { $lt: beforeMsg.createdAt };
    }
    const msgs = await Message.find(filter)
        .sort({ createdAt: -1 })
        .limit(limit)
        .populate("sender", "name avatar")
        .lean();
    return msgs.reverse().map((m) => mapMessageRow(m, userId));
}
export async function persistInboundChatMessage(conversationId, senderId, text, messageType = "text") {
    const conv = await Conversation.findById(conversationId);
    if (!conv || !conv.members.some((m) => m.toString() === senderId)) {
        const err = new Error("Conversation not found");
        err.statusCode = 404;
        throw err;
    }
    const trimmed = text.trim();
    if (!trimmed) {
        const err = new Error("text is required");
        err.statusCode = 400;
        throw err;
    }
    const allowed = ["text", "image", "video", "audio", "file"];
    const mt = allowed.includes(messageType)
        ? messageType
        : "text";
    const msg = await Message.create({
        conversation: conversationId,
        sender: senderId,
        text: trimmed,
        messageType: mt,
    });
    conv.lastMessageText = trimmed.slice(0, 200);
    conv.lastMessageAt = msg.createdAt;
    await conv.save();
    const populated = await Message.findById(msg._id)
        .populate("sender", "name avatar")
        .lean();
    const s = populated?.sender;
    const senderUserId = s?._id?.toString() ?? senderId;
    for (const mid of conv.members) {
        if (mid.toString() === senderId)
            continue;
        await Notification.create({
            user: mid,
            title: "New message",
            body: trimmed.slice(0, 120),
            kind: "message",
            refType: "conversation",
            refId: conversationId,
        });
    }
    const socketPayload = {
        _id: msg._id.toString(),
        conversation: conversationId,
        text: msg.text,
        messageType: mt,
        createdAt: msg.createdAt,
        sender: {
            _id: senderUserId,
            name: s?.name ?? "",
            avatar: s?.avatar ?? "",
        },
    };
    const restForSender = {
        id: msg._id.toString(),
        text: msg.text,
        messageType: mt,
        sender: "me",
        senderUserId,
        senderName: s?.name ?? "",
        senderAvatar: s?.avatar ?? "",
        time: timeAgo(msg.createdAt),
        createdAt: msg.createdAt,
    };
    return {
        socketPayload,
        restForSender,
        memberUserIds: conv.members.map((m) => m.toString()),
    };
}
/** @deprecated use persistInboundChatMessage + emit layer */
export async function sendMessage(conversationId, senderId, text) {
    const r = await persistInboundChatMessage(conversationId, senderId, text);
    return r.restForSender;
}
export async function hideConversationForUser(userId, conversationId) {
    const conv = await Conversation.findById(conversationId);
    if (!conv || !conv.members.some((m) => m.toString() === userId)) {
        const err = new Error("Conversation not found");
        err.statusCode = 404;
        throw err;
    }
    await ConversationHide.findOneAndUpdate({ user: userId, conversation: conversationId }, {}, { upsert: true });
}
