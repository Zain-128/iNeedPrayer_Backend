import mongoose from "mongoose";
import { User } from "../../models/user.model.js";
import { Post } from "../../models/post.model.js";
import { GroupMember } from "../../models/groupMember.model.js";
import { ChurchFollow } from "../../models/churchFollow.model.js";
import {
  escapeRegex,
  formatDisplayDate,
  httpError,
  listMeta,
  parsePageLimit,
} from "./admin.helpers.js";

export async function listUsers(query: Record<string, unknown>) {
  const { page, limit, skip } = parsePageLimit(query);
  const filter: Record<string, unknown> = { role: { $ne: "admin" } };

  if (typeof query.status === "string" && query.status) {
    const s = query.status.toLowerCase();
    if (s === "active" || s === "inactive" || s === "blocked") {
      filter.status = s;
    }
  }

  if (typeof query.search === "string" && query.search.trim()) {
    const rx = new RegExp(escapeRegex(query.search.trim()), "i");
    filter.$or = [{ name: rx }, { email: rx }, { country: rx }];
  }

  const [total, users, stats] = await Promise.all([
    User.countDocuments(filter),
    User.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    User.aggregate([
      { $match: { role: { $ne: "admin" } } },
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
        },
      },
    ]),
  ]);

  const statusCounts = { active: 0, inactive: 0, blocked: 0, total: 0 };
  for (const row of stats) {
    statusCounts.total += row.count;
    if (row._id === "active") statusCounts.active = row.count;
    if (row._id === "inactive") statusCounts.inactive = row.count;
    if (row._id === "blocked") statusCounts.blocked = row.count;
  }

  const data = users.map((u) => ({
    id: u._id.toString(),
    name: u.name,
    email: u.email,
    plan: "Free" as const,
    status:
      u.status === "blocked"
        ? ("Blocked" as const)
        : u.status === "inactive"
          ? ("Inactive" as const)
          : ("Active" as const),
    avatar: u.avatar ?? "",
    joinedAt: formatDisplayDate(u.createdAt),
    country: u.country || "—",
    prayers: u.postsCount ?? 0,
  }));

  return {
    data,
    meta: listMeta(page, limit, total),
    stats: {
      totalUsers: statusCounts.total,
      activeUsers: statusCounts.active,
      premiumUsers: 0,
      blockedUsers: statusCounts.blocked,
    },
  };
}

export async function getUser(userId: string) {
  if (!mongoose.isValidObjectId(userId)) throw httpError("Invalid id", 400);
  const u = await User.findById(userId).lean();
  if (!u || u.role === "admin") throw httpError("User not found", 404);

  const [groupsJoined, churchesFollowed, recentPosts] = await Promise.all([
    GroupMember.countDocuments({ user: userId }),
    ChurchFollow.countDocuments({ user: userId }),
    Post.find({ author: userId })
      .sort({ createdAt: -1 })
      .limit(5)
      .select("text mode createdAt")
      .lean(),
  ]);

  return {
    id: u._id.toString(),
    name: u.name,
    email: u.email,
    avatar: u.avatar ?? "",
    coverImage: u.coverImage ?? "",
    bio: u.bio ?? "",
    phone: "",
    location: [u.city, u.state, u.country].filter(Boolean).join(", ") || "—",
    city: u.city ?? "",
    state: u.state ?? "",
    country: u.country ?? "",
    role: "User",
    plan: "Free",
    status:
      u.status === "blocked"
        ? "Blocked"
        : u.status === "inactive"
          ? "Inactive"
          : "Active",
    userId: u._id.toString(),
    loginType: u.socialLoginProvider ? String(u.socialLoginProvider) : "email",
    subscription: "Free",
    lastActive: formatDisplayDate(u.updatedAt),
    joinedDate: formatDisplayDate(u.createdAt),
    prayerStreak: 0,
    counts: {
      prayerRequests: u.postsCount ?? 0,
      prayersGiven: 0,
      groupsJoined,
      churchesFollowed,
      followers: u.followersCount ?? 0,
      following: u.followingCount ?? 0,
    },
    recentActivity: recentPosts.map((p) => ({
      id: p._id.toString(),
      type: p.mode === "praise" ? "Praise" : "Prayer Request",
      text: p.text?.slice(0, 100) ?? "",
      date: formatDisplayDate(p.createdAt),
    })),
  };
}

export async function updateUser(
  userId: string,
  body: {
    name?: string;
    email?: string;
    status?: string;
    country?: string;
    city?: string;
    bio?: string;
  }
) {
  const u = await User.findById(userId);
  if (!u || u.role === "admin") throw httpError("User not found", 404);

  if (body.name !== undefined) u.name = body.name.trim();
  if (body.email !== undefined) u.email = body.email.toLowerCase().trim();
  if (body.country !== undefined) u.country = body.country.trim();
  if (body.city !== undefined) u.city = body.city.trim();
  if (body.bio !== undefined) u.bio = body.bio.trim();
  if (body.status !== undefined) {
    const s = body.status.toLowerCase();
    if (s === "active" || s === "inactive" || s === "blocked") u.status = s;
  }
  await u.save();
  return getUser(userId);
}

export async function blockUser(
  userId: string,
  reason?: string
) {
  const u = await User.findById(userId);
  if (!u || u.role === "admin") throw httpError("User not found", 404);
  u.status = "blocked";
  u.blockedReason = reason?.trim() || "Policy Violation";
  u.blockedAt = new Date();
  await u.save();
  return { message: "User blocked", id: userId, status: "Blocked" };
}

export async function unblockUser(userId: string) {
  const u = await User.findById(userId);
  if (!u || u.role === "admin") throw httpError("User not found", 404);
  u.status = "active";
  u.blockedReason = "";
  u.blockedAt = null;
  await u.save();
  return { message: "User unblocked", id: userId, status: "Active" };
}

export async function deleteUser(userId: string) {
  const u = await User.findById(userId);
  if (!u || u.role === "admin") throw httpError("User not found", 404);
  await u.deleteOne();
  return { message: "User deleted", id: userId };
}

export async function searchUsers(q: string, limit = 20) {
  const rx = new RegExp(escapeRegex(q.trim()), "i");
  const users = await User.find({
    role: { $ne: "admin" },
    status: { $ne: "blocked" },
    $or: [{ name: rx }, { email: rx }],
  })
    .select("name email avatar")
    .limit(limit)
    .lean();

  return users.map((u) => ({
    id: u._id.toString(),
    name: u.name,
    email: u.email,
    avatar: u.avatar ?? "",
  }));
}

export async function listBlockedUsers(query: Record<string, unknown>) {
  const { page, limit, skip } = parsePageLimit(query);
  const filter: Record<string, unknown> = {
    role: { $ne: "admin" },
    status: "blocked",
  };
  if (typeof query.search === "string" && query.search.trim()) {
    const rx = new RegExp(escapeRegex(query.search.trim()), "i");
    filter.$or = [{ name: rx }, { email: rx }];
  }

  const [total, users] = await Promise.all([
    User.countDocuments(filter),
    User.find(filter).sort({ blockedAt: -1 }).skip(skip).limit(limit).lean(),
  ]);

  return {
    data: users.map((u) => ({
      id: u._id.toString(),
      name: u.name,
      email: u.email,
      avatar: u.avatar ?? "",
      reason: u.blockedReason || "Policy Violation",
      blockedBy: "Admin",
      reports: 0,
      blockedAt: formatDisplayDate(u.blockedAt ?? u.updatedAt),
      expiresAt: "Permanent",
      status: "Blocked" as const,
    })),
    meta: listMeta(page, limit, total),
  };
}
