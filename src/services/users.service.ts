import mongoose from "mongoose";
import { User } from "../models/user.model.js";
import { UserFollow } from "../models/userFollow.model.js";
import { UserBlock } from "../models/userBlock.model.js";
import { FriendRequest } from "../models/friendRequest.model.js";
import { formatCountLabel, mapAuthor } from "../utils/mappers.js";
import { getFriendRequestStatus } from "./friends.service.js";

export async function getMyProfile(userId: string) {
  const u = await User.findById(userId).lean();
  if (!u) {
    const err = new Error("User not found");
    (err as Error & { statusCode?: number }).statusCode = 404;
    throw err;
  }
  return mapProfile(u as never, { includeEmail: true });
}

export async function updateMe(
  userId: string,
  body: {
    name?: string;
    email?: string;
    avatar?: string;
    coverImage?: string;
    bio?: string;
    preferredLanguage?: string;
    city?: string;
    state?: string;
    country?: string;
  }
) {
  const user = await User.findById(userId).select("+password");
  if (!user) {
    const err = new Error("User not found");
    (err as Error & { statusCode?: number }).statusCode = 404;
    throw err;
  }
  if (body.email !== undefined && body.email.trim()) {
    const taken = await User.findOne({
      email: body.email.toLowerCase().trim(),
      _id: { $ne: userId },
    });
    if (taken) {
      const err = new Error("Email already in use");
      (err as Error & { statusCode?: number }).statusCode = 409;
      throw err;
    }
    user.email = body.email.toLowerCase().trim();
  }
  if (body.name !== undefined) user.name = body.name.trim();
  if (body.avatar !== undefined) user.avatar = body.avatar.trim();
  if (body.coverImage !== undefined) user.coverImage = body.coverImage.trim();
  if (body.bio !== undefined) user.bio = body.bio.trim().slice(0, 500);
  if (body.preferredLanguage !== undefined) {
    user.preferredLanguage = body.preferredLanguage.trim().toLowerCase() || "en";
  }
  if (body.city !== undefined) user.city = body.city.trim();
  if (body.state !== undefined) user.state = body.state.trim();
  if (body.country !== undefined) user.country = body.country.trim();
  await user.save();
  const out = await User.findById(userId).lean();
  return mapProfile(out as never, { includeEmail: true });
}

export async function changePassword(
  userId: string,
  currentPassword: string,
  newPassword: string
) {
  const user = await User.findById(userId).select("+password");
  if (!user) {
    const err = new Error("User not found");
    (err as Error & { statusCode?: number }).statusCode = 404;
    throw err;
  }
  if (!currentPassword || !newPassword) {
    const err = new Error("currentPassword and newPassword are required");
    (err as Error & { statusCode?: number }).statusCode = 400;
    throw err;
  }
  if (newPassword.length < 6) {
    const err = new Error("Password must be at least 6 characters");
    (err as Error & { statusCode?: number }).statusCode = 400;
    throw err;
  }
  const ok = await user.comparePassword(currentPassword);
  if (!ok) {
    const err = new Error("Current password is incorrect");
    (err as Error & { statusCode?: number }).statusCode = 401;
    throw err;
  }
  user.password = newPassword;
  await user.save();
  return { message: "Password updated" };
}

function mapProfile(u: {
  _id: mongoose.Types.ObjectId;
  name: string;
  email?: string;
  avatar?: string;
  coverImage?: string;
  bio?: string;
  preferredLanguage?: string;
  city?: string;
  state?: string;
  country?: string;
  followersCount: number;
  followingCount: number;
  postsCount: number;
  createdAt: Date;
  updatedAt: Date;
}, opts?: { includeEmail?: boolean }) {
  const location =
    [u.city, u.state, u.country].filter(Boolean).join(", ") || undefined;
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

export async function getPublicProfile(viewerId: string | undefined, userId: string) {
  if (viewerId) {
    const blocked = await UserBlock.findOne({
      $or: [
        { blocker: viewerId, blocked: userId },
        { blocker: userId, blocked: viewerId },
      ],
    });
    if (blocked) {
      const err = new Error("User not found");
      (err as Error & { statusCode?: number }).statusCode = 404;
      throw err;
    }
  }
  const u = await User.findById(userId).lean();
  if (!u) {
    const err = new Error("User not found");
    (err as Error & { statusCode?: number }).statusCode = 404;
    throw err;
  }
  let isFollowing = false;
  let friendStatus: "none" | "pending_sent" | "pending_received" | "friends" = "none";
  if (viewerId) {
    const f = await UserFollow.findOne({ follower: viewerId, following: userId });
    isFollowing = !!f;
    friendStatus = await getFriendRequestStatus(viewerId, userId);
  }
  return {
    ...mapProfile(u as never, { includeEmail: false }),
    author: mapAuthor(u as never),
    isFollowing,
    friendStatus,
  };
}

export async function getBlockedUserIds(viewerId: string): Promise<Set<string>> {
  const blocked = await UserBlock.find({
    $or: [{ blocker: viewerId }, { blocked: viewerId }],
  }).lean();
  const hide = new Set<string>();
  for (const b of blocked) {
    if (b.blocker.toString() === viewerId) hide.add(b.blocked.toString());
    else hide.add(b.blocker.toString());
  }
  return hide;
}

export async function searchUsers(q: string, viewerId: string, limit = 30) {
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
    .map((u) => mapAuthor(u as never));
}

export async function toggleFollow(followerId: string, targetUserId: string) {
  if (followerId === targetUserId) {
    const err = new Error("Cannot follow yourself");
    (err as Error & { statusCode?: number }).statusCode = 400;
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
    (err as Error & { statusCode?: number }).statusCode = 403;
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

export async function followUser(followerId: string, targetUserId: string) {
  if (followerId === targetUserId) {
    const err = new Error("Cannot follow yourself");
    (err as Error & { statusCode?: number }).statusCode = 400;
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
    (err as Error & { statusCode?: number }).statusCode = 403;
    throw err;
  }
  const existing = await UserFollow.findOne({
    follower: followerId,
    following: targetUserId,
  });
  if (existing) return { following: true, message: "Already following" };
  await UserFollow.create({ follower: followerId, following: targetUserId });
  await User.findByIdAndUpdate(followerId, { $inc: { followingCount: 1 } });
  await User.findByIdAndUpdate(targetUserId, { $inc: { followersCount: 1 } });
  return { following: true, message: "Following" };
}

export async function unfollowUser(followerId: string, targetUserId: string) {
  const existing = await UserFollow.findOne({
    follower: followerId,
    following: targetUserId,
  });
  if (!existing) return { following: false, message: "Not following" };
  await existing.deleteOne();
  await User.findByIdAndUpdate(followerId, { $inc: { followingCount: -1 } });
  await User.findByIdAndUpdate(targetUserId, { $inc: { followersCount: -1 } });
  return { following: false, message: "Unfollowed" };
}

export async function listFollowers(
  profileUserId: string,
  viewerId: string | undefined
) {
  const hide = viewerId ? await getBlockedUserIds(viewerId) : new Set<string>();
  const rows = await UserFollow.find({ following: profileUserId })
    .populate("follower", "name avatar city state country")
    .lean();
  const users = rows
    .map((r) => mapAuthor(r.follower as never))
    .filter((u) => !hide.has(u.id));
  return users;
}

export async function listFollowing(
  profileUserId: string,
  viewerId: string | undefined
) {
  const hide = viewerId ? await getBlockedUserIds(viewerId) : new Set<string>();
  const rows = await UserFollow.find({ follower: profileUserId })
    .populate("following", "name avatar city state country")
    .lean();
  const users = rows
    .map((r) => mapAuthor(r.following as never))
    .filter((u) => !hide.has(u.id));
  return users;
}

export async function listBlocked(blockerId: string) {
  const rows = await UserBlock.find({ blocker: blockerId })
    .populate("blocked", "name avatar")
    .lean();
  return rows.map((r) => {
    const b = r.blocked as unknown as {
      _id: mongoose.Types.ObjectId;
      name: string;
      avatar?: string;
    };
    return {
      id: b._id.toString(),
      name: b.name,
      avatar: b.avatar ?? "",
    };
  });
}

export async function blockUser(blockerId: string, blockedId: string) {
  if (blockerId === blockedId) {
    const err = new Error("Invalid");
    (err as Error & { statusCode?: number }).statusCode = 400;
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
  await UserBlock.findOneAndUpdate(
    { blocker: blockerId, blocked: blockedId },
    {},
    { upsert: true }
  );
  await FriendRequest.deleteMany({
    $or: [
      { from: blockerId, to: blockedId },
      { from: blockedId, to: blockerId },
    ],
  });
}

export async function unblockUser(blockerId: string, blockedId: string) {
  await UserBlock.deleteOne({ blocker: blockerId, blocked: blockedId });
}
