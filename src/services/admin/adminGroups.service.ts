import mongoose from "mongoose";
import { Group } from "../../models/group.model.js";
import { Post } from "../../models/post.model.js";
import { User } from "../../models/user.model.js";
import {
  escapeRegex,
  formatDisplayDate,
  httpError,
  listMeta,
  parsePageLimit,
} from "./admin.helpers.js";

export async function listGroups(query: Record<string, unknown>) {
  const { page, limit, skip } = parsePageLimit(query);
  const filter: Record<string, unknown> = {};

  if (typeof query.status === "string" && query.status) filter.status = query.status;
  if (typeof query.privacy === "string" && query.privacy) filter.privacy = query.privacy;
  if (typeof query.search === "string" && query.search.trim()) {
    const rx = new RegExp(escapeRegex(query.search.trim()), "i");
    filter.$or = [{ name: rx }, { description: rx }, { category: rx }];
  }

  const [total, docs, statusRows] = await Promise.all([
    Group.countDocuments(filter),
    Group.find(filter)
      .populate("createdBy", "name email")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Group.aggregate([{ $group: { _id: "$status", count: { $sum: 1 } } }]),
  ]);

  const stats = { total: 0, active: 0, pending: 0, suspended: 0 };
  for (const r of statusRows) {
    stats.total += r.count;
    if (r._id === "Active") stats.active = r.count;
    if (r._id === "Pending") stats.pending = r.count;
    if (r._id === "Suspended") stats.suspended = r.count;
  }

  return {
    data: docs.map((g) => ({
      id: g._id.toString(),
      name: g.name,
      category: g.category || "Community",
      ownerName: (g.createdBy as { name?: string })?.name || "—",
      ownerEmail: (g.createdBy as { email?: string })?.email || "",
      privacy: (g.privacy as "Public" | "Private") || "Public",
      members: g.memberCount ?? 0,
      posts: g.postsCount ?? 0,
      reports: g.reportsCount ?? 0,
      status: (g.status as "Active" | "Pending" | "Suspended") || "Active",
      image: g.image || "",
      createdAt: formatDisplayDate(g.createdAt),
    })),
    meta: listMeta(page, limit, total),
    stats,
  };
}

export async function getGroup(id: string) {
  if (!mongoose.isValidObjectId(id)) throw httpError("Invalid id", 400);
  const g = await Group.findById(id).populate("createdBy", "name email").lean();
  if (!g) throw httpError("Group not found", 404);

  const recentPosts = await Post.find({ group: id })
    .sort({ createdAt: -1 })
    .limit(10)
    .populate("author", "name")
    .lean();

  return {
    id: g._id.toString(),
    name: g.name,
    description: g.description || "",
    category: g.category || "Community",
    ownerName: (g.createdBy as { name?: string })?.name || "—",
    ownerEmail: (g.createdBy as { email?: string })?.email || "",
    privacy: g.privacy || "Public",
    members: g.memberCount ?? 0,
    posts: g.postsCount ?? 0,
    reports: g.reportsCount ?? 0,
    status: g.status || "Active",
    image: g.image || "",
    requiresApproval: !!g.requiresApproval,
    createdAt: formatDisplayDate(g.createdAt),
    recentPosts: recentPosts.map((p) => ({
      id: p._id.toString(),
      title: p.text?.slice(0, 60) || "Post",
      author: (p.author as { name?: string })?.name || "",
      date: formatDisplayDate(p.createdAt),
      comments: p.commentsCount ?? 0,
    })),
  };
}

export async function createGroup(body: Record<string, unknown>, adminId: string) {
  const name = String(body.name ?? "").trim();
  if (!name) throw httpError("name is required", 400);

  let createdBy = adminId;
  if (typeof body.leaderEmail === "string" && body.leaderEmail.trim()) {
    const leader = await User.findOne({
      email: body.leaderEmail.trim().toLowerCase(),
    });
    if (leader) createdBy = leader._id.toString();
  }

  const g = await Group.create({
    name,
    description: String(body.description ?? "").trim(),
    category: String(body.category ?? "Community").trim(),
    privacy: body.privacy === "Private" ? "Private" : "Public",
    status:
      body.status === "Pending" || body.status === "Suspended"
        ? body.status
        : "Active",
    image: String(body.coverImage ?? body.image ?? "").trim(),
    requiresApproval: !!body.requiresApproval,
    memberCount: 1,
    createdBy,
  });

  return getGroup(g._id.toString());
}

export async function updateGroup(id: string, body: Record<string, unknown>) {
  const g = await Group.findById(id);
  if (!g) throw httpError("Group not found", 404);

  if (body.name !== undefined) g.name = String(body.name).trim();
  if (body.description !== undefined) g.description = String(body.description).trim();
  if (body.category !== undefined) g.category = String(body.category).trim();
  if (body.privacy === "Public" || body.privacy === "Private") g.privacy = body.privacy;
  if (
    body.status === "Active" ||
    body.status === "Pending" ||
    body.status === "Suspended"
  ) {
    g.status = body.status;
  }
  if (body.coverImage !== undefined || body.image !== undefined) {
    g.image = String(body.coverImage ?? body.image).trim();
  }
  if (body.requiresApproval !== undefined) {
    g.requiresApproval = !!body.requiresApproval;
  }

  await g.save();
  return getGroup(id);
}

export async function setGroupStatus(
  id: string,
  status: "Active" | "Pending" | "Suspended"
) {
  const g = await Group.findById(id);
  if (!g) throw httpError("Group not found", 404);
  g.status = status;
  await g.save();
  return { id, status, message: `Group ${status.toLowerCase()}` };
}

export async function deleteGroup(id: string) {
  const g = await Group.findById(id);
  if (!g) throw httpError("Group not found", 404);
  await g.deleteOne();
  return { message: "Group deleted", id };
}
