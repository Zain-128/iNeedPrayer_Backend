import mongoose from "mongoose";
import { Group } from "../models/group.model.js";
import { GroupMember } from "../models/groupMember.model.js";
import { GroupInvite } from "../models/groupInvite.model.js";
import { GroupJoinRequest } from "../models/groupJoinRequest.model.js";
import { GroupNotificationSettings, } from "../models/groupNotificationSettings.model.js";
import { GroupMemberNotificationPreferences, } from "../models/groupMemberNotificationPreferences.model.js";
import { GroupMute } from "../models/groupMute.model.js";
import { Conversation } from "../models/conversation.model.js";
import { User } from "../models/user.model.js";
import { FriendRequest } from "../models/friendRequest.model.js";
import { UserBlock } from "../models/userBlock.model.js";
import { UserSubscription } from "../models/userSubscription.model.js";
import { Post } from "../models/post.model.js";
import { Comment } from "../models/comment.model.js";
import { PostReaction } from "../models/postReaction.model.js";
import { Donation } from "../models/donation.model.js";
import { LiveStreamSession } from "../models/liveStreamSession.model.js";
import { LiveStreamComment } from "../models/liveStreamComment.model.js";
import * as postsService from "./posts.service.js";
import { createNotification, notifyMany } from "./notifications.service.js";
import { formatCountLabel } from "../utils/mappers.js";
import { normalizeGroupInput, validateCreateGroupInput, } from "../utils/groupInput.js";
function httpError(message, statusCode) {
    const err = new Error(message);
    err.statusCode = statusCode;
    return err;
}
export async function syncGroupMemberCount(groupId) {
    const count = await GroupMember.countDocuments({ group: groupId });
    await Group.findByIdAndUpdate(groupId, { memberCount: count });
    return count;
}
export async function getGroupStaffLimits(groupId, groupDoc) {
    const g = groupDoc || (await Group.findById(groupId).lean());
    if (!g)
        throw httpError("Group not found", 404);
    let tier = g.subscriptionTier === "Premium" ? "Premium" : "Standard";
    if (g.createdBy) {
        const ownerSub = await UserSubscription.findOne({
            user: g.createdBy,
            status: "Active",
        })
            .populate("plan")
            .lean();
        if (ownerSub) {
            const planName = (ownerSub.planName ||
                ownerSub.plan?.name ||
                "").toLowerCase();
            if (planName.includes("premium")) {
                tier = "Premium";
            }
        }
    }
    const maxStaff = tier === "Premium" ? 5 : 2;
    const [adminCount, editorCount] = await Promise.all([
        GroupMember.countDocuments({ group: groupId, role: "admin" }),
        GroupMember.countDocuments({
            group: groupId,
            role: { $in: ["editor", "moderator"] },
        }),
    ]);
    const currentStaff = adminCount + editorCount;
    const canAddStaff = currentStaff < maxStaff;
    return {
        tier,
        plan: tier,
        maxStaff,
        currentStaff,
        adminCount,
        editorCount,
        ownerCount: 1,
        canAddStaff,
        availableStaffSlots: Math.max(0, maxStaff - currentStaff),
    };
}
export async function getUserGroupPermissions(groupId, userId) {
    if (!userId) {
        return {
            role: null,
            isOwner: false,
            isAdmin: false,
            isEditor: false,
            isMember: false,
            canEditCommunity: false,
            canEditGroup: false,
            canChangePrivacy: false,
            canManageAdmins: false,
            canManageEditors: false,
            canRemoveMembers: false,
            canManageJoinRequests: false,
            canManagePosts: false,
            canManageCommunityNotifications: false,
            canAccessAnalytics: false,
            canManageWallet: false,
            canManageWithdrawals: false,
            canGoLive: false,
            canDeleteCommunity: false,
            canDeleteGroup: false,
        };
    }
    const group = await Group.findById(groupId).lean();
    if (!group)
        throw httpError("Group not found", 404);
    const isOwner = group.createdBy?.toString() === userId;
    let role = isOwner ? "owner" : "member";
    let isMember = isOwner;
    const memberDoc = await GroupMember.findOne({
        group: groupId,
        user: userId,
    }).lean();
    if (memberDoc) {
        isMember = true;
        if (!isOwner) {
            role = memberDoc.role || "member";
        }
    }
    const isAdmin = isOwner || role === "admin";
    const isEditor = role === "editor" || role === "moderator";
    return {
        role,
        isOwner,
        isAdmin: role === "admin",
        isEditor,
        isMember,
        canEditCommunity: isOwner || isAdmin,
        canEditGroup: isOwner || isAdmin,
        canChangePrivacy: isOwner,
        canManageAdmins: isOwner,
        canManageEditors: isOwner,
        canRemoveMembers: isOwner || isAdmin,
        canManageJoinRequests: isOwner || isAdmin,
        canManagePosts: isOwner || isAdmin || isEditor,
        canManageCommunityNotifications: isOwner || isAdmin,
        canAccessAnalytics: isOwner || isAdmin,
        canManageWallet: isOwner || isAdmin,
        canManageWithdrawals: isOwner,
        canGoLive: isOwner || isAdmin,
        canDeleteCommunity: isOwner,
        canDeleteGroup: isOwner,
    };
}
function mapGroup(g, userId, memberSet, createdByMeSet) {
    const id = g._id.toString();
    const isJoined = userId && memberSet ? memberSet.has(id) : false;
    const isMyGroup = userId && createdByMeSet
        ? createdByMeSet.has(id)
        : g.createdBy?.toString() === userId;
    const banner = g.bannerImage ?? g.image ?? "";
    const image = g.image ?? "";
    return {
        id,
        name: g.name.replace(/\\n/g, "\n"),
        groupName: g.name.replace(/\\n/g, "\n"),
        membersLabel: formatCountLabel(g.memberCount ?? 0, "members"),
        memberCount: g.memberCount ?? 0,
        image,
        bannerImage: banner,
        banner,
        description: g.description ?? "",
        isMyGroup: !!isMyGroup,
        isJoined,
        isMember: isJoined,
        privacy: g.privacy || "Public",
        requiresApproval: !!g.requiresApproval || g.privacy === "Private",
        subscriptionTier: g.subscriptionTier || "Standard",
        createdBy: g.createdBy?.toString() ?? null,
    };
}
async function loadGroupContext(userId) {
    let memberSet = new Set();
    let createdByMeSet = new Set();
    if (!userId)
        return { memberSet, createdByMeSet };
    const [memberships, owned] = await Promise.all([
        GroupMember.find({ user: userId }).select("group").lean(),
        Group.find({ createdBy: userId }).select("_id").lean(),
    ]);
    memberSet = new Set(memberships.map((m) => m.group.toString()));
    createdByMeSet = new Set(owned.map((g) => g._id.toString()));
    return { memberSet, createdByMeSet };
}
async function assertGroupMember(groupId, userId) {
    const group = await Group.findById(groupId);
    if (!group)
        throw httpError("Group not found", 404);
    const membership = await GroupMember.findOne({ user: userId, group: groupId });
    if (!membership && group.createdBy?.toString() !== userId) {
        throw httpError("Not a member of this group", 403);
    }
    return { group, membership };
}
async function assertGroupManager(groupId, userId) {
    const group = await Group.findById(groupId);
    if (!group) {
        throw httpError("Group not found", 404);
    }
    const doc = group;
    if (group.createdBy?.toString() === userId) {
        return { group: doc };
    }
    const member = await GroupMember.findOne({
        group: groupId,
        user: userId,
        role: { $in: ["owner", "admin"] },
    });
    if (!member) {
        throw httpError("Not allowed", 403);
    }
    return { group: doc };
}
function applyGroupInput(group, input, partial = false) {
    if (!partial || input.name)
        group.name = input.name;
    if (!partial || input.image)
        group.image = input.image;
    if (!partial || input.bannerImage)
        group.bannerImage = input.bannerImage;
    if (!partial || input.description !== undefined) {
        if (!partial || input.description)
            group.description = input.description;
    }
}
export async function listGroups(opts) {
    const q = opts.q?.trim();
    const filter = {
        status: { $in: ["Active", "Pending"] },
    };
    if (q) {
        filter.$or = [
            { name: { $regex: q, $options: "i" } },
            { description: { $regex: q, $options: "i" } },
        ];
    }
    const { memberSet, createdByMeSet } = await loadGroupContext(opts.userId);
    if (opts.mine || opts.tab === "my") {
        if (!opts.userId)
            return [];
        filter.createdBy = opts.userId;
    }
    else if (opts.tab === "joined") {
        if (!opts.userId)
            return [];
        filter._id = { $in: [...memberSet] };
    }
    const groups = await Group.find(filter)
        .sort({ createdAt: -1 })
        .limit(50)
        .lean();
    return groups.map((g) => mapGroup(g, opts.userId, memberSet, createdByMeSet));
}
export async function discoverGroups(opts) {
    const q = opts.q?.trim();
    const filter = {
        status: "Active",
        privacy: "Public",
    };
    if (q) {
        filter.$or = [
            { name: { $regex: q, $options: "i" } },
            { description: { $regex: q, $options: "i" } },
        ];
    }
    const { memberSet, createdByMeSet } = await loadGroupContext(opts.userId);
    const groups = await Group.find(filter)
        .sort({ memberCount: -1, createdAt: -1 })
        .limit(50)
        .lean();
    return groups.map((g) => mapGroup(g, opts.userId, memberSet, createdByMeSet));
}
export async function getGroup(groupId, userId) {
    const g = await Group.findById(groupId).lean();
    if (!g) {
        throw httpError("Group not found", 404);
    }
    const { memberSet, createdByMeSet } = await loadGroupContext(userId);
    const isMemberOrOwner = !!userId && (memberSet.has(groupId) || createdByMeSet.has(groupId));
    if (g.status === "Suspended" && !isMemberOrOwner) {
        throw httpError("Group not found", 404);
    }
    const mapped = mapGroup(g, userId, memberSet, createdByMeSet);
    let myRole = null;
    let hasRequestedJoin = false;
    let hasPendingInvite = false;
    if (userId) {
        if (g.createdBy?.toString() === userId) {
            myRole = "owner";
        }
        else {
            const m = await GroupMember.findOne({ user: userId, group: groupId }).lean();
            myRole = m?.role ?? null;
            if (!myRole) {
                const [reqDoc, invDoc] = await Promise.all([
                    GroupJoinRequest.exists({ group: groupId, user: userId, status: "pending" }),
                    GroupInvite.exists({ group: groupId, user: userId, status: "pending" }),
                ]);
                hasRequestedJoin = !!reqDoc;
                hasPendingInvite = !!invDoc;
            }
        }
    }
    const [permissions, limits] = await Promise.all([
        getUserGroupPermissions(groupId, userId),
        getGroupStaffLimits(groupId, g),
    ]);
    return {
        ...mapped,
        myRole,
        isCreatorOrAdmin: myRole === "owner" || myRole === "admin",
        hasRequestedJoin,
        hasPendingInvite,
        permissions,
        limits,
    };
}
export async function createGroup(userId, body) {
    const input = normalizeGroupInput(body);
    const validationError = validateCreateGroupInput(input);
    if (validationError) {
        throw httpError(validationError, 400);
    }
    const privacy = input.privacy || "Public";
    const g = await Group.create({
        name: input.name,
        image: input.image,
        bannerImage: input.bannerImage || input.image || "",
        description: input.description,
        createdBy: userId,
        privacy,
        requiresApproval: privacy === "Private",
        subscriptionTier: "Standard",
        memberCount: 1,
    });
    await GroupMember.create({ user: userId, group: g._id, role: "owner" });
    const { ensureEntityWallet } = await import("./wallet.service.js");
    void ensureEntityWallet("group", g._id.toString());
    const { recordAdminActivity } = await import("./admin/adminActivity.service.js");
    void recordAdminActivity({
        type: "community_created",
        title: "New group created",
        actorId: userId,
        refId: g._id.toString(),
        refType: "group",
        meta: { name: g.name },
    });
    return getGroup(g._id.toString(), userId);
}
export async function updateGroup(groupId, userId, body) {
    const { group } = await assertGroupManager(groupId, userId);
    const isOwner = group.createdBy?.toString() === userId;
    const input = normalizeGroupInput(body);
    if (!input.name && body?.name === "") {
        throw httpError("Group name is required", 400);
    }
    applyGroupInput(group, input, true);
    if (input.name)
        group.name = input.name;
    // Only Owner can change privacy
    if (input.privacy !== undefined) {
        if (!isOwner) {
            throw httpError("Only the community owner can change privacy settings", 403);
        }
        group.privacy = input.privacy;
        group.requiresApproval = input.privacy === "Private";
    }
    await group.save();
    await Conversation.updateOne({ memberKey: `grp:${groupId}` }, {
        $set: {
            ...(input.name ? { title: `${input.name} Chat` } : {}),
            ...(input.image !== undefined ? { image: input.image } : {}),
            ...(input.description !== undefined
                ? { description: input.description }
                : {}),
            ...(input.privacy
                ? { privacy: input.privacy === "Private" ? "private" : "public" }
                : {}),
        },
    }).catch(() => { });
    return getGroup(groupId, userId);
}
export async function updateGroupPrivacy(groupId, actorId, privacy) {
    const group = await Group.findById(groupId);
    if (!group)
        throw httpError("Group not found", 404);
    if (group.createdBy?.toString() !== actorId) {
        throw httpError("Only the community owner can change privacy settings", 403);
    }
    group.privacy = privacy;
    group.requiresApproval = privacy === "Private";
    await group.save();
    await Conversation.updateOne({ memberKey: `grp:${groupId}` }, { $set: { privacy: privacy === "Private" ? "private" : "public" } }).catch(() => { });
    return getGroup(groupId, actorId);
}
export async function deleteGroup(groupId, userId) {
    const group = await Group.findById(groupId);
    if (!group) {
        throw httpError("Group not found", 404);
    }
    if (group.createdBy?.toString() !== userId) {
        throw httpError("Only the creator can delete this group", 403);
    }
    await Promise.all([
        GroupMember.deleteMany({ group: groupId }),
        GroupInvite.deleteMany({ group: groupId }),
        GroupJoinRequest.deleteMany({ group: groupId }),
        GroupMute.deleteMany({ group: groupId }),
        GroupNotificationSettings.deleteOne({ group: groupId }),
        GroupMemberNotificationPreferences.deleteMany({ group: groupId }),
        Conversation.deleteOne({ memberKey: `grp:${groupId}` }).catch(() => { }),
        group.deleteOne(),
    ]);
    return { ok: true };
}
async function addGroupMemberDirect(groupId, userId) {
    const g = await Group.findById(groupId);
    if (!g)
        throw httpError("Group not found", 404);
    const ex = await GroupMember.findOne({ user: userId, group: groupId });
    if (ex)
        throw httpError("Already a member", 400);
    const pendingInvite = await GroupInvite.findOne({
        group: groupId,
        user: userId,
        status: "pending",
    });
    if (pendingInvite) {
        pendingInvite.status = "accepted";
        await pendingInvite.save();
    }
    await GroupMember.create({ user: userId, group: groupId, role: "member" });
    const count = await syncGroupMemberCount(groupId);
    g.memberCount = count;
    await Conversation.updateOne({ memberKey: `grp:${groupId}` }, { $addToSet: { members: new mongoose.Types.ObjectId(userId) } }).catch(() => { });
    return g;
}
export async function joinGroup(userId, groupId) {
    const g = await Group.findById(groupId);
    if (!g)
        throw httpError("Group not found", 404);
    if (g.status === "Suspended") {
        throw httpError("This group is suspended", 403);
    }
    const ex = await GroupMember.findOne({ user: userId, group: groupId });
    if (ex)
        throw httpError("Already a member", 400);
    if (g.privacy === "Private" || g.requiresApproval) {
        const pendingInvite = await GroupInvite.findOne({
            group: groupId,
            user: userId,
            status: "pending",
        });
        if (pendingInvite) {
            return acceptGroupInvite(groupId, userId, userId);
        }
        const existing = await GroupJoinRequest.findOne({
            group: groupId,
            user: userId,
        });
        if (existing?.status === "pending") {
            return {
                status: "pending",
                isMember: false,
                hasRequestedJoin: true,
                message: "Join request already pending approval",
                memberCount: g.memberCount,
            };
        }
        if (existing?.status === "rejected") {
            existing.status = "pending";
            await existing.save();
        }
        else if (!existing) {
            await GroupJoinRequest.create({
                group: groupId,
                user: userId,
                status: "pending",
            });
        }
        const admins = await GroupMember.find({
            group: groupId,
            role: { $in: ["owner", "admin"] },
        }).select("user");
        const ownerId = g.createdBy?.toString();
        const notifyIds = new Set(admins.map((a) => a.user.toString()));
        if (ownerId)
            notifyIds.add(ownerId);
        await notifyMany([...notifyIds], {
            actorId: userId,
            title: "Join request",
            body: `Someone requested to join ${g.name}`,
            kind: "group_join_request",
            refType: "group",
            refId: groupId,
            category: "groupActivity",
        });
        return {
            status: "pending",
            isMember: false,
            hasRequestedJoin: true,
            message: "Join request submitted. Awaiting approval.",
            memberCount: g.memberCount,
        };
    }
    await addGroupMemberDirect(groupId, userId);
    const group = await getGroup(groupId, userId);
    return {
        status: "joined",
        isMember: true,
        group,
        memberCount: group.memberCount,
    };
}
function mapJoinRequest(row) {
    return {
        id: row._id.toString(),
        userId: row.user?._id?.toString() ?? "",
        name: row.user?.name ?? "",
        email: row.user?.email ?? "",
        avatar: row.user?.avatar ?? "",
        status: row.status,
        requestedAt: row.createdAt,
    };
}
export async function listPendingJoinRequests(groupId, actorId) {
    await assertGroupManager(groupId, actorId);
    const rows = await GroupJoinRequest.find({ group: groupId, status: "pending" })
        .populate("user", "name email avatar")
        .sort({ createdAt: -1 })
        .lean();
    return rows.map(mapJoinRequest);
}
export async function approveJoinRequest(groupId, actorId, targetUserId) {
    await assertGroupManager(groupId, actorId);
    const request = await GroupJoinRequest.findOne({
        group: groupId,
        user: targetUserId,
        status: "pending",
    });
    if (!request)
        throw httpError("Join request not found", 404);
    await addGroupMemberDirect(groupId, targetUserId);
    request.status = "approved";
    await request.save();
    const g = await Group.findById(groupId);
    await createNotification({
        userId: targetUserId,
        title: "Join request approved",
        body: `You were approved to join ${g?.name ?? "the group"}`,
        kind: "group_join_approved",
        refType: "group",
        refId: groupId,
        category: "groupActivity",
    });
    const memberCount = await syncGroupMemberCount(groupId);
    return { ok: true, userId: targetUserId, status: "approved", memberCount };
}
export async function rejectJoinRequest(groupId, actorId, targetUserId) {
    await assertGroupManager(groupId, actorId);
    const request = await GroupJoinRequest.findOne({
        group: groupId,
        user: targetUserId,
        status: "pending",
    });
    if (!request)
        throw httpError("Join request not found", 404);
    request.status = "rejected";
    await request.save();
    return { ok: true, userId: targetUserId, status: "rejected" };
}
export async function leaveGroup(userId, groupId) {
    const g = await Group.findById(groupId);
    if (!g) {
        throw httpError("Group not found", 404);
    }
    if (g.createdBy?.toString() === userId) {
        throw httpError("Owner cannot leave the community. Please transfer ownership or delete the community.", 400);
    }
    const ex = await GroupMember.findOne({ user: userId, group: groupId });
    if (!ex) {
        throw httpError("Not a member", 400);
    }
    await ex.deleteOne();
    const count = await syncGroupMemberCount(groupId);
    await Conversation.updateOne({ memberKey: `grp:${groupId}` }, {
        $pull: {
            members: new mongoose.Types.ObjectId(userId),
            admins: new mongoose.Types.ObjectId(userId),
        },
    }).catch(() => { });
    return { ok: true, isJoined: false, isMember: false, memberCount: count };
}
export async function listGroupMembers(groupId, userId) {
    const g = await Group.findById(groupId);
    if (!g) {
        throw httpError("Group not found", 404);
    }
    const isCreator = g.createdBy?.toString() === userId;
    const membership = await GroupMember.findOne({ user: userId, group: groupId });
    if (!membership && !isCreator && g.privacy === "Private") {
        throw httpError("Not a member of this private group", 403);
    }
    const members = await GroupMember.find({ group: groupId })
        .populate("user", "name email avatar")
        .sort({ role: 1, createdAt: 1 })
        .lean();
    const [limits, permissions] = await Promise.all([
        getGroupStaffLimits(groupId, g),
        getUserGroupPermissions(groupId, userId),
    ]);
    const list = members.map((m) => {
        const userDoc = m.user;
        const memberUserId = userDoc?._id?.toString() ?? "";
        const isOwner = g.createdBy?.toString() === memberUserId;
        return {
            id: memberUserId,
            name: userDoc?.name ?? "",
            email: userDoc?.email ?? "",
            avatar: userDoc?.avatar ?? "",
            role: (isOwner ? "owner" : m.role) || "member",
            isOwner,
            joinedAt: m.createdAt,
        };
    });
    return {
        members: list,
        limits,
        permissions,
        totalMembers: list.length,
    };
}
export async function listInviteCandidates(groupId, actorId, q) {
    const g = await Group.findById(groupId);
    if (!g)
        throw httpError("Group not found", 404);
    const isCreator = g.createdBy?.toString() === actorId;
    const isMember = isCreator ||
        (await GroupMember.exists({ group: groupId, user: actorId }));
    if (!isMember) {
        throw httpError("You must be a member of this group to invite friends", 403);
    }
    // Find accepted friends of actorId
    const friendRequests = await FriendRequest.find({
        status: "accepted",
        $or: [{ from: actorId }, { to: actorId }],
    })
        .populate("from", "name email avatar deletedAt")
        .populate("to", "name email avatar deletedAt")
        .lean();
    const blocks = await UserBlock.find({
        $or: [{ blocker: actorId }, { blocked: actorId }],
    }).lean();
    const blockedIds = new Set();
    for (const b of blocks) {
        if (b.blocker.toString() === actorId)
            blockedIds.add(b.blocked.toString());
        else
            blockedIds.add(b.blocker.toString());
    }
    const [existingMembers, pendingInvites] = await Promise.all([
        GroupMember.find({ group: groupId }).select("user").lean(),
        GroupInvite.find({ group: groupId, status: "pending" })
            .select("user")
            .lean(),
    ]);
    const excludeIds = new Set([
        ...existingMembers.map((m) => m.user.toString()),
        ...pendingInvites.map((i) => i.user.toString()),
        actorId,
        ...blockedIds,
    ]);
    const search = q?.trim().toLowerCase();
    const candidates = [];
    for (const fr of friendRequests) {
        const friendObj = fr.from._id.toString() === actorId
            ? fr.to
            : fr.from;
        if (!friendObj || friendObj.deletedAt)
            continue;
        const friendId = friendObj._id.toString();
        if (excludeIds.has(friendId))
            continue;
        if (search) {
            const name = (friendObj.name || "").toLowerCase();
            const email = (friendObj.email || "").toLowerCase();
            if (!name.includes(search) && !email.includes(search)) {
                continue;
            }
        }
        candidates.push({
            id: friendId,
            name: friendObj.name || "",
            email: friendObj.email || "",
            avatar: friendObj.avatar || "",
        });
    }
    candidates.sort((a, b) => a.name.localeCompare(b.name));
    return candidates;
}
export async function inviteToGroup(inviterId, groupId, opts) {
    const g = await Group.findById(groupId);
    if (!g) {
        throw httpError("Group not found", 404);
    }
    const isCreator = g.createdBy?.toString() === inviterId;
    const isMember = isCreator ||
        (await GroupMember.exists({ group: groupId, user: inviterId }));
    if (!isMember) {
        throw httpError("Not allowed to invite to this group", 403);
    }
    const targetIds = new Set();
    for (const uid of opts.userIds ?? []) {
        if (mongoose.isValidObjectId(uid))
            targetIds.add(String(uid));
    }
    for (const email of opts.emails ?? []) {
        const trimmed = email.trim().toLowerCase();
        if (!trimmed)
            continue;
        const u = await User.findOne({ email: trimmed }).lean();
        if (u)
            targetIds.add(u._id.toString());
    }
    let invited = 0;
    for (const uid of targetIds) {
        if (uid === inviterId)
            continue;
        const isAlreadyMember = await GroupMember.exists({
            user: uid,
            group: groupId,
        });
        if (isAlreadyMember)
            continue;
        const existingInvite = await GroupInvite.findOne({
            user: uid,
            group: groupId,
        });
        if (existingInvite?.status === "pending" ||
            existingInvite?.status === "accepted") {
            continue;
        }
        if (existingInvite) {
            existingInvite.status = "pending";
            existingInvite.invitedBy = new mongoose.Types.ObjectId(inviterId);
            await existingInvite.save();
        }
        else {
            await GroupInvite.create({
                group: groupId,
                user: uid,
                invitedBy: inviterId,
                status: "pending",
            });
        }
        invited += 1;
        await createNotification({
            userId: uid,
            actorId: inviterId,
            title: "Group invite",
            body: `You were invited to join ${g.name}`,
            kind: "group_invite",
            refType: "group",
            refId: groupId,
            category: "groupActivity",
        });
    }
    return {
        success: true,
        invited,
        memberCount: g.memberCount,
        membersLabel: formatCountLabel(g.memberCount, "members"),
    };
}
function mapPopulatedInviteUser(u) {
    if (!u || typeof u !== "object")
        return null;
    const doc = u;
    const id = doc._id?.toString() ?? "";
    if (!id)
        return null;
    return {
        id,
        name: doc.name ?? "",
        email: doc.email ?? "",
        avatar: doc.avatar ?? "",
    };
}
function mapGroupInvite(inv) {
    const user = mapPopulatedInviteUser(inv.user);
    return {
        id: inv._id.toString(),
        user,
        status: inv.status,
        invitedBy: {
            id: inv.invitedBy?._id?.toString() ??
                "",
            name: inv.invitedBy?.name ?? "",
            avatar: inv.invitedBy?.avatar ?? "",
        },
        invitedAt: inv.createdAt,
    };
}
export async function listGroupInvites(groupId, actorId, status = "all") {
    await assertGroupManager(groupId, actorId);
    const filter = { group: groupId };
    if (status === "pending") {
        filter.status = "pending";
    }
    else if (status === "accepted") {
        filter.status = "accepted";
    }
    else if (status === "rejected") {
        filter.status = "rejected";
    }
    else if (status === "invited") {
        filter.status = { $in: ["pending", "accepted"] };
    }
    const invites = await GroupInvite.find(filter)
        .populate("user", "name email avatar")
        .populate("invitedBy", "name avatar")
        .sort({ createdAt: -1 })
        .lean();
    return invites
        .filter((inv) => inv.user != null)
        .map(mapGroupInvite)
        .filter((inv) => inv.user != null);
}
async function findGroupInvite(groupId, targetUserId) {
    const invite = await GroupInvite.findOne({
        group: groupId,
        user: targetUserId,
    })
        .populate("user", "name email avatar")
        .populate("invitedBy", "name avatar");
    if (!invite)
        throw httpError("Invite not found", 404);
    return invite;
}
export async function cancelGroupInvite(groupId, actorId, targetUserId) {
    await assertGroupManager(groupId, actorId);
    const invite = await findGroupInvite(groupId, targetUserId);
    if (invite.status !== "pending") {
        throw httpError("Only pending invites can be cancelled", 400);
    }
    await invite.deleteOne();
    return { ok: true };
}
export async function resendGroupInvite(groupId, actorId, targetUserId) {
    await assertGroupManager(groupId, actorId);
    const g = await Group.findById(groupId);
    if (!g)
        throw httpError("Group not found", 404);
    const invite = await findGroupInvite(groupId, targetUserId);
    const isMember = await GroupMember.findOne({
        user: targetUserId,
        group: groupId,
    });
    if (isMember)
        throw httpError("User is already a member", 400);
    invite.status = "pending";
    invite.invitedBy = new mongoose.Types.ObjectId(actorId);
    await invite.save();
    await createNotification({
        userId: targetUserId,
        title: "Group invite",
        body: `You were invited to join ${g.name}`,
        kind: "group_invite",
        refType: "group",
        refId: groupId,
        category: "groupActivity",
    });
    return { invite: mapGroupInvite(invite.toObject()) };
}
export async function acceptGroupInvite(groupId, actorId, targetUserId) {
    const uid = targetUserId || actorId;
    if (actorId !== uid) {
        throw httpError("You can only accept your own invite", 403);
    }
    const g = await Group.findById(groupId);
    if (!g)
        throw httpError("Group not found", 404);
    const invite = await findGroupInvite(groupId, uid);
    if (invite.status === "accepted") {
        throw httpError("Invite already accepted", 400);
    }
    const existing = await GroupMember.findOne({ user: uid, group: groupId });
    if (!existing) {
        await GroupMember.create({ user: uid, group: groupId, role: "member" });
    }
    invite.status = "accepted";
    await invite.save();
    const count = await syncGroupMemberCount(groupId);
    await Conversation.updateOne({ memberKey: `grp:${groupId}` }, { $addToSet: { members: new mongoose.Types.ObjectId(uid) } }).catch(() => { });
    if (invite.invitedBy) {
        const inviterUserId = invite.invitedBy?._id
            ? invite.invitedBy._id.toString()
            : invite.invitedBy.toString();
        await createNotification({
            userId: inviterUserId,
            actorId: uid,
            title: "Invitation Accepted",
            body: `Someone accepted your invitation to join ${g.name}`,
            kind: "group_invite_accepted",
            refType: "group",
            refId: groupId,
            category: "groupActivity",
        }).catch(() => { });
    }
    const group = await getGroup(groupId, actorId);
    return { ok: true, isJoined: true, memberCount: count, group };
}
export async function rejectGroupInvite(groupId, actorId, targetUserId) {
    const uid = targetUserId || actorId;
    if (actorId !== uid) {
        throw httpError("You can only reject your own invite", 403);
    }
    const invite = await findGroupInvite(groupId, uid);
    invite.status = "rejected";
    await invite.save();
    return { ok: true, message: "Invitation declined" };
}
export async function listGroupPosts(groupId, userId, opts) {
    const g = await Group.findById(groupId);
    if (!g)
        throw httpError("Group not found", 404);
    if (g.privacy === "Private") {
        const isCreator = g.createdBy?.toString() === userId;
        const isMember = isCreator ||
            (await GroupMember.exists({ group: groupId, user: userId }));
        if (!isMember) {
            throw httpError("Membership required to access private community content", 403);
        }
    }
    return postsService.listPosts({
        viewerId: userId,
        groupId,
        page: opts.page,
        limit: opts.limit,
        q: opts.q,
        lang: opts.lang,
    });
}
export async function listGroupAdmins(groupId, userId) {
    await assertGroupMember(groupId, userId);
    const g = await Group.findById(groupId).lean();
    if (!g)
        throw httpError("Group not found", 404);
    const admins = await GroupMember.find({
        group: groupId,
        role: { $in: ["owner", "admin"] },
    })
        .populate("user", "name email avatar")
        .sort({ role: 1, createdAt: 1 })
        .lean();
    return admins.map((m) => ({
        id: m.user?._id?.toString() ?? "",
        name: m.user?.name ?? "",
        email: m.user?.email ?? "",
        avatar: m.user?.avatar ?? "",
        role: m.role,
        isOwner: g.createdBy?.toString() ===
            m.user?._id?.toString(),
    }));
}
export async function makeGroupAdmin(groupId, actorId, targetUserId) {
    return updateGroupMemberRole(groupId, actorId, targetUserId, "admin");
}
export async function removeGroupAdmin(groupId, actorId, targetUserId) {
    return updateGroupMemberRole(groupId, actorId, targetUserId, "member");
}
export async function assignGroupEditor(groupId, actorId, targetUserId) {
    return updateGroupMemberRole(groupId, actorId, targetUserId, "editor");
}
export async function removeGroupEditor(groupId, actorId, targetUserId) {
    return updateGroupMemberRole(groupId, actorId, targetUserId, "member");
}
export async function muteGroup(groupId, userId) {
    await assertGroupMember(groupId, userId);
    await GroupMute.findOneAndUpdate({ user: userId, group: groupId }, {}, { upsert: true, new: true });
    return { muted: true };
}
export async function unmuteGroup(groupId, userId) {
    await assertGroupMember(groupId, userId);
    await GroupMute.deleteOne({ user: userId, group: groupId });
    return { muted: false };
}
export async function addGroupMember(groupId, actorId, body) {
    await assertGroupManager(groupId, actorId);
    let targetUserId = body.userId?.trim();
    if (!targetUserId && body.email?.trim()) {
        const u = await User.findOne({ email: body.email.trim().toLowerCase() });
        if (!u) {
            throw httpError("User not found for that email", 404);
        }
        targetUserId = u._id.toString();
    }
    if (!targetUserId || !mongoose.isValidObjectId(targetUserId)) {
        throw httpError("userId or email is required", 400);
    }
    const role = body.role === "admin" || body.role === "editor" ? body.role : "member";
    const g = await Group.findById(groupId);
    if (!g) {
        throw httpError("Group not found", 404);
    }
    const ex = await GroupMember.findOne({ group: groupId, user: targetUserId });
    if (ex) {
        throw httpError("User is already a member", 400);
    }
    if (role === "admin" || role === "editor") {
        const limits = await getGroupStaffLimits(groupId, g);
        if (!limits.canAddStaff) {
            throw httpError(`Role limit reached for ${limits.tier} plan (maximum ${limits.maxStaff} staff members). Please upgrade or remove existing roles.`, 400);
        }
    }
    await GroupMember.create({ group: groupId, user: targetUserId, role });
    const count = await syncGroupMemberCount(groupId);
    const user = await User.findById(targetUserId)
        .select("name email avatar")
        .lean();
    return {
        member: {
            userId: targetUserId,
            name: user?.name ?? "",
            email: user?.email ?? "",
            avatar: user?.avatar ?? "",
            role,
        },
        memberCount: count,
        membersLabel: formatCountLabel(count, "members"),
    };
}
export async function removeGroupMember(groupId, actorId, targetUserId) {
    const g = await Group.findById(groupId);
    if (!g) {
        throw httpError("Group not found", 404);
    }
    if (g.createdBy?.toString() === targetUserId) {
        throw httpError("The community owner cannot be removed.", 400);
    }
    const targetMember = await GroupMember.findOne({
        group: groupId,
        user: targetUserId,
    });
    if (!targetMember) {
        throw httpError("Member not found", 404);
    }
    const isOwner = g.createdBy?.toString() === actorId;
    if (!isOwner) {
        const actorMember = await GroupMember.findOne({
            group: groupId,
            user: actorId,
        });
        if (!actorMember || actorMember.role !== "admin") {
            throw httpError("Only owner or admin can remove members", 403);
        }
        if (["admin", "editor", "moderator"].includes(targetMember.role)) {
            throw httpError("Admins can only remove regular members. Only the Owner can remove Admins or Editors.", 403);
        }
    }
    await targetMember.deleteOne();
    const count = await syncGroupMemberCount(groupId);
    await Conversation.updateOne({ memberKey: `grp:${groupId}` }, {
        $pull: {
            members: new mongoose.Types.ObjectId(targetUserId),
            admins: new mongoose.Types.ObjectId(targetUserId),
        },
    }).catch(() => { });
    await createNotification({
        userId: targetUserId,
        title: "Community Membership",
        body: `You were removed from ${g.name}`,
        kind: "group_member_removed",
        refType: "group",
        refId: groupId,
        category: "groupActivity",
    }).catch(() => { });
    return { ok: true, memberCount: count };
}
export async function updateGroupMemberRole(groupId, actorId, targetUserId, role) {
    const g = await Group.findById(groupId);
    if (!g) {
        throw httpError("Group not found", 404);
    }
    if (g.createdBy?.toString() !== actorId) {
        throw httpError("Only the community owner can change member roles", 403);
    }
    if (g.createdBy?.toString() === targetUserId) {
        throw httpError("The community owner role cannot be changed or downgraded", 400);
    }
    const normalizedRole = role === "moderator" ? "editor" : role;
    if (!["admin", "editor", "member"].includes(normalizedRole)) {
        throw httpError("Role must be admin, editor, or member", 400);
    }
    const targetMember = await GroupMember.findOne({
        group: groupId,
        user: targetUserId,
    });
    if (!targetMember) {
        throw httpError("Member not found", 404);
    }
    const isPromotingToStaff = ["admin", "editor"].includes(normalizedRole);
    const wasStaff = ["admin", "editor", "moderator"].includes(targetMember.role);
    if (isPromotingToStaff && !wasStaff) {
        const limits = await getGroupStaffLimits(groupId, g);
        if (!limits.canAddStaff) {
            throw httpError(`Role limit reached for this community's ${limits.tier} plan (maximum ${limits.maxStaff} Admins and Editors combined). Please upgrade to Premium or remove existing roles to assign new ones.`, 400);
        }
    }
    targetMember.role = normalizedRole;
    await targetMember.save();
    if (normalizedRole === "admin") {
        await Conversation.updateOne({ memberKey: `grp:${groupId}` }, { $addToSet: { admins: new mongoose.Types.ObjectId(targetUserId) } }).catch(() => { });
    }
    else {
        await Conversation.updateOne({ memberKey: `grp:${groupId}` }, { $pull: { admins: new mongoose.Types.ObjectId(targetUserId) } }).catch(() => { });
    }
    await createNotification({
        userId: targetUserId,
        actorId,
        title: "Community Role Updated",
        body: `Your role in ${g.name} was updated to ${normalizedRole}`,
        kind: "group_role_updated",
        refType: "group",
        refId: groupId,
        category: "groupActivity",
    }).catch(() => { });
    const limits = await getGroupStaffLimits(groupId, g);
    return {
        ok: true,
        userId: targetUserId,
        role: normalizedRole,
        limits,
        message: `Role updated to ${normalizedRole}`,
    };
}
export async function getCommunityNotificationSettings(groupId, actorId) {
    const perms = await getUserGroupPermissions(groupId, actorId);
    if (!perms.canManageCommunityNotifications) {
        throw httpError("Only owner or admin can view community notification settings", 403);
    }
    let settings = await GroupNotificationSettings.findOne({ group: groupId });
    if (!settings) {
        settings = await GroupNotificationSettings.create({ group: groupId });
    }
    return settings;
}
export async function updateCommunityNotificationSettings(groupId, actorId, body) {
    const perms = await getUserGroupPermissions(groupId, actorId);
    if (!perms.canManageCommunityNotifications) {
        throw httpError("Only owner or admin can update community notification settings", 403);
    }
    let settings = await GroupNotificationSettings.findOne({ group: groupId });
    if (!settings) {
        settings = new GroupNotificationSettings({ group: groupId });
    }
    const fields = [
        "newMemberJoined",
        "memberLeft",
        "newJoinRequest",
        "invitationAccepted",
        "newCommunityPost",
        "newPrayerRequest",
        "newPraisePost",
        "newComments",
        "communityLiveStreamStarted",
        "communityDonationsSupport",
        "memberReports",
        "communityAnnouncements",
    ];
    for (const f of fields) {
        if (typeof body[f] === "boolean") {
            settings[f] = body[f];
        }
    }
    await settings.save();
    return settings;
}
export async function getMyGroupNotificationPreferences(groupId, userId) {
    let prefs = await GroupMemberNotificationPreferences.findOne({
        group: groupId,
        user: userId,
    });
    if (!prefs) {
        prefs = await GroupMemberNotificationPreferences.create({
            group: groupId,
            user: userId,
        });
    }
    return prefs;
}
export async function updateMyGroupNotificationPreferences(groupId, userId, body) {
    let prefs = await GroupMemberNotificationPreferences.findOne({
        group: groupId,
        user: userId,
    });
    if (!prefs) {
        prefs = new GroupMemberNotificationPreferences({
            group: groupId,
            user: userId,
        });
    }
    const fields = [
        "allNotifications",
        "newPosts",
        "prayerPraiseUpdates",
        "commentsReplies",
        "liveStreamNotifications",
        "communityAnnouncements",
        "muteCommunityNotifications",
    ];
    for (const f of fields) {
        if (typeof body[f] === "boolean") {
            prefs[f] = body[f];
        }
    }
    if (typeof body.muteCommunity === "boolean" && body.muteCommunityNotifications === undefined) {
        prefs.muteCommunityNotifications = body.muteCommunity;
    }
    await prefs.save();
    return prefs;
}
export async function getGroupAnalytics(groupId, actorId) {
    const perms = await getUserGroupPermissions(groupId, actorId);
    if (!perms.canAccessAnalytics) {
        throw httpError("Not authorized to view community analytics", 403);
    }
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const [totalMembers, newMembers, totalPosts, prayerPosts, praisePosts, groupPosts, donations, liveStreams,] = await Promise.all([
        GroupMember.countDocuments({ group: groupId }),
        GroupMember.countDocuments({
            group: groupId,
            createdAt: { $gte: thirtyDaysAgo },
        }),
        Post.countDocuments({ group: groupId }),
        Post.countDocuments({
            group: groupId,
            $or: [{ mode: "prayer" }, { category: "Prayer" }],
        }),
        Post.countDocuments({
            group: groupId,
            $or: [{ mode: "praise" }, { category: "Praise" }],
        }),
        Post.find({ group: groupId })
            .select("_id likesCount praysCount praisesCount commentsCount")
            .lean(),
        Donation.find({ group: groupId, status: "Completed" }).lean(),
        LiveStreamSession.find({ groupId }).lean().catch(() => []),
    ]);
    const postIds = groupPosts.map((p) => p._id);
    const [commentDocCount, reactionDocCount] = await Promise.all([
        Comment.countDocuments({ post: { $in: postIds } }).catch(() => 0),
        PostReaction.countDocuments({ post: { $in: postIds } }).catch(() => 0),
    ]);
    let sumComments = 0;
    let sumReactions = 0;
    for (const p of groupPosts) {
        sumComments += p.commentsCount || 0;
        sumReactions += (p.likesCount || 0) + (p.praysCount || 0) + (p.praisesCount || 0);
    }
    const totalComments = commentDocCount > 0 ? commentDocCount : sumComments;
    const totalReactions = reactionDocCount > 0 ? reactionDocCount : sumReactions;
    const postEngagement = totalComments + totalReactions;
    let totalDonationsCents = 0;
    for (const d of donations) {
        totalDonationsCents += d.amountCents || 0;
    }
    let totalLiveViewers = 0;
    for (const ls of liveStreams) {
        totalLiveViewers += ls.viewersCount || ls.peakViewers || 0;
    }
    const liveComments = await LiveStreamComment.countDocuments({
        sessionId: {
            $in: liveStreams.map((s) => s.sessionId || s._id),
        },
    }).catch(() => 0);
    return {
        totalMembers,
        newMembers,
        totalPosts,
        prayerPosts,
        praisePosts,
        postEngagement,
        totalReactions,
        totalComments,
        donationsCents: totalDonationsCents,
        donationsFormatted: `$${(totalDonationsCents / 100).toFixed(2)}`,
        liveStreamCount: liveStreams.length,
        liveStreamViewers: totalLiveViewers,
        liveStreamEngagement: liveComments,
    };
}
export async function getGroupSubscriptionDetails(groupId, actorId) {
    const g = await Group.findById(groupId).lean();
    if (!g)
        throw httpError("Group not found", 404);
    const limits = await getGroupStaffLimits(groupId, g);
    let activePlan = null;
    if (g.createdBy) {
        activePlan = await UserSubscription.findOne({
            user: g.createdBy,
            status: "Active",
        })
            .populate("plan")
            .lean();
    }
    return {
        tier: limits.tier,
        planName: limits.tier === "Premium" ? "Premium Plan" : "Standard Plan",
        billingCycle: activePlan?.billing || "Monthly",
        status: activePlan?.status || "Active",
        expiryDate: activePlan?.expiryDate || null,
        limits,
    };
}
export async function getGroupPermissionsAndLimits(groupId, actorId) {
    const g = await Group.findById(groupId).lean();
    if (!g)
        throw httpError("Group not found", 404);
    const [permissions, limits, subscription] = await Promise.all([
        getUserGroupPermissions(groupId, actorId),
        getGroupStaffLimits(groupId, g),
        getGroupSubscriptionDetails(groupId, actorId),
    ]);
    return {
        role: permissions.role,
        isOwner: permissions.isOwner,
        isAdmin: permissions.isAdmin,
        isEditor: permissions.isEditor,
        isMember: permissions.isMember,
        permissions,
        limits,
        subscription,
        memberCount: g.memberCount,
        privacy: g.privacy || "Public",
    };
}
