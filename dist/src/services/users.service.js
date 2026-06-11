import mongoose from "mongoose";
import { User } from "../models/user.model.js";
import { UserFollow } from "../models/userFollow.model.js";
import { UserBlock } from "../models/userBlock.model.js";
import { FriendRequest } from "../models/friendRequest.model.js";
import { formatCountLabel, mapAuthor } from "../utils/mappers.js";
import { getFriendRequestStatus } from "./friends.service.js";
export async function getMyProfile(userId) {
    const u = await User.findById(userId).lean();
    if (!u) {
        const err = new Error("User not found");
        err.statusCode = 404;
        throw err;
    }
    return mapProfile(u, { includeEmail: true });
}
export async function updateMe(userId, body) {
    const user = await User.findById(userId).select("+password");
    if (!user) {
        const err = new Error("User not found");
        err.statusCode = 404;
        throw err;
    }
    if (body.email !== undefined && body.email.trim()) {
        const taken = await User.findOne({
            email: body.email.toLowerCase().trim(),
            _id: { $ne: userId },
        });
        if (taken) {
            const err = new Error("Email already in use");
            err.statusCode = 409;
            throw err;
        }
        user.email = body.email.toLowerCase().trim();
    }
    if (body.name !== undefined)
        user.name = body.name.trim();
    if (body.avatar !== undefined)
        user.avatar = body.avatar.trim();
    if (body.coverImage !== undefined)
        user.coverImage = body.coverImage.trim();
    if (body.bio !== undefined)
        user.bio = body.bio.trim().slice(0, 500);
    if (body.preferredLanguage !== undefined) {
        user.preferredLanguage = body.preferredLanguage.trim().toLowerCase() || "en";
    }
    if (body.city !== undefined)
        user.city = body.city.trim();
    if (body.state !== undefined)
        user.state = body.state.trim();
    if (body.country !== undefined)
        user.country = body.country.trim();
    await user.save();
    const out = await User.findById(userId).lean();
    return mapProfile(out, { includeEmail: true });
}
export async function changePassword(userId, currentPassword, newPassword) {
    const user = await User.findById(userId).select("+password");
    if (!user) {
        const err = new Error("User not found");
        err.statusCode = 404;
        throw err;
    }
    if (!currentPassword || !newPassword) {
        const err = new Error("currentPassword and newPassword are required");
        err.statusCode = 400;
        throw err;
    }
    if (newPassword.length < 6) {
        const err = new Error("Password must be at least 6 characters");
        err.statusCode = 400;
        throw err;
    }
    const ok = await user.comparePassword(currentPassword);
    if (!ok) {
        const err = new Error("Current password is incorrect");
        err.statusCode = 401;
        throw err;
    }
    user.password = newPassword;
    await user.save();
    return { message: "Password updated" };
}
function mapProfile(u, opts) {
    const location = [u.city, u.state, u.country].filter(Boolean).join(", ") || undefined;
    return {
        _id: u._id.toString(),
        id: u._id.toString(),
        name: u.name,
        ...(opts?.includeEmail !== false && u.email ? { email: u.email } : {}),
        avatar: u.avatar ?? "",
        coverImage: u.coverImage ?? "",
        bio: u.bio ?? "",
        preferredLanguage: u.preferredLanguage ?? "en",
        city: u.city ?? "",
        state: u.state ?? "",
        country: u.country ?? "",
        ...(location ? { location } : {}),
        followersCount: u.followersCount,
        followingCount: u.followingCount,
        postsCount: u.postsCount,
        followersLabel: formatCountLabel(u.followersCount, "followers"),
        followingLabel: formatCountLabel(u.followingCount, "following"),
        postsLabel: formatCountLabel(u.postsCount, "posts"),
        createdAt: u.createdAt,
        updatedAt: u.updatedAt,
    };
}
export async function getPublicProfile(viewerId, userId) {
    if (viewerId) {
        const blocked = await UserBlock.findOne({
            $or: [
                { blocker: viewerId, blocked: userId },
                { blocker: userId, blocked: viewerId },
            ],
        });
        if (blocked) {
            const err = new Error("User not found");
            err.statusCode = 404;
            throw err;
        }
    }
    const u = await User.findById(userId).lean();
    if (!u) {
        const err = new Error("User not found");
        err.statusCode = 404;
        throw err;
    }
    let isFollowing = false;
    let friendStatus = "none";
    if (viewerId) {
        const f = await UserFollow.findOne({ follower: viewerId, following: userId });
        isFollowing = !!f;
        friendStatus = await getFriendRequestStatus(viewerId, userId);
    }
    return {
        ...mapProfile(u, { includeEmail: false }),
        author: mapAuthor(u),
        isFollowing,
        friendStatus,
    };
}
export async function getBlockedUserIds(viewerId) {
    const blocked = await UserBlock.find({
        $or: [{ blocker: viewerId }, { blocked: viewerId }],
    }).lean();
    const hide = new Set();
    for (const b of blocked) {
        if (b.blocker.toString() === viewerId)
            hide.add(b.blocked.toString());
        else
            hide.add(b.blocker.toString());
    }
    return hide;
}
export async function searchUsers(q, viewerId, limit = 30) {
    const rx = new RegExp(q.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    const hide = await getBlockedUserIds(viewerId);
    const users = await User.find({
        _id: { $ne: viewerId },
        $or: [{ name: rx }, { email: rx }],
    })
        .limit(limit)
        .select("name avatar city state country")
        .lean();
    return users
        .filter((u) => !hide.has(u._id.toString()))
        .map((u) => mapAuthor(u));
}
export async function toggleFollow(followerId, targetUserId) {
    if (followerId === targetUserId) {
        const err = new Error("Cannot follow yourself");
        err.statusCode = 400;
        throw err;
    }
    const blocked = await UserBlock.findOne({
        $or: [
            { blocker: followerId, blocked: targetUserId },
            { blocker: targetUserId, blocked: followerId },
        ],
    });
    if (blocked) {
        const err = new Error("Cannot follow this user");
        err.statusCode = 403;
        throw err;
    }
    const existing = await UserFollow.findOne({
        follower: followerId,
        following: targetUserId,
    });
    if (existing) {
        await existing.deleteOne();
        await User.findByIdAndUpdate(followerId, { $inc: { followingCount: -1 } });
        await User.findByIdAndUpdate(targetUserId, { $inc: { followersCount: -1 } });
        return { following: false };
    }
    await UserFollow.create({ follower: followerId, following: targetUserId });
    await User.findByIdAndUpdate(followerId, { $inc: { followingCount: 1 } });
    await User.findByIdAndUpdate(targetUserId, { $inc: { followersCount: 1 } });
    return { following: true };
}
export async function followUser(followerId, targetUserId) {
    if (followerId === targetUserId) {
        const err = new Error("Cannot follow yourself");
        err.statusCode = 400;
        throw err;
    }
    const blocked = await UserBlock.findOne({
        $or: [
            { blocker: followerId, blocked: targetUserId },
            { blocker: targetUserId, blocked: followerId },
        ],
    });
    if (blocked) {
        const err = new Error("Cannot follow this user");
        err.statusCode = 403;
        throw err;
    }
    const existing = await UserFollow.findOne({
        follower: followerId,
        following: targetUserId,
    });
    if (existing)
        return { following: true, message: "Already following" };
    await UserFollow.create({ follower: followerId, following: targetUserId });
    await User.findByIdAndUpdate(followerId, { $inc: { followingCount: 1 } });
    await User.findByIdAndUpdate(targetUserId, { $inc: { followersCount: 1 } });
    return { following: true, message: "Following" };
}
export async function unfollowUser(followerId, targetUserId) {
    const existing = await UserFollow.findOne({
        follower: followerId,
        following: targetUserId,
    });
    if (!existing)
        return { following: false, message: "Not following" };
    await existing.deleteOne();
    await User.findByIdAndUpdate(followerId, { $inc: { followingCount: -1 } });
    await User.findByIdAndUpdate(targetUserId, { $inc: { followersCount: -1 } });
    return { following: false, message: "Unfollowed" };
}
export async function listFollowers(profileUserId, viewerId) {
    const hide = viewerId ? await getBlockedUserIds(viewerId) : new Set();
    const rows = await UserFollow.find({ following: profileUserId })
        .populate("follower", "name avatar city state country")
        .lean();
    const users = rows
        .map((r) => mapAuthor(r.follower))
        .filter((u) => !hide.has(u.id));
    return users;
}
export async function listFollowing(profileUserId, viewerId) {
    const hide = viewerId ? await getBlockedUserIds(viewerId) : new Set();
    const rows = await UserFollow.find({ follower: profileUserId })
        .populate("following", "name avatar city state country")
        .lean();
    const users = rows
        .map((r) => mapAuthor(r.following))
        .filter((u) => !hide.has(u.id));
    return users;
}
export async function listBlocked(blockerId) {
    const rows = await UserBlock.find({ blocker: blockerId })
        .populate("blocked", "name avatar")
        .lean();
    return rows.map((r) => {
        const b = r.blocked;
        return {
            id: b._id.toString(),
            name: b.name,
            avatar: b.avatar ?? "",
        };
    });
}
export async function blockUser(blockerId, blockedId) {
    if (blockerId === blockedId) {
        const err = new Error("Invalid");
        err.statusCode = 400;
        throw err;
    }
    const f1 = await UserFollow.findOne({
        follower: blockerId,
        following: blockedId,
    });
    const f2 = await UserFollow.findOne({
        follower: blockedId,
        following: blockerId,
    });
    await UserFollow.deleteMany({
        $or: [
            { follower: blockerId, following: blockedId },
            { follower: blockedId, following: blockerId },
        ],
    });
    if (f1) {
        await User.findByIdAndUpdate(blockerId, { $inc: { followingCount: -1 } });
        await User.findByIdAndUpdate(blockedId, { $inc: { followersCount: -1 } });
    }
    if (f2) {
        await User.findByIdAndUpdate(blockedId, { $inc: { followingCount: -1 } });
        await User.findByIdAndUpdate(blockerId, { $inc: { followersCount: -1 } });
    }
    await UserBlock.findOneAndUpdate({ blocker: blockerId, blocked: blockedId }, {}, { upsert: true });
    await FriendRequest.deleteMany({
        $or: [
            { from: blockerId, to: blockedId },
            { from: blockedId, to: blockerId },
        ],
    });
}
export async function unblockUser(blockerId, blockedId) {
    await UserBlock.deleteOne({ blocker: blockerId, blocked: blockedId });
}
export async function getBlockStatus(viewerId, targetUserId) {
    if (!mongoose.isValidObjectId(targetUserId)) {
        const err = new Error("Invalid user id");
        err.statusCode = 400;
        throw err;
    }
    if (viewerId === targetUserId) {
        return {
            blocked: false,
            blockedByMe: false,
            blockedByThem: false,
        };
    }
    const [blockedByMe, blockedByThem] = await Promise.all([
        UserBlock.findOne({ blocker: viewerId, blocked: targetUserId }),
        UserBlock.findOne({ blocker: targetUserId, blocked: viewerId }),
    ]);
    return {
        blocked: !!(blockedByMe || blockedByThem),
        blockedByMe: !!blockedByMe,
        blockedByThem: !!blockedByThem,
    };
}
async function getFriendIds(userId) {
    const rows = await FriendRequest.find({
        status: "accepted",
        $or: [{ from: userId }, { to: userId }],
    }).lean();
    const ids = new Set();
    for (const r of rows) {
        const peer = r.from.toString() === userId ? r.to.toString() : r.from.toString();
        ids.add(peer);
    }
    return ids;
}
export async function getMutualFriends(viewerId, targetUserId) {
    if (viewerId === targetUserId) {
        const err = new Error("Invalid user id");
        err.statusCode = 400;
        throw err;
    }
    const blocked = await UserBlock.findOne({
        $or: [
            { blocker: viewerId, blocked: targetUserId },
            { blocker: targetUserId, blocked: viewerId },
        ],
    });
    if (blocked) {
        const err = new Error("User not found");
        err.statusCode = 404;
        throw err;
    }
    const [myFriends, theirFriends] = await Promise.all([
        getFriendIds(viewerId),
        getFriendIds(targetUserId),
    ]);
    const mutualIds = [...myFriends].filter((id) => theirFriends.has(id));
    if (!mutualIds.length)
        return [];
    const users = await User.find({ _id: { $in: mutualIds } })
        .select("name avatar city state country")
        .lean();
    return users.map((u) => mapAuthor(u));
}
export async function getSuggestedUsers(viewerId, limit = 20) {
    const hide = await getBlockedUserIds(viewerId);
    hide.add(viewerId);
    const myFriends = await getFriendIds(viewerId);
    const exclude = new Set([...hide, ...myFriends]);
    const pending = await FriendRequest.find({
        status: "pending",
        $or: [{ from: viewerId }, { to: viewerId }],
    }).lean();
    for (const r of pending) {
        exclude.add(r.from.toString() === viewerId ? r.to.toString() : r.from.toString());
    }
    let candidateIds = [];
    if (myFriends.size) {
        const friendObjectIds = [...myFriends].map((id) => new mongoose.Types.ObjectId(id));
        const friendsOfFriends = await FriendRequest.find({
            status: "accepted",
            $or: [{ from: { $in: friendObjectIds } }, { to: { $in: friendObjectIds } }],
        }).lean();
        const counts = new Map();
        for (const r of friendsOfFriends) {
            for (const id of [r.from.toString(), r.to.toString()]) {
                if (!myFriends.has(id) && !exclude.has(id)) {
                    counts.set(id, (counts.get(id) ?? 0) + 1);
                }
            }
        }
        candidateIds = [...counts.entries()]
            .sort((a, b) => b[1] - a[1])
            .map(([id]) => id);
    }
    const excludeObjectIds = [...exclude]
        .filter((id) => mongoose.isValidObjectId(id))
        .map((id) => new mongoose.Types.ObjectId(id));
    const users = [];
    if (candidateIds.length) {
        const picked = await User.find({
            _id: {
                $in: candidateIds
                    .slice(0, limit)
                    .map((id) => new mongoose.Types.ObjectId(id)),
            },
        })
            .select("name avatar city state country")
            .lean();
        const order = new Map(candidateIds.map((id, i) => [id, i]));
        users.push(...picked.sort((a, b) => (order.get(a._id.toString()) ?? 0) - (order.get(b._id.toString()) ?? 0)));
    }
    if (users.length < limit) {
        const fill = await User.find({ _id: { $nin: excludeObjectIds } })
            .select("name avatar city state country")
            .sort({ followersCount: -1 })
            .limit(limit - users.length)
            .lean();
        const seen = new Set(users.map((u) => u._id.toString()));
        for (const u of fill) {
            if (!seen.has(u._id.toString()))
                users.push(u);
        }
    }
    return users.slice(0, limit).map((u) => mapAuthor(u));
}
