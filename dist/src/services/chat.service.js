import mongoose from "mongoose";
import { Conversation, conversationMemberKey, newGroupMemberKey, } from "../models/conversation.model.js";
import { Message } from "../models/message.model.js";
import { ConversationHide } from "../models/conversationHide.model.js";
import { User } from "../models/user.model.js";
import { UserBlock } from "../models/userBlock.model.js";
import { FriendRequest } from "../models/friendRequest.model.js";
import { Group } from "../models/group.model.js";
import { GroupMember } from "../models/groupMember.model.js";
import { timeAgo } from "../utils/timeAgo.js";
import { createNotification } from "./notifications.service.js";
function httpError(message, statusCode) {
    const err = new Error(message);
    err.statusCode = statusCode;
    return err;
}
export async function toConversationListItem(conv, viewerId) {
    const status = conv.status || "active";
    const requestStatus = status || "active";
    const requestedById = conv.requestedBy?._id?.toString?.() ??
        conv.requestedBy?.toString?.() ??
        null;
    const isRequest = status === "pending" && requestedById !== viewerId;
    let canSendMessages = true;
    if (status === "declined") {
        canSendMessages = false;
    }
    else if (status === "pending" && requestedById === viewerId) {
        if (conv.lastMessageText) {
            canSendMessages = false;
        }
    }
    const base = {
        id: conv._id.toString(),
        _id: conv._id.toString(),
        conversationId: conv._id.toString(),
        lastMessage: conv.lastMessageText ?? "",
        lastMessageText: conv.lastMessageText ?? "",
        time: conv.lastMessageAt ? timeAgo(conv.lastMessageAt) : "",
        lastMessageAt: conv.lastMessageAt ?? null,
        status,
        requestStatus,
        requestedBy: requestedById,
        canSendMessages,
    };
    const kind = conv.kind || "direct";
    // Unread count
    const lastRead = conv.lastReadAt instanceof Map
        ? conv.lastReadAt.get(viewerId)
        : conv.lastReadAt?.[viewerId];
    const unreadQuery = {
        conversation: conv._id,
        sender: { $ne: new mongoose.Types.ObjectId(viewerId) },
    };
    if (lastRead) {
        unreadQuery.createdAt = { $gt: lastRead };
    }
    const unreadCount = await Message.countDocuments(unreadQuery);
    // Archive & Mute
    const isArchived = Array.isArray(conv.archivedBy) &&
        conv.archivedBy.some((id) => id?.toString?.() === viewerId);
    const muteEntry = Array.isArray(conv.mutedBy) &&
        conv.mutedBy.find((m) => (m.user?._id?.toString?.() ?? m.user?.toString?.()) === viewerId);
    const isMuted = !!(muteEntry &&
        (!muteEntry.mutedUntil || new Date(muteEntry.mutedUntil) > new Date()));
    if (kind === "group") {
        const groupId = conv.group?._id?.toString() || conv.group?.toString() || "";
        return {
            ...base,
            isGroup: true,
            title: (conv.title || "Group").trim(),
            image: conv.image ?? "",
            avatar: conv.image ?? "",
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
        .map((m) => (m._id ? m._id.toString() : m.toString()))
        .find((id) => id !== viewerId);
    const peer = peerId
        ? conv.members.find((m) => (m._id ? m._id.toString() : m.toString()) === peerId)
        : null;
    const peerObj = peer && typeof peer === "object" && "name" in peer
        ? {
            id: peer._id ? peer._id.toString() : peerId || "",
            name: peer.name,
            avatar: peer.avatar ?? "",
        }
        : { id: peerId || "", name: "Unknown", avatar: "" };
    return {
        ...base,
        isGroup: false,
        peer: peerObj,
        peerUser: peerObj,
        title: peerObj.name,
        avatar: peerObj.avatar,
        unreadCount,
        isArchived,
        isMuted,
        status,
        isRequest,
    };
}
export async function listConversations(userId, opts) {
    const tab = opts?.tab || "current"; // "current" | "archived" | "requests"
    const hidden = await ConversationHide.find({ user: userId }).distinct("conversation");
    const hiddenSet = new Set(hidden.map((id) => id.toString()));
    const query = {
        members: new mongoose.Types.ObjectId(userId),
    };
    if (tab === "archived") {
        query.archivedBy = new mongoose.Types.ObjectId(userId);
        query.status = { $ne: "declined" };
    }
    else if (tab === "requests") {
        query.status = "pending";
        query.requestedBy = { $ne: new mongoose.Types.ObjectId(userId) };
    }
    else {
        // Default current tab
        query.archivedBy = { $ne: new mongoose.Types.ObjectId(userId) };
        query.$or = [
            { status: "active" },
            { status: "accepted" },
            { status: { $exists: false } },
            { status: "pending", requestedBy: new mongoose.Types.ObjectId(userId) },
        ];
    }
    const convs = await Conversation.find(query)
        .sort({ lastMessageAt: -1, updatedAt: -1 })
        .populate("members", "name avatar")
        .lean();
    const out = [];
    for (const c of convs) {
        if (hiddenSet.has(c._id.toString()))
            continue;
        const members = (c.members || []);
        out.push(await toConversationListItem({
            _id: c._id,
            kind: c.kind,
            title: c.title,
            image: c.image,
            description: c.description,
            group: c.group,
            isCommunityGroup: c.isCommunityGroup,
            privacy: c.privacy,
            status: c.status,
            requestedBy: c.requestedBy,
            lastMessageText: c.lastMessageText,
            lastMessageAt: c.lastMessageAt,
            lastReadAt: c.lastReadAt,
            archivedBy: c.archivedBy,
            mutedBy: c.mutedBy,
            members,
        }, userId));
    }
    return out;
}
export async function getOrCreateConversation(userId, peerUserId) {
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
    }
    else {
        // If they became friends since, restore active status
        if (isFriend && (conv.status === "declined" || conv.status === "pending")) {
            conv.status = "active";
            await conv.save();
        }
    }
    await ConversationHide.deleteOne({
        user: userId,
        conversation: conv._id,
    });
    const convStatus = conv.status || "active";
    let canSendMessages = true;
    if (convStatus === "declined") {
        canSendMessages = false;
    }
    else if (convStatus === "pending") {
        if (conv.requestedBy?.toString() === userId) {
            const msgCount = await Message.countDocuments({
                conversation: conv._id,
                sender: userId,
            });
            if (msgCount >= 1) {
                canSendMessages = false;
            }
        }
    }
    return {
        conversationId: conv._id.toString(),
        status: convStatus,
        requestStatus: convStatus,
        canSendMessages,
    };
}
export async function createGroupConversation(creatorId, body) {
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
            return getOrCreateGroupChatForCommunityGroup(matchedGroup._id.toString(), creatorId);
        }
    }
    if (!trimmedTitle) {
        throw httpError("title is required", 400);
    }
    const ids = new Set();
    ids.add(creatorId);
    for (const id of body.memberIds || []) {
        if (mongoose.isValidObjectId(id))
            ids.add(id);
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
export async function getOrCreateGroupChatForCommunityGroup(groupId, userId) {
    const group = await Group.findById(groupId);
    if (!group) {
        throw httpError("Group not found", 404);
    }
    const isPrivate = group.privacy === "Private";
    const isMember = (await GroupMember.findOne({ group: groupId, user: userId })) ||
        group.createdBy?.toString() === userId;
    if (isPrivate && !isMember) {
        throw httpError("This is a private group. Join request must be approved first.", 403);
    }
    const key = `grp:${groupId}`;
    let conv = await Conversation.findOne({
        $or: [{ group: groupId }, { memberKey: key }],
    });
    const memberDocs = await GroupMember.find({ group: groupId })
        .select("user role")
        .lean();
    const memberUserIds = new Set(memberDocs.map((m) => m.user.toString()));
    if (group.createdBy)
        memberUserIds.add(group.createdBy.toString());
    if (userId)
        memberUserIds.add(userId);
    const members = [...memberUserIds].map((id) => new mongoose.Types.ObjectId(id));
    const adminUserIds = memberDocs
        .filter((m) => m.role === "admin" || m.role === "owner")
        .map((m) => m.user.toString());
    if (group.createdBy)
        adminUserIds.push(group.createdBy.toString());
    const admins = [...new Set(adminUserIds)].map((id) => new mongoose.Types.ObjectId(id));
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
    }
    else {
        conv.members = members;
        if (admins.length)
            conv.admins = admins;
        if (!conv.group)
            conv.group = group._id;
        conv.isCommunityGroup = true;
        conv.privacy = isPrivate ? "private" : "public";
        await conv.save();
    }
    await ConversationHide.deleteOne({
        user: userId,
        conversation: conv._id,
    });
    return { conversationId: conv._id.toString() };
}
export async function leaveGroupConversation(conversationId, userId) {
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
export async function removeMemberFromGroup(conversationId, actorId, targetUserId) {
    if (!mongoose.isValidObjectId(conversationId) ||
        !mongoose.isValidObjectId(targetUserId)) {
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
export async function addMembersToGroup(conversationId, actorId, userIds) {
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
    const newIds = [];
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
export async function getConversationDetails(conversationId, userId) {
    const conv = await Conversation.findById(conversationId)
        .populate("members", "name avatar bio city state")
        .populate("group", "name image description privacy memberCount")
        .lean();
    if (!conv || !conv.members.some((m) => m._id.toString() === userId)) {
        throw httpError("Conversation not found", 404);
    }
    const adminSet = new Set((conv.admins || []).map((a) => a.toString()));
    const membersWithRoles = (conv.members || []).map((m) => ({
        id: m._id.toString(),
        name: m.name,
        avatar: m.avatar || "",
        bio: m.bio || "",
        city: m.city || "",
        state: m.state || "",
        role: adminSet.has(m._id.toString()) ? "admin" : "member",
    }));
    const status = conv.status || "active";
    const requestedBy = conv.requestedBy?.toString() || null;
    let canSendMessages = true;
    if (status === "declined") {
        canSendMessages = false;
    }
    else if (status === "pending") {
        if (requestedBy === userId) {
            const msgCount = await Message.countDocuments({
                conversation: conversationId,
                sender: userId,
            });
            if (msgCount >= 1) {
                canSendMessages = false;
            }
        }
    }
    return {
        id: conv._id.toString(),
        _id: conv._id.toString(),
        conversationId: conv._id.toString(),
        kind: conv.kind || "direct",
        isGroup: conv.kind === "group",
        title: conv.title || (conv.kind === "group" ? "Group Chat" : ""),
        image: conv.image || "",
        avatar: conv.image || "",
        description: conv.description || "",
        isCommunityGroup: !!conv.isCommunityGroup,
        group: conv.group
            ? {
                id: conv.group._id.toString(),
                name: conv.group.name,
                image: conv.group.image || "",
                description: conv.group.description || "",
                privacy: conv.group.privacy || "Public",
                memberCount: conv.group.memberCount || 0,
            }
            : null,
        membersCount: membersWithRoles.length,
        isAdmin: adminSet.has(userId),
        members: membersWithRoles,
        admins: [...adminSet],
        status,
        requestStatus: status,
        requestedBy,
        canSendMessages,
        createdAt: conv.createdAt,
    };
}
export async function updateGroupConversation(conversationId, actorId, updates) {
    const conv = await Conversation.findById(conversationId);
    if (!conv)
        throw httpError("Conversation not found", 404);
    if (conv.kind !== "group")
        throw httpError("Not a group conversation", 400);
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
        conv.description = updates.description.trim();
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
        description: conv.description,
    };
}
export async function promoteToAdmin(conversationId, actorId, targetUserId) {
    const conv = await Conversation.findById(conversationId);
    if (!conv)
        throw httpError("Conversation not found", 404);
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
export async function demoteAdmin(conversationId, actorId, targetUserId) {
    const conv = await Conversation.findById(conversationId);
    if (!conv)
        throw httpError("Conversation not found", 404);
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
export async function markConversationRead(conversationId, userId) {
    const conv = await Conversation.findById(conversationId);
    if (!conv)
        throw httpError("Conversation not found", 404);
    if (!conv.members.some((m) => m.toString() === userId)) {
        throw httpError("Not a member", 403);
    }
    if (!(conv.lastReadAt instanceof Map)) {
        conv.lastReadAt = new Map(Object.entries(conv.lastReadAt || {}));
    }
    conv.lastReadAt.set(userId, new Date());
    await conv.save();
    return { success: true, conversationId, unreadCount: 0 };
}
export async function getUnreadMessagesCount(userId) {
    const convs = await Conversation.find({
        members: new mongoose.Types.ObjectId(userId),
        status: { $ne: "declined" },
    }).lean();
    let totalUnread = 0;
    for (const conv of convs) {
        const lastRead = conv.lastReadAt instanceof Map
            ? conv.lastReadAt.get(userId)
            : conv.lastReadAt?.[userId];
        const unreadQuery = {
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
export async function listMessageRequests(userId, opts) {
    const tab = opts?.tab || "incoming";
    const hidden = await ConversationHide.find({ user: userId }).distinct("conversation");
    const hiddenSet = new Set(hidden.map((id) => id.toString()));
    const query = {
        members: new mongoose.Types.ObjectId(userId),
        status: "pending",
    };
    if (tab === "incoming") {
        query.requestedBy = { $ne: new mongoose.Types.ObjectId(userId) };
    }
    else if (tab === "outgoing" || tab === "sent") {
        query.requestedBy = new mongoose.Types.ObjectId(userId);
    }
    const convs = await Conversation.find(query)
        .sort({ lastMessageAt: -1, updatedAt: -1 })
        .populate("members", "name avatar")
        .lean();
    const out = [];
    for (const c of convs) {
        if (hiddenSet.has(c._id.toString()))
            continue;
        const members = (c.members || []);
        out.push(await toConversationListItem({
            _id: c._id,
            kind: c.kind,
            title: c.title,
            image: c.image,
            description: c.description,
            group: c.group,
            isCommunityGroup: c.isCommunityGroup,
            privacy: c.privacy,
            status: c.status,
            requestedBy: c.requestedBy,
            lastMessageText: c.lastMessageText,
            lastMessageAt: c.lastMessageAt,
            lastReadAt: c.lastReadAt,
            archivedBy: c.archivedBy,
            mutedBy: c.mutedBy,
            members,
        }, userId));
    }
    return out;
}
export async function createMessageRequest(senderId, recipientId, text) {
    if (senderId === recipientId) {
        throw httpError("Cannot send message request to yourself", 400);
    }
    const blocked = await UserBlock.findOne({
        $or: [
            { blocker: senderId, blocked: recipientId },
            { blocker: recipientId, blocked: senderId },
        ],
    });
    if (blocked) {
        throw httpError("Cannot message this user", 403);
    }
    const peer = await User.findById(recipientId);
    if (!peer) {
        throw httpError("Recipient user not found", 404);
    }
    // Check friendship status
    const isFriend = await FriendRequest.exists({
        $or: [
            { from: senderId, to: recipientId, status: "accepted" },
            { from: recipientId, to: senderId, status: "accepted" },
        ],
    });
    const key = conversationMemberKey(senderId, recipientId);
    let conv = await Conversation.findOne({
        memberKey: key,
        $or: [{ kind: "direct" }, { kind: { $exists: false } }],
    });
    if (conv) {
        if (conv.status === "declined" && !isFriend) {
            throw httpError("This message request was declined. You cannot send additional messages.", 403);
        }
        if (conv.status === "pending" && conv.requestedBy?.toString() === senderId) {
            const existingCount = await Message.countDocuments({
                conversation: conv._id,
                sender: senderId,
            });
            if (existingCount >= 1) {
                throw httpError("Cannot send additional messages until your message request is accepted", 403);
            }
        }
        if (isFriend && (conv.status === "declined" || conv.status === "pending")) {
            conv.status = "active";
            await conv.save();
        }
    }
    else {
        conv = await Conversation.create({
            memberKey: key,
            kind: "direct",
            status: isFriend ? "active" : "pending",
            requestedBy: isFriend ? null : new mongoose.Types.ObjectId(senderId),
            members: [
                new mongoose.Types.ObjectId(senderId),
                new mongoose.Types.ObjectId(recipientId),
            ].sort((a, b) => a.toString().localeCompare(b.toString())),
        });
    }
    // Unhide for sender
    await ConversationHide.deleteOne({
        user: senderId,
        conversation: conv._id,
    });
    const persisted = await persistInboundChatMessage(conv._id.toString(), senderId, text, "text");
    return {
        conversationId: conv._id.toString(),
        status: conv.status || "pending",
        persisted,
    };
}
export async function acceptMessageRequest(conversationId, userId) {
    const conv = await Conversation.findById(conversationId);
    if (!conv)
        throw httpError("Conversation not found", 404);
    if (!conv.members.some((m) => m.toString() === userId)) {
        throw httpError("Not allowed", 403);
    }
    // Only the recipient can accept; sender cannot accept their own request
    if (conv.status === "pending" &&
        conv.requestedBy?.toString() === userId) {
        throw httpError("You cannot accept your own message request", 403);
    }
    conv.status = "accepted";
    await conv.save();
    // Unhide for both members
    await ConversationHide.deleteMany({
        conversation: conv._id,
    });
    // Notify sender that their request was accepted
    const senderId = conv.requestedBy?.toString();
    if (senderId && senderId !== userId) {
        const recipientUser = await User.findById(userId).select("name").lean();
        await createNotification({
            userId: senderId,
            actorId: userId,
            title: "Message Request Accepted",
            body: `${recipientUser?.name || "A user"} accepted your message request.`,
            kind: "message",
            refType: "conversation",
            refId: conversationId,
            category: "messages",
        });
    }
    return {
        success: true,
        conversationId,
        status: "accepted",
        requestStatus: "accepted",
    };
}
export async function declineMessageRequest(conversationId, userId) {
    const conv = await Conversation.findById(conversationId);
    if (!conv)
        throw httpError("Conversation not found", 404);
    if (!conv.members.some((m) => m.toString() === userId)) {
        throw httpError("Not allowed", 403);
    }
    // Only recipient can decline
    if (conv.status === "pending" &&
        conv.requestedBy?.toString() === userId) {
        throw httpError("You cannot decline your own message request", 403);
    }
    conv.status = "declined";
    await conv.save();
    // Hide for the recipient so it disappears from their requests
    await ConversationHide.findOneAndUpdate({ user: userId, conversation: conversationId }, {}, { upsert: true });
    return {
        success: true,
        conversationId,
        status: "declined",
        requestStatus: "declined",
    };
}
export async function archiveConversation(conversationId, userId, archiveState) {
    const conv = await Conversation.findById(conversationId);
    if (!conv)
        throw httpError("Conversation not found", 404);
    if (!conv.members.some((m) => m.toString() === userId)) {
        throw httpError("Not allowed", 403);
    }
    const shouldArchive = archiveState !== undefined
        ? Boolean(archiveState)
        : !conv.archivedBy.some((id) => id.toString() === userId);
    if (shouldArchive) {
        if (!conv.archivedBy.some((id) => id.toString() === userId)) {
            conv.archivedBy.push(new mongoose.Types.ObjectId(userId));
        }
    }
    else {
        conv.archivedBy = conv.archivedBy.filter((id) => id.toString() !== userId);
    }
    await conv.save();
    return { success: true, conversationId, isArchived: shouldArchive };
}
export async function muteConversation(conversationId, userId, muted, durationMinutes) {
    const conv = await Conversation.findById(conversationId);
    if (!conv)
        throw httpError("Conversation not found", 404);
    if (!conv.members.some((m) => m.toString() === userId)) {
        throw httpError("Not allowed", 403);
    }
    conv.mutedBy = (conv.mutedBy || []).filter((m) => (m.user?.toString?.() ?? m.user) !== userId);
    const shouldMute = muted !== undefined ? Boolean(muted) : true;
    let mutedUntil = null;
    if (shouldMute) {
        if (durationMinutes && durationMinutes > 0) {
            mutedUntil = new Date(Date.now() + durationMinutes * 60 * 1000);
        }
        conv.mutedBy.push({
            user: new mongoose.Types.ObjectId(userId),
            mutedUntil,
        });
    }
    await conv.save();
    return { success: true, conversationId, isMuted: shouldMute, mutedUntil };
}
export async function editMessage(conversationId, messageId, userId, payload) {
    const conv = await Conversation.findById(conversationId);
    if (!conv || !conv.members.some((m) => m.toString() === userId)) {
        throw httpError("Conversation not found", 404);
    }
    const msg = await Message.findById(messageId);
    if (!msg || msg.conversation.toString() !== conversationId) {
        throw httpError("Message not found", 404);
    }
    if (msg.sender.toString() !== userId) {
        throw httpError("Only sender can edit message", 403);
    }
    const data = typeof payload === "string" ? { text: payload } : payload || {};
    const requestedType = data.messageType || msg.messageType || "text";
    const allowed = ["text", "image", "video", "audio", "file", "system"];
    const newType = allowed.includes(requestedType)
        ? requestedType
        : "text";
    let fileUrl = typeof data.fileUrl === "string" ? data.fileUrl.trim() : (msg.fileUrl || "");
    let text = typeof data.text === "string" ? data.text.trim() : "";
    // If text is a URL and it's a media type without explicit fileUrl
    if (newType !== "text" && !fileUrl && (text.startsWith("http://") || text.startsWith("https://"))) {
        fileUrl = text;
    }
    if (newType !== "text") {
        if (!fileUrl && !msg.fileUrl) {
            throw httpError("Media URL is required for media message", 400);
        }
        if (!text) {
            if (newType === "image")
                text = "📷 Image";
            else if (newType === "video")
                text = "🎥 Video";
            else if (newType === "audio")
                text = "🎵 Audio";
            else
                text = "📎 File";
        }
        msg.fileUrl = fileUrl || msg.fileUrl;
        if (typeof data.fileName === "string")
            msg.fileName = data.fileName;
        if (typeof data.fileSize === "number")
            msg.fileSize = data.fileSize;
        if (typeof data.mimeType === "string")
            msg.mimeType = data.mimeType;
        if (typeof data.duration === "number")
            msg.duration = data.duration;
    }
    else {
        if (!text) {
            throw httpError("Text cannot be empty", 400);
        }
    }
    msg.text = text;
    msg.messageType = newType;
    msg.isEdited = true;
    msg.editedAt = new Date();
    await msg.save();
    // If this was the last message of the conversation, update conversation snippet
    const latest = await Message.findOne({ conversation: conversationId }).sort({ createdAt: -1 });
    if (latest && latest._id.toString() === messageId) {
        conv.lastMessageText = text.slice(0, 200);
        await conv.save();
    }
    const populated = await Message.findById(msg._id)
        .populate("sender", "name avatar")
        .lean();
    return mapMessageRow(populated, userId);
}
export async function deleteMessage(conversationId, messageId, userId) {
    const conv = await Conversation.findById(conversationId);
    if (!conv || !conv.members.some((m) => m.toString() === userId)) {
        throw httpError("Conversation not found", 404);
    }
    const msg = await Message.findById(messageId);
    if (!msg || msg.conversation.toString() !== conversationId) {
        throw httpError("Message not found", 404);
    }
    if (msg.sender.toString() !== userId) {
        throw httpError("Only sender can delete message", 403);
    }
    await msg.deleteOne();
    // Update conversation's last message if this was the latest message
    const newLatest = await Message.findOne({ conversation: conversationId }).sort({ createdAt: -1 });
    if (newLatest) {
        conv.lastMessageText = newLatest.text.slice(0, 200);
        conv.lastMessageAt = newLatest.createdAt;
    }
    else {
        conv.lastMessageText = "";
        conv.lastMessageAt = null;
    }
    await conv.save();
    return { success: true, conversationId, messageId };
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
        senderId = pop?.toString?.() || "";
    }
    const isMe = senderId === viewerId;
    return {
        id: m._id.toString(),
        _id: m._id.toString(),
        conversationId: m.conversation?.toString?.() || "",
        clientMessageId: m.clientMessageId || null,
        text: m.text,
        messageType: m.messageType ?? "text",
        isEdited: Boolean(m.isEdited),
        editedAt: m.editedAt || null,
        fileUrl: m.fileUrl || "",
        fileName: m.fileName || "",
        fileSize: m.fileSize || 0,
        mimeType: m.mimeType || "",
        duration: m.duration || 0,
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
        throw httpError("Conversation not found", 404);
    }
    const limit = Math.min(100, Math.max(1, opts?.limit ?? 50));
    const filter = { conversation: conversationId };
    const cursorVal = opts?.cursor || opts?.before;
    if (cursorVal) {
        if (mongoose.isValidObjectId(cursorVal)) {
            const cursorMsg = await Message.findById(cursorVal);
            if (cursorMsg) {
                filter.$or = [
                    { createdAt: { $lt: cursorMsg.createdAt } },
                    { createdAt: cursorMsg.createdAt, _id: { $lt: cursorMsg._id } },
                ];
            }
        }
        else if (!isNaN(Date.parse(cursorVal))) {
            filter.createdAt = { $lt: new Date(cursorVal) };
        }
    }
    const rawMsgs = await Message.find(filter)
        .sort({ createdAt: -1, _id: -1 })
        .limit(limit + 1)
        .populate("sender", "name avatar")
        .lean();
    const hasMore = rawMsgs.length > limit;
    const sliced = hasMore ? rawMsgs.slice(0, limit) : rawMsgs;
    const nextCursor = hasMore && sliced.length > 0
        ? sliced[sliced.length - 1]._id.toString()
        : null;
    const messages = sliced.reverse().map((m) => mapMessageRow(m, userId));
    return {
        messages,
        pagination: {
            hasMore,
            nextCursor,
        },
    };
}
export async function persistInboundChatMessage(conversationId, senderId, text, messageType = "text", metadata) {
    const conv = await Conversation.findById(conversationId);
    if (!conv || !conv.members.some((m) => m.toString() === senderId)) {
        throw httpError("Conversation not found", 404);
    }
    // Idempotency check: if message with this clientMessageId was already saved for this sender & conversation, return it
    const clientMessageId = typeof metadata?.clientMessageId === "string" && metadata.clientMessageId.trim()
        ? metadata.clientMessageId.trim()
        : undefined;
    if (clientMessageId) {
        const existing = await Message.findOne({
            conversation: conversationId,
            sender: senderId,
            clientMessageId,
        })
            .populate("sender", "name avatar")
            .lean();
        if (existing) {
            const s = existing.sender;
            const senderUserId = s?._id?.toString() ?? senderId;
            const socketPayload = {
                _id: existing._id.toString(),
                conversation: conversationId,
                text: existing.text,
                messageType: existing.messageType ?? "text",
                isEdited: Boolean(existing.isEdited),
                editedAt: existing.editedAt || null,
                fileUrl: existing.fileUrl || "",
                fileName: existing.fileName || "",
                fileSize: existing.fileSize || 0,
                mimeType: existing.mimeType || "",
                duration: existing.duration || 0,
                clientMessageId: existing.clientMessageId || clientMessageId,
                createdAt: existing.createdAt,
                sender: {
                    _id: senderUserId,
                    name: s?.name ?? "",
                    avatar: s?.avatar ?? "",
                },
            };
            const restForSender = mapMessageRow(existing, senderId);
            return {
                socketPayload,
                restForSender,
                memberUserIds: conv.members.map((m) => m.toString()),
                isDuplicate: true,
            };
        }
    }
    // 1. If conversation status is declined, prevent sending messages
    if (conv.status === "declined") {
        throw httpError("This message request was declined. You cannot send additional messages.", 403);
    }
    // 2. If conversation status is pending, enforce 1-message rule for sender
    if (conv.status === "pending") {
        const isRequester = conv.requestedBy?.toString() === senderId;
        if (isRequester) {
            const existingCount = await Message.countDocuments({
                conversation: conversationId,
                sender: senderId,
            });
            if (existingCount >= 1) {
                throw httpError("Cannot send additional messages until your message request is accepted", 403);
            }
        }
        else {
            // Recipient replied! Auto-accept the message request and unhide
            conv.status = "accepted";
            await ConversationHide.deleteMany({ conversation: conv._id });
        }
    }
    let trimmed = typeof text === "string" ? text.trim() : "";
    if (!trimmed) {
        if (metadata?.fileUrl) {
            if (messageType === "image")
                trimmed = "📷 Image";
            else if (messageType === "video")
                trimmed = "🎥 Video";
            else if (messageType === "audio")
                trimmed = "🎵 Audio";
            else
                trimmed = "📎 File";
        }
        else {
            throw httpError("text is required", 400);
        }
    }
    const allowed = ["text", "image", "video", "audio", "file", "system"];
    const mt = allowed.includes(messageType)
        ? messageType
        : "text";
    const msg = await Message.create({
        conversation: conversationId,
        sender: senderId,
        clientMessageId,
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
    if (!(conv.lastReadAt instanceof Map)) {
        conv.lastReadAt = new Map(Object.entries(conv.lastReadAt || {}));
    }
    conv.lastReadAt.set(senderId, new Date());
    await conv.save();
    const populated = await Message.findById(msg._id)
        .populate("sender", "name avatar")
        .lean();
    const s = populated?.sender;
    const senderUserId = s?._id?.toString() ?? senderId;
    // Check muted members
    const mutedUserIds = new Set((conv.mutedBy || [])
        .filter((m) => !m.mutedUntil || new Date(m.mutedUntil) > new Date())
        .map((m) => m.user?.toString()));
    for (const mid of conv.members) {
        const midStr = mid.toString();
        if (midStr === senderId || mutedUserIds.has(midStr))
            continue;
        await createNotification({
            userId: midStr,
            actorId: senderId,
            title: conv.kind === "group"
                ? conv.title || "Group Chat"
                : conv.status === "pending"
                    ? "New message request"
                    : "New message",
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
        editedAt: null,
        fileUrl: msg.fileUrl || "",
        fileName: msg.fileName || "",
        fileSize: msg.fileSize || 0,
        mimeType: msg.mimeType || "",
        duration: msg.duration || 0,
        clientMessageId: msg.clientMessageId || null,
        createdAt: msg.createdAt,
        sender: {
            _id: senderUserId,
            name: s?.name ?? "",
            avatar: s?.avatar ?? "",
        },
    };
    const restForSender = {
        id: msg._id.toString(),
        _id: msg._id.toString(),
        conversationId,
        clientMessageId: msg.clientMessageId || null,
        text: msg.text,
        messageType: mt,
        isEdited: false,
        editedAt: null,
        fileUrl: msg.fileUrl || "",
        fileName: msg.fileName || "",
        fileSize: msg.fileSize || 0,
        mimeType: msg.mimeType || "",
        duration: msg.duration || 0,
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
        isDuplicate: false,
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
        throw httpError("Conversation not found", 404);
    }
    await ConversationHide.findOneAndUpdate({ user: userId, conversation: conversationId }, {}, { upsert: true });
}
