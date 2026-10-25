import mongoose from "mongoose";
import {
  Conversation,
  conversationMemberKey,
  newGroupMemberKey,
} from "../models/conversation.model.js";
import { Message } from "../models/message.model.js";
import { ConversationHide } from "../models/conversationHide.model.js";
import { User } from "../models/user.model.js";
import { UserBlock } from "../models/userBlock.model.js";
import { FriendRequest } from "../models/friendRequest.model.js";
import { Group } from "../models/group.model.js";
import { GroupMember } from "../models/groupMember.model.js";
import { timeAgo } from "../utils/timeAgo.js";
import { createNotification } from "./notifications.service.js";

function httpError(message: string, statusCode: number) {
  const err = new Error(message);
  (err as any).statusCode = statusCode;
  return err;
}

type LeanMember = {
  _id: mongoose.Types.ObjectId;
  name: string;
  avatar?: string;
  bio?: string;
  city?: string;
  state?: string;
};

export type ConversationListItem =
  | {
      id: string;
      isGroup: false;
      peer: { id: string; name: string; avatar: string };
      lastMessage: string;
      time: string;
      unreadCount: number;
      isArchived: boolean;
      isMuted: boolean;
      status: string;
      isRequest: boolean;
    }
  | {
      id: string;
      isGroup: true;
      title: string;
      image: string;
      description?: string;
      memberCount: number;
      lastMessage: string;
      time: string;
      unreadCount: number;
      isArchived: boolean;
      isMuted: boolean;
      status: string;
      isRequest: boolean;
      isCommunityGroup: boolean;
      groupId: string;
      privacy: string;
    };

export async function toConversationListItem(
  conv: {
    _id: mongoose.Types.ObjectId;
    kind?: string;
    title?: string;
    image?: string;
    description?: string;
    group?: any;
    isCommunityGroup?: boolean;
    privacy?: string;
    status?: string;
    requestedBy?: any;
    lastMessageText?: string;
    lastMessageAt?: Date | null;
    lastReadAt?: any;
    archivedBy?: any[];
    mutedBy?: any[];
    members: any[];
  },
  viewerId: string
): Promise<ConversationListItem> {
  const base = {
    id: conv._id.toString(),
    lastMessage: conv.lastMessageText ?? "",
    time: conv.lastMessageAt ? timeAgo(conv.lastMessageAt) : "",
  };
  const kind = conv.kind || "direct";

  // Unread count
  const lastRead =
    conv.lastReadAt instanceof Map
      ? conv.lastReadAt.get(viewerId)
      : conv.lastReadAt?.[viewerId];
  const unreadQuery: any = {
    conversation: conv._id,
    sender: { $ne: new mongoose.Types.ObjectId(viewerId) },
  };
  if (lastRead) {
    unreadQuery.createdAt = { $gt: lastRead };
  }
  const unreadCount = await Message.countDocuments(unreadQuery);

  // Archive & Mute
  const isArchived =
    Array.isArray(conv.archivedBy) &&
    conv.archivedBy.some((id: any) => id?.toString?.() === viewerId);

  const muteEntry =
    Array.isArray(conv.mutedBy) &&
    conv.mutedBy.find(
      (m: any) =>
        (m.user?._id?.toString?.() ?? m.user?.toString?.()) === viewerId
    );
  const isMuted = !!(
    muteEntry &&
    (!muteEntry.mutedUntil || new Date(muteEntry.mutedUntil) > new Date())
  );

  const status = conv.status || "active";
  const isRequest =
    status === "pending" && conv.requestedBy?.toString() !== viewerId;

  if (kind === "group") {
    const groupId = conv.group?._id?.toString() || conv.group?.toString() || "";
    return {
      ...base,
      isGroup: true,
      title: (conv.title || "Group").trim(),
      image: conv.image ?? "",
      description: conv.description ?? "",
      memberCount: conv.members.length,
      unreadCount,
      isArchived,
      isMuted,
      status,
      isRequest,
      isCommunityGroup: !!conv.isCommunityGroup,
      groupId,
      privacy: conv.privacy || "private",
    };
  }

  const peerId = conv.members
    .map((m: any) => (m._id ? m._id.toString() : m.toString()))
    .find((id: string) => id !== viewerId);
  const peer = peerId
    ? conv.members.find(
        (m: any) => (m._id ? m._id.toString() : m.toString()) === peerId
      )
    : null;

  return {
    ...base,
    isGroup: false,
    peer:
      peer && typeof peer === "object" && "name" in peer
        ? {
            id: peer._id ? peer._id.toString() : peerId || "",
            name: peer.name,
            avatar: peer.avatar ?? "",
          }
        : { id: peerId || "", name: "Unknown", avatar: "" },
    unreadCount,
    isArchived,
    isMuted,
    status,
    isRequest,
  };
}

export async function listConversations(
  userId: string,
  opts?: { tab?: string }
): Promise<ConversationListItem[]> {
  const tab = opts?.tab || "current"; // "current" | "archived" | "requests"
  const hidden = await ConversationHide.find({ user: userId }).distinct(
    "conversation"
  );
  const hiddenSet = new Set(hidden.map((id) => id.toString()));

  const query: any = {
    members: new mongoose.Types.ObjectId(userId),
  };

  if (tab === "archived") {
    query.archivedBy = new mongoose.Types.ObjectId(userId);
    query.status = { $ne: "declined" };
  } else if (tab === "requests") {
    query.status = "pending";
    query.requestedBy = { $ne: new mongoose.Types.ObjectId(userId) };
  } else {
    // Default current tab
    query.archivedBy = { $ne: new mongoose.Types.ObjectId(userId) };
    query.$or = [
      { status: "active" },
      { status: { $exists: false } },
      { status: "pending", requestedBy: new mongoose.Types.ObjectId(userId) },
    ];
  }

  const convs = await Conversation.find(query)
    .sort({ lastMessageAt: -1, updatedAt: -1 })
    .populate("members", "name avatar")
    .lean();

  const out: ConversationListItem[] = [];
  for (const c of convs) {
    if (hiddenSet.has(c._id.toString())) continue;
    const members = (c.members || []) as unknown as LeanMember[];
    out.push(
      await toConversationListItem(
        {
          _id: c._id,
          kind: c.kind,
          title: c.title,
          image: c.image,
          description: (c as any).description,
          group: (c as any).group,
          isCommunityGroup: (c as any).isCommunityGroup,
          privacy: (c as any).privacy,
          status: (c as any).status,
          requestedBy: (c as any).requestedBy,
          lastMessageText: c.lastMessageText,
          lastMessageAt: c.lastMessageAt,
          lastReadAt: (c as any).lastReadAt,
          archivedBy: (c as any).archivedBy,
          mutedBy: (c as any).mutedBy,
          members,
        },
        userId
      )
    );
  }
  return out;
}

export async function getOrCreateConversation(
  userId: string,
  peerUserId: string
): Promise<{ conversationId: string; status: string }> {
  if (userId === peerUserId) {
    throw httpError("Invalid peer", 400);
  }
  const blocked = await UserBlock.findOne({
    $or: [
      { blocker: userId, blocked: peerUserId },
      { blocker: peerUserId, blocked: userId },
    ],
  });
  if (blocked) {
    throw httpError("Cannot message this user", 403);
  }
  const peer = await User.findById(peerUserId);
  if (!peer) {
    throw httpError("User not found", 404);
  }
  const key = conversationMemberKey(userId, peerUserId);
  let conv = await Conversation.findOne({
    memberKey: key,
    $or: [{ kind: "direct" }, { kind: { $exists: false } }],
  });

  // Check friendship status
  const isFriend = await FriendRequest.exists({
    $or: [
      { from: userId, to: peerUserId, status: "accepted" },
      { from: peerUserId, to: userId, status: "accepted" },
    ],
  });

  if (!conv) {
    conv = await Conversation.create({
      memberKey: key,
      kind: "direct",
      status: isFriend ? "active" : "pending",
      requestedBy: isFriend ? null : new mongoose.Types.ObjectId(userId),
      members: [
        new mongoose.Types.ObjectId(userId),
        new mongoose.Types.ObjectId(peerUserId),
      ].sort((a, b) => a.toString().localeCompare(b.toString())),
    });
  } else if ((conv as any).status === "declined" && isFriend) {
    (conv as any).status = "active";
    await conv.save();
  }

  await ConversationHide.deleteOne({
    user: userId,
    conversation: conv._id,
  });

  return { conversationId: conv._id.toString(), status: (conv as any).status || "active" };
}

export async function createGroupConversation(
  creatorId: string,
  body: {
    title: string;
    memberIds: string[];
    image?: string;
    description?: string;
    privacy?: string;
    groupId?: string;
  }
): Promise<{ conversationId: string }> {
  if (body.groupId && mongoose.isValidObjectId(body.groupId)) {
    return getOrCreateGroupChatForCommunityGroup(body.groupId, creatorId);
  }

  const trimmedTitle = (body.title || "").trim();
  const possibleGroupName = trimmedTitle.endsWith(" Chat")
    ? trimmedTitle.slice(0, -" Chat".length).trim()
    : trimmedTitle;

  if (possibleGroupName) {
    const matchedGroup = await Group.findOne({
      $or: [{ name: trimmedTitle }, { name: possibleGroupName }],
    }).select("_id");
    if (matchedGroup) {
      return getOrCreateGroupChatForCommunityGroup(
        matchedGroup._id.toString(),
        creatorId
      );
    }
  }

  if (!trimmedTitle) {
    throw httpError("title is required", 400);
  }
  const ids = new Set<string>();
  ids.add(creatorId);
  for (const id of body.memberIds || []) {
    if (mongoose.isValidObjectId(id)) ids.add(id);
  }
  if (ids.size < 1) {
    throw httpError("At least one member is required", 400);
  }
  const members = [...ids].map((id) => new mongoose.Types.ObjectId(id));
  const conv = await Conversation.create({
    memberKey: newGroupMemberKey(),
    kind: "group",
    members,
    title: trimmedTitle,
    image: body.image?.trim() ?? "",
    description: body.description?.trim() ?? "",
    privacy: body.privacy === "public" ? "public" : "private",
    admins: [new mongoose.Types.ObjectId(creatorId)],
  });

  await ConversationHide.deleteOne({
    user: creatorId,
    conversation: conv._id,
  });

  // System message
  const creatorUser = await User.findById(creatorId).select("name").lean();
  const creatorName = creatorUser?.name || "Admin";
  await Message.create({
    conversation: conv._id,
    sender: creatorId,
    text: `${creatorName} created group "${trimmedTitle}"`,
    messageType: "system",
  });

  return { conversationId: conv._id.toString() };
}

export async function getOrCreateGroupChatForCommunityGroup(
  groupId: string,
  userId: string
): Promise<{ conversationId: string }> {
  const group = await Group.findById(groupId);
  if (!group) {
    throw httpError("Group not found", 404);
  }

  const isPrivate = group.privacy === "Private";
  const isMember =
    (await GroupMember.findOne({ group: groupId, user: userId })) ||
    group.createdBy?.toString() === userId;

  if (isPrivate && !isMember) {
    throw httpError(
      "This is a private group. Join request must be approved first.",
      403
    );
  }

  const key = `grp:${groupId}`;
  let conv = await Conversation.findOne({
    $or: [{ group: groupId }, { memberKey: key }],
  });

  const memberDocs = await GroupMember.find({ group: groupId })
    .select("user role")
    .lean();
  const memberUserIds = new Set(memberDocs.map((m) => m.user.toString()));
  if (group.createdBy) memberUserIds.add(group.createdBy.toString());
  if (userId) memberUserIds.add(userId);

  const members = [...memberUserIds].map((id) => new mongoose.Types.ObjectId(id));
  const adminUserIds = memberDocs
    .filter((m) => m.role === "admin" || m.role === "owner")
    .map((m) => m.user.toString());
  if (group.createdBy) adminUserIds.push(group.createdBy.toString());
  const admins = [...new Set(adminUserIds)].map(
    (id) => new mongoose.Types.ObjectId(id)
  );

  if (!conv) {
    conv = await Conversation.create({
      memberKey: key,
      kind: "group",
      group: group._id,
      isCommunityGroup: true,
      privacy: isPrivate ? "private" : "public",
      title: `${group.name} Chat`,
      image: group.image || "",
      description: group.description || "",
      members,
      admins: admins.length ? admins : [new mongoose.Types.ObjectId(userId)],
    });
  } else {
    conv.members = members;
    if (admins.length) conv.admins = admins;
    if (!conv.group) (conv as any).group = group._id;
    (conv as any).isCommunityGroup = true;
    (conv as any).privacy = isPrivate ? "private" : "public";
    await conv.save();
  }

  await ConversationHide.deleteOne({
    user: userId,
    conversation: conv._id,
  });

  return { conversationId: conv._id.toString() };
}

export async function leaveGroupConversation(
  conversationId: string,
  userId: string
): Promise<{ left: boolean; deleted: boolean; formerMemberIds?: string[] }> {
  const conv = await Conversation.findById(conversationId);
  if (!conv) {
    throw httpError("Conversation not found", 404);
  }
  if (conv.kind !== "group") {
    throw httpError("Not a group conversation", 400);
  }
  if (!conv.members.some((m) => m.toString() === userId)) {
    throw httpError("Not a member", 403);
  }
  const formerMemberIds = conv.members.map((m) => m.toString());
  conv.members = conv.members.filter((m) => m.toString() !== userId);
  conv.admins = conv.admins.filter((a) => a.toString() !== userId);
  if (conv.members.length && !conv.admins.length) {
    conv.admins = [conv.members[0]];
  }

  // System message before deleting or saving
  const leaver = await User.findById(userId).select("name").lean();
  const leaverName = leaver?.name || "User";
  const sysMsg = await Message.create({
    conversation: conv._id,
    sender: userId,
    text: `${leaverName} left the group`,
    messageType: "system",
  });
  conv.lastMessageText = sysMsg.text;
  conv.lastMessageAt = sysMsg.createdAt;

  if (conv.members.length < 1) {
    await Message.deleteMany({ conversation: conv._id });
    await ConversationHide.deleteMany({ conversation: conv._id });
    await conv.deleteOne();
    return { left: true, deleted: true, formerMemberIds };
  }
  await conv.save();
  return { left: true, deleted: false };
}

export async function removeMemberFromGroup(
  conversationId: string,
  actorId: string,
  targetUserId: string
): Promise<{ removed: boolean; deleted: boolean }> {
  if (
    !mongoose.isValidObjectId(conversationId) ||
    !mongoose.isValidObjectId(targetUserId)
  ) {
    throw httpError("Invalid id", 400);
  }
  if (actorId === targetUserId) {
    throw httpError("Cannot remove yourself", 400);
  }
  const conv = await Conversation.findById(conversationId);
  if (!conv) {
    throw httpError("Conversation not found", 404);
  }
  if (conv.kind !== "group") {
    throw httpError("Not a group conversation", 400);
  }
  if (!conv.admins.some((a) => a.toString() === actorId)) {
    throw httpError("Only admins can remove members", 403);
  }
  if (!conv.members.some((m) => m.toString() === targetUserId)) {
    throw httpError("User is not a member", 400);
  }
  conv.members = conv.members.filter((m) => m.toString() !== targetUserId);
  conv.admins = conv.admins.filter((a) => a.toString() !== targetUserId);

  const actorUser = await User.findById(actorId).select("name").lean();
  const targetUser = await User.findById(targetUserId).select("name").lean();
  const sysMsg = await Message.create({
    conversation: conv._id,
    sender: actorId,
    text: `${actorUser?.name || "Admin"} removed ${targetUser?.name || "User"}`,
    messageType: "system",
  });
  conv.lastMessageText = sysMsg.text;
  conv.lastMessageAt = sysMsg.createdAt;

  if (conv.members.length < 1) {
    await Message.deleteMany({ conversation: conv._id });
    await ConversationHide.deleteMany({ conversation: conv._id });
    await conv.deleteOne();
    return { removed: true, deleted: true };
  }
  await conv.save();
  return { removed: true, deleted: false };
}

export async function addMembersToGroup(
  conversationId: string,
  actorId: string,
  userIds: string[]
): Promise<{ added: boolean; conversationId: string }> {
  if (!mongoose.isValidObjectId(conversationId)) {
    throw httpError("Invalid conversation id", 400);
  }
  const conv = await Conversation.findById(conversationId);
  if (!conv) {
    throw httpError("Conversation not found", 404);
  }
  if (conv.kind !== "group") {
    throw httpError("Not a group conversation", 400);
  }
  if (!conv.admins.some((a) => a.toString() === actorId)) {
    throw httpError("Only admins can add members", 403);
  }
  const cur = new Set(conv.members.map((m) => m.toString()));
  const newIds: string[] = [];
  for (const id of userIds) {
    if (mongoose.isValidObjectId(id) && !cur.has(id)) {
      newIds.push(id);
      cur.add(id);
    }
  }
  if (!newIds.length) {
    return { added: false, conversationId };
  }
  const newMembers = newIds.map((id) => new mongoose.Types.ObjectId(id));
  conv.members.push(...newMembers);

  const actorUser = await User.findById(actorId).select("name").lean();
  const addedUsers = await User.find({ _id: { $in: newMembers } })
    .select("name")
    .lean();
  const addedNames = addedUsers.map((u) => u.name).join(", ");
  const sysMsg = await Message.create({
    conversation: conv._id,
    sender: actorId,
    text: `${actorUser?.name || "Admin"} added ${addedNames}`,
    messageType: "system",
  });
  conv.lastMessageText = sysMsg.text;
  conv.lastMessageAt = sysMsg.createdAt;

  await conv.save();
  return { added: true, conversationId };
}

export async function getConversationDetails(
  conversationId: string,
  userId: string
) {
  const conv = await Conversation.findById(conversationId)
    .populate("members", "name avatar bio city state")
    .populate("group", "name image description privacy memberCount")
    .lean();

  if (!conv || !conv.members.some((m: any) => m._id.toString() === userId)) {
    throw httpError("Conversation not found", 404);
  }

  const adminSet = new Set((conv.admins || []).map((a) => a.toString()));
  const membersWithRoles = (conv.members || []).map((m: any) => ({
    id: m._id.toString(),
    name: m.name,
    avatar: m.avatar || "",
    bio: m.bio || "",
    city: m.city || "",
    state: m.state || "",
    role: adminSet.has(m._id.toString()) ? "admin" : "member",
  }));

  return {
    id: conv._id.toString(),
    kind: conv.kind || "direct",
    isGroup: conv.kind === "group",
    title: conv.title || (conv.kind === "group" ? "Group Chat" : ""),
    image: conv.image || "",
    description: (conv as any).description || "",
    isCommunityGroup: !!(conv as any).isCommunityGroup,
    group: (conv as any).group
      ? {
          id: (conv as any).group._id.toString(),
          name: (conv as any).group.name,
          image: (conv as any).group.image || "",
          description: (conv as any).group.description || "",
          privacy: (conv as any).group.privacy || "Public",
          memberCount: (conv as any).group.memberCount || 0,
        }
      : null,
    membersCount: membersWithRoles.length,
    isAdmin: adminSet.has(userId),
    members: membersWithRoles,
    admins: [...adminSet],
    createdAt: (conv as any).createdAt,
  };
}

export async function updateGroupConversation(
  conversationId: string,
  actorId: string,
  updates: { title?: string; image?: string; description?: string; privacy?: string }
) {
  const conv = await Conversation.findById(conversationId);
  if (!conv) throw httpError("Conversation not found", 404);
  if (conv.kind !== "group") throw httpError("Not a group conversation", 400);
  if (!conv.admins.some((a) => a.toString() === actorId)) {
    throw httpError("Only admins can update group info", 403);
  }

  if (updates.title && typeof updates.title === "string" && updates.title.trim()) {
    conv.title = updates.title.trim();
  }
  if (updates.image !== undefined && typeof updates.image === "string") {
    conv.image = updates.image.trim();
  }
  if (updates.description !== undefined && typeof updates.description === "string") {
    (conv as any).description = updates.description.trim();
  }

  const actorUser = await User.findById(actorId).select("name").lean();
  const sysMsg = await Message.create({
    conversation: conv._id,
    sender: actorId,
    text: `${actorUser?.name || "Admin"} updated group information`,
    messageType: "system",
  });
  conv.lastMessageText = sysMsg.text;
  conv.lastMessageAt = sysMsg.createdAt;

  await conv.save();
  return {
    success: true,
    conversationId,
    title: conv.title,
    image: conv.image,
    description: (conv as any).description,
  };
}

export async function promoteToAdmin(
  conversationId: string,
  actorId: string,
  targetUserId: string
) {
  const conv = await Conversation.findById(conversationId);
  if (!conv) throw httpError("Conversation not found", 404);
  if (!conv.admins.some((a) => a.toString() === actorId)) {
    throw httpError("Only admins can promote members", 403);
  }
  if (!conv.members.some((m) => m.toString() === targetUserId)) {
    throw httpError("User is not a member", 400);
  }
  if (!conv.admins.some((a) => a.toString() === targetUserId)) {
    conv.admins.push(new mongoose.Types.ObjectId(targetUserId));
    const actorUser = await User.findById(actorId).select("name").lean();
    const targetUser = await User.findById(targetUserId).select("name").lean();
    const sysMsg = await Message.create({
      conversation: conv._id,
      sender: actorId,
      text: `${actorUser?.name || "Admin"} made ${targetUser?.name || "User"} an admin`,
      messageType: "system",
    });
    conv.lastMessageText = sysMsg.text;
    conv.lastMessageAt = sysMsg.createdAt;
    await conv.save();
  }
  return { success: true, conversationId, adminId: targetUserId };
}

export async function demoteAdmin(
  conversationId: string,
  actorId: string,
  targetUserId: string
) {
  const conv = await Conversation.findById(conversationId);
  if (!conv) throw httpError("Conversation not found", 404);
  if (!conv.admins.some((a) => a.toString() === actorId)) {
    throw httpError("Only admins can demote members", 403);
  }
  if (actorId === targetUserId) {
    throw httpError("Cannot demote yourself", 400);
  }
  conv.admins = conv.admins.filter((a) => a.toString() !== targetUserId);
  if (!conv.admins.length && conv.members.length) {
    conv.admins = [conv.members[0]];
  }
  await conv.save();
  return { success: true, conversationId, demotedId: targetUserId };
}

export async function markConversationRead(
  conversationId: string,
  userId: string
) {
  const conv = await Conversation.findById(conversationId);
  if (!conv) throw httpError("Conversation not found", 404);
  if (!conv.members.some((m) => m.toString() === userId)) {
    throw httpError("Not a member", 403);
  }
  if (!((conv as any).lastReadAt instanceof Map)) {
    (conv as any).lastReadAt = new Map(
      Object.entries((conv as any).lastReadAt || {})
    );
  }
  (conv as any).lastReadAt.set(userId, new Date());
  await conv.save();
  return { success: true, conversationId, unreadCount: 0 };
}

export async function getUnreadMessagesCount(userId: string) {
  const convs = await Conversation.find({
    members: new mongoose.Types.ObjectId(userId),
    status: { $ne: "declined" },
  }).lean();

  let totalUnread = 0;
  for (const conv of convs) {
    const lastRead =
      (conv as any).lastReadAt instanceof Map
        ? (conv as any).lastReadAt.get(userId)
        : (conv as any).lastReadAt?.[userId];
    const unreadQuery: any = {
      conversation: conv._id,
      sender: { $ne: new mongoose.Types.ObjectId(userId) },
    };
    if (lastRead) {
      unreadQuery.createdAt = { $gt: lastRead };
    }
    const count = await Message.countDocuments(unreadQuery);
    totalUnread += count;
  }
  return { totalUnread };
}

export async function acceptMessageRequest(
  conversationId: string,
  userId: string
) {
  const conv = await Conversation.findById(conversationId);
  if (!conv) throw httpError("Conversation not found", 404);
  if (!conv.members.some((m) => m.toString() === userId)) {
    throw httpError("Not allowed", 403);
  }
  (conv as any).status = "active";
  await conv.save();
  return { success: true, conversationId, status: "active" };
}

export async function declineMessageRequest(
  conversationId: string,
  userId: string
) {
  const conv = await Conversation.findById(conversationId);
  if (!conv) throw httpError("Conversation not found", 404);
  if (!conv.members.some((m) => m.toString() === userId)) {
    throw httpError("Not allowed", 403);
  }
  (conv as any).status = "declined";
  await conv.save();
  await ConversationHide.findOneAndUpdate(
    { user: userId, conversation: conversationId },
    {},
    { upsert: true }
  );
  return { success: true, conversationId, status: "declined" };
}

export async function archiveConversation(
  conversationId: string,
  userId: string,
  archiveState?: boolean
) {
  const conv = await Conversation.findById(conversationId);
  if (!conv) throw httpError("Conversation not found", 404);
  if (!conv.members.some((m) => m.toString() === userId)) {
    throw httpError("Not allowed", 403);
  }
  const shouldArchive =
    archiveState !== undefined
      ? Boolean(archiveState)
      : !(conv as any).archivedBy.some((id: any) => id.toString() === userId);

  if (shouldArchive) {
    if (!(conv as any).archivedBy.some((id: any) => id.toString() === userId)) {
      (conv as any).archivedBy.push(new mongoose.Types.ObjectId(userId));
    }
  } else {
    (conv as any).archivedBy = (conv as any).archivedBy.filter(
      (id: any) => id.toString() !== userId
    );
  }
  await conv.save();
  return { success: true, conversationId, isArchived: shouldArchive };
}

export async function muteConversation(
  conversationId: string,
  userId: string,
  muted?: boolean,
  durationMinutes?: number
) {
  const conv = await Conversation.findById(conversationId);
  if (!conv) throw httpError("Conversation not found", 404);
  if (!conv.members.some((m) => m.toString() === userId)) {
    throw httpError("Not allowed", 403);
  }

  (conv as any).mutedBy = ((conv as any).mutedBy || []).filter(
    (m: any) => (m.user?.toString?.() ?? m.user) !== userId
  );

  const shouldMute = muted !== undefined ? Boolean(muted) : true;
  let mutedUntil: Date | null = null;
  if (shouldMute) {
    if (durationMinutes && durationMinutes > 0) {
      mutedUntil = new Date(Date.now() + durationMinutes * 60 * 1000);
    }
    (conv as any).mutedBy.push({
      user: new mongoose.Types.ObjectId(userId),
      mutedUntil,
    });
  }
  await conv.save();
  return { success: true, conversationId, isMuted: shouldMute, mutedUntil };
}

export async function editMessage(
  conversationId: string,
  messageId: string,
  userId: string,
  newText: string
) {
  const msg = await Message.findById(messageId);
  if (!msg || msg.conversation.toString() !== conversationId) {
    throw httpError("Message not found", 404);
  }
  if (msg.sender.toString() !== userId) {
    throw httpError("Only sender can edit message", 403);
  }
  if (!newText?.trim()) {
    throw httpError("Text cannot be empty", 400);
  }
  msg.text = newText.trim();
  (msg as any).isEdited = true;
  (msg as any).editedAt = new Date();
  await msg.save();
  return {
    id: msg._id.toString(),
    text: msg.text,
    isEdited: true,
    editedAt: (msg as any).editedAt,
  };
}

export async function deleteMessage(
  conversationId: string,
  messageId: string,
  userId: string
) {
  const msg = await Message.findById(messageId);
  if (!msg || msg.conversation.toString() !== conversationId) {
    throw httpError("Message not found", 404);
  }
  if (msg.sender.toString() !== userId) {
    throw httpError("Only sender can delete message", 403);
  }
  await msg.deleteOne();
  return { success: true, messageId };
}

function mapMessageRow(m: any, viewerId: string) {
  const pop = m.sender;
  let senderId: string;
  let senderName = "";
  let senderAvatar = "";
  if (
    pop &&
    typeof pop === "object" &&
    "_id" in pop &&
    pop._id
  ) {
    const d = pop as LeanMember;
    senderId = d._id.toString();
    senderName = d.name ?? "";
    senderAvatar = d.avatar ?? "";
  } else {
    senderId = pop.toString();
  }
  const isMe = senderId === viewerId;
  return {
    id: m._id.toString(),
    text: m.text,
    messageType: m.messageType ?? "text",
    isEdited: Boolean(m.isEdited),
    editedAt: m.editedAt || null,
    fileUrl: m.fileUrl || "",
    fileName: m.fileName || "",
    fileSize: m.fileSize || 0,
    mimeType: m.mimeType || "",
    duration: m.duration || 0,
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
    throw httpError("Conversation not found", 404);
  }
  const limit = Math.min(100, Math.max(1, opts?.limit ?? 50));
  const filter: any = { conversation: conversationId };
  if (opts?.before) {
    const beforeMsg = await Message.findById(opts.before);
    if (beforeMsg) filter.createdAt = { $lt: beforeMsg.createdAt };
  }
  const msgs = await Message.find(filter)
    .sort({ createdAt: -1 })
    .limit(limit)
    .populate("sender", "name avatar")
    .lean();
  return msgs.reverse().map((m) => mapMessageRow(m, userId));
}

export type PersistedChatMessage = {
  socketPayload: {
    _id: string;
    conversation: string;
    text: string;
    messageType: string;
    isEdited?: boolean;
    fileUrl?: string;
    fileName?: string;
    fileSize?: number;
    mimeType?: string;
    duration?: number;
    createdAt: Date;
    sender: {
      _id: string;
      name: string;
      avatar: string;
    };
  };
  restForSender: {
    id: string;
    text: string;
    messageType: string;
    isEdited?: boolean;
    fileUrl?: string;
    fileName?: string;
    fileSize?: number;
    mimeType?: string;
    duration?: number;
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
  messageType = "text",
  metadata?: {
    fileUrl?: string;
    fileName?: string;
    fileSize?: number;
    mimeType?: string;
    duration?: number;
  }
): Promise<PersistedChatMessage> {
  const conv = await Conversation.findById(conversationId);
  if (!conv || !conv.members.some((m) => m.toString() === senderId)) {
    throw httpError("Conversation not found", 404);
  }
  let trimmed = typeof text === "string" ? text.trim() : "";
  if (!trimmed) {
    if (metadata?.fileUrl) {
      if (messageType === "image") trimmed = "📷 Image";
      else if (messageType === "video") trimmed = "🎥 Video";
      else if (messageType === "audio") trimmed = "🎵 Audio";
      else trimmed = "📎 File";
    } else {
      throw httpError("text is required", 400);
    }
  }
  const allowed = ["text", "image", "video", "audio", "file", "system"] as const;
  type MessageType = (typeof allowed)[number];
  const mt: MessageType = (allowed as readonly string[]).includes(messageType)
    ? (messageType as MessageType)
    : "text";

  const msg = await Message.create({
    conversation: conversationId,
    sender: senderId,
    text: trimmed,
    messageType: mt,
    fileUrl: metadata?.fileUrl || "",
    fileName: metadata?.fileName || "",
    fileSize: metadata?.fileSize || 0,
    mimeType: metadata?.mimeType || "",
    duration: metadata?.duration || 0,
  });

  conv.lastMessageText = trimmed.slice(0, 200);
  conv.lastMessageAt = msg.createdAt;

  // Mark read for sender
  if (!((conv as any).lastReadAt instanceof Map)) {
    (conv as any).lastReadAt = new Map(
      Object.entries((conv as any).lastReadAt || {})
    );
  }
  (conv as any).lastReadAt.set(senderId, new Date());

  // Auto-activate request if it was pending and recipient replied
  if ((conv as any).status === "pending" && (conv as any).requestedBy?.toString() !== senderId) {
    (conv as any).status = "active";
  }

  await conv.save();

  const populated = await Message.findById(msg._id)
    .populate("sender", "name avatar")
    .lean();
  const s = populated?.sender as unknown as LeanMember;
  const senderUserId = s?._id?.toString() ?? senderId;

  // Check muted members
  const mutedUserIds = new Set(
    ((conv as any).mutedBy || [])
      .filter((m: any) => !m.mutedUntil || new Date(m.mutedUntil) > new Date())
      .map((m: any) => m.user?.toString())
  );

  for (const mid of conv.members) {
    const midStr = mid.toString();
    if (midStr === senderId || mutedUserIds.has(midStr)) continue;
    await createNotification({
      userId: midStr,
      actorId: senderId,
      title: conv.kind === "group" ? (conv.title || "Group Chat") : "New message",
      body: trimmed.slice(0, 120),
      kind: "message",
      refType: "conversation",
      refId: conversationId,
      category: "messages",
    });
  }

  const socketPayload = {
    _id: msg._id.toString(),
    conversation: conversationId,
    text: msg.text,
    messageType: mt,
    isEdited: false,
    fileUrl: msg.fileUrl || "",
    fileName: msg.fileName || "",
    fileSize: msg.fileSize || 0,
    mimeType: msg.mimeType || "",
    duration: msg.duration || 0,
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
    isEdited: false,
    fileUrl: msg.fileUrl || "",
    fileName: msg.fileName || "",
    fileSize: msg.fileSize || 0,
    mimeType: msg.mimeType || "",
    duration: msg.duration || 0,
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
    throw httpError("Conversation not found", 404);
  }
  await ConversationHide.findOneAndUpdate(
    { user: userId, conversation: conversationId },
    {},
    { upsert: true }
  );
}
