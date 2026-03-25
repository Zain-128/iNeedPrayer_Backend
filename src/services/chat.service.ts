import mongoose from "mongoose";
import {
  Conversation,
  conversationMemberKey,
  newGroupMemberKey,
} from "../models/conversation.model.js";
import { Message } from "../models/message.model.js";
import { ConversationHide } from "../models/conversationHide.model.js";
import { Notification } from "../models/notification.model.js";
import { User } from "../models/user.model.js";
import { UserBlock } from "../models/userBlock.model.js";
import { timeAgo } from "../utils/timeAgo.js";

type LeanMember = { _id: mongoose.Types.ObjectId; name: string; avatar?: string };

export type ConversationListItem =
  | {
      id: string;
      isGroup: false;
      peer: { id: string; name: string; avatar: string };
      lastMessage: string;
      time: string;
    }
  | {
      id: string;
      isGroup: true;
      title: string;
      image: string;
      memberCount: number;
      lastMessage: string;
      time: string;
    };

export async function toConversationListItem(
  conv: {
    _id: mongoose.Types.ObjectId;
    kind?: string;
    title?: string;
    image?: string;
    lastMessageText?: string;
    lastMessageAt?: Date | null;
    members: LeanMember[];
  },
  viewerId: string
): Promise<ConversationListItem> {
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

export async function listConversations(userId: string) {
  const hidden = await ConversationHide.find({ user: userId }).distinct(
    "conversation"
  );
  const hiddenSet = new Set(hidden.map((id) => id.toString()));

  const convs = await Conversation.find({
    members: new mongoose.Types.ObjectId(userId),
  })
    .sort({ lastMessageAt: -1 })
    .populate("members", "name avatar")
    .lean();

  const out: ConversationListItem[] = [];
  for (const c of convs) {
    if (hiddenSet.has(c._id.toString())) continue;
    const members = (c.members as unknown as LeanMember[]) || [];
    out.push(
      await toConversationListItem(
        {
          _id: c._id,
          kind: (c as { kind?: string }).kind,
          title: (c as { title?: string }).title,
          image: (c as { image?: string }).image,
          lastMessageText: c.lastMessageText,
          lastMessageAt: c.lastMessageAt,
          members,
        },
        userId
      )
    );
  }
  return out;
}

export async function getOrCreateConversation(userId: string, peerUserId: string) {
  if (userId === peerUserId) {
    const err = new Error("Invalid peer");
    (err as Error & { statusCode?: number }).statusCode = 400;
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
    (err as Error & { statusCode?: number }).statusCode = 403;
    throw err;
  }
  const peer = await User.findById(peerUserId);
  if (!peer) {
    const err = new Error("User not found");
    (err as Error & { statusCode?: number }).statusCode = 404;
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

export async function createGroupConversation(
  creatorId: string,
  body: { title: string; memberIds: string[]; image?: string }
) {
  if (!body.title?.trim()) {
    const err = new Error("title is required");
    (err as Error & { statusCode?: number }).statusCode = 400;
    throw err;
  }
  const ids = new Set<string>();
  ids.add(creatorId);
  for (const id of body.memberIds || []) {
    if (mongoose.isValidObjectId(id)) ids.add(id);
  }
  if (ids.size < 2) {
    const err = new Error("At least one other member is required");
    (err as Error & { statusCode?: number }).statusCode = 400;
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

export async function leaveGroupConversation(
  conversationId: string,
  userId: string
) {
  const conv = await Conversation.findById(conversationId);
  if (!conv) {
    const err = new Error("Conversation not found");
    (err as Error & { statusCode?: number }).statusCode = 404;
    throw err;
  }
  if (conv.kind !== "group") {
    const err = new Error("Not a group conversation");
    (err as Error & { statusCode?: number }).statusCode = 400;
    throw err;
  }
  if (!conv.members.some((m) => m.toString() === userId)) {
    const err = new Error("Not a member");
    (err as Error & { statusCode?: number }).statusCode = 403;
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

function mapMessageRow(
  m: {
    _id: mongoose.Types.ObjectId;
    text: string;
    messageType?: string;
    sender: LeanMember | mongoose.Types.ObjectId;
    createdAt: Date;
  },
  viewerId: string
) {
  const pop = m.sender as LeanMember | mongoose.Types.ObjectId;
  let senderId: string;
  let senderName = "";
  let senderAvatar = "";
  if (
    pop &&
    typeof pop === "object" &&
    "_id" in pop &&
    (pop as LeanMember)._id
  ) {
    const d = pop as LeanMember;
    senderId = d._id.toString();
    senderName = d.name ?? "";
    senderAvatar = d.avatar ?? "";
  } else {
    senderId = (pop as mongoose.Types.ObjectId).toString();
  }
  const isMe = senderId === viewerId;
  return {
    id: m._id.toString(),
    text: m.text,
    messageType: m.messageType ?? "text",
    sender: isMe ? ("me" as const) : ("other" as const),
    senderUserId: senderId,
    senderName,
    senderAvatar,
    time: timeAgo(m.createdAt),
    createdAt: m.createdAt,
  };
}

export async function listMessages(
  conversationId: string,
  userId: string,
  opts?: { limit?: number; before?: string }
) {
  const conv = await Conversation.findById(conversationId);
  if (!conv || !conv.members.some((m) => m.toString() === userId)) {
    const err = new Error("Conversation not found");
    (err as Error & { statusCode?: number }).statusCode = 404;
    throw err;
  }
  const limit = Math.min(100, Math.max(1, opts?.limit ?? 50));
  const filter: Record<string, unknown> = { conversation: conversationId };
  if (opts?.before) {
    const beforeMsg = await Message.findById(opts.before);
    if (beforeMsg) filter.createdAt = { $lt: beforeMsg.createdAt };
  }
  const msgs = await Message.find(filter)
    .sort({ createdAt: -1 })
    .limit(limit)
    .populate("sender", "name avatar")
    .lean();
  return msgs.reverse().map((m) => mapMessageRow(m as never, userId));
}

export type PersistedChatMessage = {
  socketPayload: {
    _id: string;
    conversation: string;
    text: string;
    messageType: string;
    createdAt: Date;
    sender: { _id: string; name: string; avatar: string };
  };
  restForSender: {
    id: string;
    text: string;
    messageType: string;
    sender: "me";
    senderUserId: string;
    senderName: string;
    senderAvatar: string;
    time: string;
    createdAt: Date;
  };
  memberUserIds: string[];
};

export async function persistInboundChatMessage(
  conversationId: string,
  senderId: string,
  text: string,
  messageType = "text"
): Promise<PersistedChatMessage> {
  const conv = await Conversation.findById(conversationId);
  if (!conv || !conv.members.some((m) => m.toString() === senderId)) {
    const err = new Error("Conversation not found");
    (err as Error & { statusCode?: number }).statusCode = 404;
    throw err;
  }
  const trimmed = text.trim();
  if (!trimmed) {
    const err = new Error("text is required");
    (err as Error & { statusCode?: number }).statusCode = 400;
    throw err;
  }
  const allowed = ["text", "image", "video", "audio", "file"];
  const mt = allowed.includes(messageType) ? messageType : "text";

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
  const s = populated?.sender as unknown as LeanMember;
  const senderUserId = s?._id?.toString() ?? senderId;

  for (const mid of conv.members) {
    if (mid.toString() === senderId) continue;
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
    sender: "me" as const,
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
export async function sendMessage(
  conversationId: string,
  senderId: string,
  text: string
) {
  const r = await persistInboundChatMessage(conversationId, senderId, text);
  return r.restForSender;
}

export async function hideConversationForUser(
  userId: string,
  conversationId: string
) {
  const conv = await Conversation.findById(conversationId);
  if (!conv || !conv.members.some((m) => m.toString() === userId)) {
    const err = new Error("Conversation not found");
    (err as Error & { statusCode?: number }).statusCode = 404;
    throw err;
  }
  await ConversationHide.findOneAndUpdate(
    { user: userId, conversation: conversationId },
    {},
    { upsert: true }
  );
}
