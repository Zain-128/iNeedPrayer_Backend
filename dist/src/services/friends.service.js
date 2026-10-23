import { FriendRequest } from "../models/friendRequest.model.js";
import { User } from "../models/user.model.js";
import { UserBlock } from "../models/userBlock.model.js";
import { mapAuthor } from "../utils/mappers.js";
import { createNotification } from "./notifications.service.js";
import { getUserSubscription } from "./stripe.service.js";
function httpError(message, statusCode) {
    const err = new Error(message);
    err.statusCode = statusCode;
    return err;
}
async function assertNotBlocked(a, b) {
    const blocked = await UserBlock.findOne({
        $or: [
            { blocker: a, blocked: b },
            { blocker: b, blocked: a },
        ],
    });
    if (blocked)
        throw httpError("Cannot perform this action", 403);
}
async function assertUserExists(userId) {
    const u = await User.findById(userId).select("status role deletedAt").lean();
    if (!u || u.deletedAt || u.status === "blocked" || u.role === "admin") {
        throw httpError("User not found", 404);
    }
}
async function userDisplayName(userId) {
    const u = await User.findById(userId).select("name").lean();
    return u?.name?.trim() || "Someone";
}
export async function areFriends(userA, userB) {
    const row = await FriendRequest.findOne({
        status: "accepted",
        $or: [
            { from: userA, to: userB },
            { from: userB, to: userA },
        ],
    });
    return !!row;
}
export async function sendFriendRequest(fromId, toId) {
    if (fromId === toId)
        throw httpError("Cannot send request to yourself", 400);
    await assertUserExists(toId);
    await assertNotBlocked(fromId, toId);
    if (await areFriends(fromId, toId)) {
        return { status: "accepted", message: "Already friends" };
    }
    // Free Tier Weekly Friend Request Limit (Item 66)
    const activeSub = await getUserSubscription(fromId);
    if (!activeSub) {
        const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        const countThisWeek = await FriendRequest.countDocuments({
            from: fromId,
            createdAt: { $gte: sevenDaysAgo },
        });
        if (countThisWeek >= 5) {
            throw httpError("Free plan allows a maximum of 5 friend requests per week. Please upgrade to Premium for unlimited requests.", 403);
        }
    }
    const reversePending = await FriendRequest.findOne({
        from: toId,
        to: fromId,
        status: "pending",
    });
    if (reversePending) {
        reversePending.status = "accepted";
        await reversePending.save();
        const accepterName = await userDisplayName(fromId);
        await createNotification({
            userId: toId,
            actorId: fromId,
            title: "Friend request accepted",
            body: `${accepterName} accepted your friend request`,
            kind: "friend_accepted",
            refType: "user",
            refId: fromId,
            category: "friendRequests",
        });
        return { status: "accepted", message: "Friend request accepted" };
    }
    const existing = await FriendRequest.findOne({ from: fromId, to: toId });
    if (existing?.status === "pending") {
        return { status: "pending", message: "Request already sent" };
    }
    if (existing?.status === "accepted") {
        return { status: "accepted", message: "Already friends" };
    }
    await FriendRequest.findOneAndUpdate({ from: fromId, to: toId }, { status: "pending" }, { upsert: true, new: true });
    const senderName = await userDisplayName(fromId);
    await createNotification({
        userId: toId,
        actorId: fromId,
        title: "Friend request",
        body: `${senderName} sent you a friend request`,
        kind: "friend_request",
        refType: "user",
        refId: fromId,
        category: "friendRequests",
    });
    return { status: "pending", message: "Friend request sent" };
}
export async function acceptFriendRequest(accepterId, requesterId) {
    if (accepterId === requesterId)
        throw httpError("Invalid request", 400);
    await assertNotBlocked(accepterId, requesterId);
    const row = await FriendRequest.findOne({
        from: requesterId,
        to: accepterId,
        status: "pending",
    });
    if (!row)
        throw httpError("Friend request not found", 404);
    row.status = "accepted";
    await row.save();
    const accepterName = await userDisplayName(accepterId);
    await createNotification({
        userId: requesterId,
        actorId: accepterId,
        title: "Friend request accepted",
        body: `${accepterName} accepted your friend request`,
        kind: "friend_accepted",
        refType: "user",
        refId: accepterId,
        category: "friendRequests",
    });
    return { status: "accepted", message: "Friend request accepted" };
}
export async function rejectFriendRequest(accepterId, requesterId) {
    if (accepterId === requesterId)
        throw httpError("Invalid request", 400);
    const row = await FriendRequest.findOne({
        from: requesterId,
        to: accepterId,
        status: "pending",
    });
    if (!row)
        throw httpError("Friend request not found", 404);
    row.status = "rejected";
    await row.save();
    return { message: "Friend request rejected" };
}
export async function listFriends(userId) {
    const rows = await FriendRequest.find({
        status: "accepted",
        $or: [{ from: userId }, { to: userId }],
    })
        .populate("from", "name avatar city state country deletedAt")
        .populate("to", "name avatar city state country deletedAt")
        .lean();
    const blocked = await UserBlock.find({
        $or: [{ blocker: userId }, { blocked: userId }],
    }).lean();
    const hide = new Set();
    for (const b of blocked) {
        if (b.blocker.toString() === userId)
            hide.add(b.blocked.toString());
        else
            hide.add(b.blocker.toString());
    }
    const friends = rows
        .filter((r) => {
        const from = r.from;
        const to = r.to;
        return !from.deletedAt && !to.deletedAt;
    })
        .map((r) => {
        const peer = r.from._id.toString() === userId
            ? r.to
            : r.from;
        return mapAuthor(peer);
    })
        .filter((u) => !hide.has(u.id));
    return friends;
}
function mapRequestUser(row, peerField) {
    const peer = row[peerField];
    return {
        requestId: row._id.toString(),
        user: mapAuthor(peer),
        requestedAt: row.createdAt,
    };
}
export async function listIncomingFriendRequests(userId) {
    const rows = await FriendRequest.find({ to: userId, status: "pending" })
        .populate("from", "name avatar city state country deletedAt")
        .sort({ createdAt: -1 })
        .lean();
    const hide = await UserBlock.find({
        $or: [{ blocker: userId }, { blocked: userId }],
    }).lean();
    const blocked = new Set();
    for (const b of hide) {
        if (b.blocker.toString() === userId)
            blocked.add(b.blocked.toString());
        else
            blocked.add(b.blocker.toString());
    }
    return rows
        .filter((r) => {
        const from = r.from;
        return !from.deletedAt && !blocked.has(r.from._id.toString());
    })
        .map((r) => mapRequestUser(r, "from"));
}
export async function listOutgoingFriendRequests(userId) {
    const rows = await FriendRequest.find({ from: userId, status: "pending" })
        .populate("to", "name avatar city state country deletedAt")
        .sort({ createdAt: -1 })
        .lean();
    const hide = await UserBlock.find({
        $or: [{ blocker: userId }, { blocked: userId }],
    }).lean();
    const blocked = new Set();
    for (const b of hide) {
        if (b.blocker.toString() === userId)
            blocked.add(b.blocked.toString());
        else
            blocked.add(b.blocker.toString());
    }
    return rows
        .filter((r) => {
        const to = r.to;
        return !to.deletedAt && !blocked.has(r.to._id.toString());
    })
        .map((r) => mapRequestUser(r, "to"));
}
export async function cancelFriendRequest(fromId, toId) {
    if (fromId === toId)
        throw httpError("Invalid request", 400);
    const row = await FriendRequest.findOne({
        from: fromId,
        to: toId,
        status: "pending",
    });
    if (!row)
        throw httpError("Friend request not found", 404);
    await row.deleteOne();
    return { message: "Friend request cancelled" };
}
export async function removeFriend(userId, friendId) {
    if (userId === friendId)
        throw httpError("Invalid request", 400);
    const row = await FriendRequest.findOne({
        status: "accepted",
        $or: [
            { from: userId, to: friendId },
            { from: friendId, to: userId },
        ],
    });
    if (!row)
        throw httpError("Friend not found", 404);
    await row.deleteOne();
    return { message: "Friend removed" };
}
export async function getFriendRequestStatus(viewerId, targetUserId) {
    if (viewerId === targetUserId)
        return "none";
    if (await areFriends(viewerId, targetUserId))
        return "friends";
    const sent = await FriendRequest.findOne({
        from: viewerId,
        to: targetUserId,
        status: "pending",
    });
    if (sent)
        return "pending_sent";
    const received = await FriendRequest.findOne({
        from: targetUserId,
        to: viewerId,
        status: "pending",
    });
    if (received)
        return "pending_received";
    return "none";
}
