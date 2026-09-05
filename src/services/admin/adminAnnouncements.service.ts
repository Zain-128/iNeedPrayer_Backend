import mongoose from "mongoose";
import { Announcement } from "../../models/announcement.model.js";
import type {
  AnnouncementAudience,
  AnnouncementPriority,
  AnnouncementStatus,
} from "../../models/announcement.model.js";
import { Notification } from "../../models/notification.model.js";
import { User } from "../../models/user.model.js";
import {
  escapeRegex,
  formatDisplayDate,
  httpError,
  listMeta,
  parsePageLimit,
} from "./admin.helpers.js";

function mapAnnouncement(a: {
  _id: { toString(): string };
  title: string;
  content?: string;
  summary?: string;
  priority?: string;
  audience?: string;
  status?: string;
  createdByName?: string;
  createdByEmail?: string;
  avatar?: string;
  views?: number;
  likes?: number;
  comments?: number;
  scheduledAt?: Date | null;
  publishedAt?: Date | null;
  createdAt?: Date;
  updatedAt?: Date;
}) {
  return {
    id: a._id.toString(),
    title: a.title,
    content: a.content ?? "",
    summary: a.summary ?? "",
    priority: a.priority ?? "Medium",
    audience: a.audience ?? "All Users",
    status: a.status ?? "Draft",
    createdBy: a.createdByName ?? "Admin",
    createdByEmail: a.createdByEmail ?? "",
    avatar: a.avatar ?? "",
    views: a.views ?? 0,
    likes: a.likes ?? 0,
    comments: a.comments ?? 0,
    scheduledAt: a.scheduledAt?.toISOString() ?? "",
    publishedAt: a.publishedAt?.toISOString() ?? "",
    createdAt: formatDisplayDate(a.createdAt),
    updatedAt: formatDisplayDate(a.updatedAt),
  };
}

async function audienceUserFilter(audience?: string) {
  const filter: Record<string, unknown> = {
    role: { $ne: "admin" },
    status: { $ne: "blocked" },
  };
  // Reserved for future audience segmentation
  if (audience === "Church Owners" || audience === "Church Members") {
    return filter;
  }
  return filter;
}

export async function listAnnouncements(query: Record<string, unknown>) {
  const { page, limit, skip } = parsePageLimit(query);
  const filter: Record<string, unknown> = {};

  if (typeof query.status === "string" && query.status !== "All") {
    filter.status = query.status;
  }
  if (typeof query.priority === "string" && query.priority !== "All") {
    filter.priority = query.priority;
  }
  if (typeof query.search === "string" && query.search.trim()) {
    const rx = new RegExp(escapeRegex(query.search.trim()), "i");
    filter.$or = [{ title: rx }, { summary: rx }, { content: rx }];
  }

  const [total, docs, statusAgg] = await Promise.all([
    Announcement.countDocuments(filter),
    Announcement.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    Announcement.aggregate([{ $group: { _id: "$status", count: { $sum: 1 } } }]),
  ]);

  const stats = {
    total,
    published: 0,
    draft: 0,
    scheduled: 0,
    archived: 0,
  };
  for (const row of statusAgg) {
    if (row._id === "Published") stats.published = row.count;
    if (row._id === "Draft") stats.draft = row.count;
    if (row._id === "Scheduled") stats.scheduled = row.count;
    if (row._id === "Archived") stats.archived = row.count;
  }

  return {
    data: docs.map((a) => mapAnnouncement(a)),
    meta: listMeta(page, limit, total),
    stats,
  };
}

export async function getAnnouncement(id: string) {
  if (!mongoose.isValidObjectId(id)) throw httpError("Invalid id", 400);
  const a = await Announcement.findById(id).lean();
  if (!a) throw httpError("Announcement not found", 404);
  return mapAnnouncement(a);
}

export async function createAnnouncement(
  body: Record<string, unknown>,
  adminUserId?: string
) {
  const title = String(body.title ?? "").trim();
  if (!title) throw httpError("title is required", 400);

  let createdByName = "Admin";
  let createdByEmail = "";
  let avatar = "";
  if (adminUserId && mongoose.isValidObjectId(adminUserId)) {
    const admin = await User.findById(adminUserId)
      .select("name email avatar")
      .lean();
    createdByName = admin?.name ?? createdByName;
    createdByEmail = admin?.email ?? "";
    avatar = admin?.avatar ?? "";
  }

  const status: AnnouncementStatus = body.scheduledAt
    ? "Scheduled"
    : ((body.status as AnnouncementStatus) ?? "Draft");
  const announcement = await Announcement.create({
    title,
    content: String(body.content ?? "").trim(),
    summary: String(body.summary ?? "").trim(),
    priority: (body.priority as AnnouncementPriority) ?? "Medium",
    audience: (body.audience as AnnouncementAudience) ?? "All Users",
    status,
    createdBy: adminUserId && mongoose.isValidObjectId(adminUserId) ? adminUserId : null,
    createdByName: String(body.createdBy ?? createdByName),
    createdByEmail: String(body.createdByEmail ?? createdByEmail),
    avatar: String(body.avatar ?? avatar),
    scheduledAt: body.scheduledAt ? new Date(String(body.scheduledAt)) : null,
    publishedAt: status === "Published" ? new Date() : null,
  });

  return mapAnnouncement(announcement);
}

export async function updateAnnouncement(
  id: string,
  body: Record<string, unknown>
) {
  if (!mongoose.isValidObjectId(id)) throw httpError("Invalid id", 400);
  const a = await Announcement.findById(id);
  if (!a) throw httpError("Announcement not found", 404);

  if (body.title !== undefined) a.title = String(body.title).trim();
  if (body.content !== undefined) a.content = String(body.content).trim();
  if (body.summary !== undefined) a.summary = String(body.summary).trim();
  if (body.priority !== undefined) {
    a.priority = body.priority as AnnouncementPriority;
  }
  if (body.audience !== undefined) {
    a.audience = body.audience as AnnouncementAudience;
  }
  if (body.status !== undefined) a.status = body.status as AnnouncementStatus;
  if (body.scheduledAt !== undefined) {
    a.scheduledAt = body.scheduledAt ? new Date(String(body.scheduledAt)) : null;
  }

  await a.save();
  return mapAnnouncement(a);
}

export async function deleteAnnouncement(id: string) {
  if (!mongoose.isValidObjectId(id)) throw httpError("Invalid id", 400);
  const result = await Announcement.deleteOne({ _id: id });
  if (!result.deletedCount) throw httpError("Announcement not found", 404);
  return { message: "Deleted", id };
}

export async function publishAnnouncement(id: string) {
  if (!mongoose.isValidObjectId(id)) throw httpError("Invalid id", 400);
  const a = await Announcement.findById(id);
  if (!a) throw httpError("Announcement not found", 404);
  if (a.status === "Published") {
    throw httpError("Announcement is already published", 409);
  }

  a.status = "Published";
  a.publishedAt = new Date();

  const users = await User.find(await audienceUserFilter(a.audience))
    .select("_id")
    .lean();

  if (users.length) {
    await Notification.insertMany(
      users.map((u) => ({
        user: u._id,
        title: a.title,
        body: a.summary || a.content,
        kind: "announcement",
        refType: "announcement",
        refId: a._id.toString(),
        read: false,
      }))
    );
  }

  await a.save();
  return {
    ...mapAnnouncement(a),
    notificationsSent: users.length,
  };
}

export async function archiveAnnouncement(id: string) {
  if (!mongoose.isValidObjectId(id)) throw httpError("Invalid id", 400);
  const a = await Announcement.findById(id);
  if (!a) throw httpError("Announcement not found", 404);
  a.status = "Archived";
  await a.save();
  return mapAnnouncement(a);
}
