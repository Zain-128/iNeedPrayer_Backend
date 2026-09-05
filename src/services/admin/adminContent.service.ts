import mongoose from "mongoose";
import { Post } from "../../models/post.model.js";
import { Comment } from "../../models/comment.model.js";
import { Report } from "../../models/report.model.js";
import { LiveStreamSession } from "../../models/liveStreamSession.model.js";
import {
  escapeRegex,
  formatDisplayDate,
  httpError,
  listMeta,
  parsePageLimit,
} from "./admin.helpers.js";

function contentTypeLabel(mode: string) {
  if (mode === "praise") return "Praise";
  return "Prayer Request";
}

export async function listContent(query: Record<string, unknown>) {
  const { page, limit, skip } = parsePageLimit(query);
  const filter: Record<string, unknown> = {};

  if (query.type === "Praise") filter.mode = "praise";
  else if (query.type === "Prayer Request" || query.type === "Post") {
    filter.mode = "prayer";
  }

  if (typeof query.status === "string" && query.status) {
    filter.moderationStatus = query.status;
  }

  if (typeof query.search === "string" && query.search.trim()) {
    const rx = new RegExp(escapeRegex(query.search.trim()), "i");
    filter.text = rx;
  }

  const [total, docs, statusRows] = await Promise.all([
    Post.countDocuments(filter),
    Post.find(filter)
      .populate("author", "name email avatar")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Post.aggregate([
      { $group: { _id: "$moderationStatus", count: { $sum: 1 } } },
    ]),
  ]);

  const stats = { total: 0, published: 0, reported: 0, hidden: 0 };
  for (const r of statusRows) {
    stats.total += r.count;
    if (r._id === "Published") stats.published = r.count;
    if (r._id === "Reported") stats.reported = r.count;
    if (r._id === "Hidden") stats.hidden = r.count;
  }

  const ids = docs.map((d) => d._id);
  const reportCounts = await Report.aggregate([
    { $match: { post: { $in: ids } } },
    { $group: { _id: "$post", count: { $sum: 1 } } },
  ]);
  const reportMap = new Map(reportCounts.map((r) => [String(r._id), r.count]));

  return {
    data: docs.map((p) => ({
      id: p._id.toString(),
      authorName: (p.author as { name?: string })?.name || "",
      authorEmail: (p.author as { email?: string })?.email || "",
      avatar: (p.author as { avatar?: string })?.avatar || "",
      type: contentTypeLabel(p.mode),
      content: p.text || "",
      comments: p.commentsCount ?? 0,
      praises: p.praisesCount ?? 0,
      prays: p.praysCount ?? 0,
      reports: reportMap.get(p._id.toString()) ?? 0,
      status: (p.moderationStatus as string) || "Published",
      createdAt: formatDisplayDate(p.createdAt),
    })),
    meta: listMeta(page, limit, total),
    stats,
  };
}

export async function getContent(id: string) {
  if (!mongoose.isValidObjectId(id)) throw httpError("Invalid id", 400);
  const p = await Post.findById(id)
    .populate("author", "name email avatar")
    .lean();
  if (!p) throw httpError("Content not found", 404);

  const comments = await Comment.find({ post: id, parentComment: null })
    .populate("author", "name email avatar")
    .sort({ createdAt: -1 })
    .limit(50)
    .lean();

  const reports = await Report.countDocuments({ post: id });

  return {
    id: p._id.toString(),
    authorName: (p.author as { name?: string })?.name || "",
    authorEmail: (p.author as { email?: string })?.email || "",
    avatar: (p.author as { avatar?: string })?.avatar || "",
    type: contentTypeLabel(p.mode),
    content: p.text || "",
    image: p.image || "",
    comments: p.commentsCount ?? 0,
    praises: p.praisesCount ?? 0,
    prays: p.praysCount ?? 0,
    reports,
    status: p.moderationStatus || "Published",
    createdAt: formatDisplayDate(p.createdAt),
    commentsList: comments.map((c) => ({
      id: c._id.toString(),
      userName: (c.author as { name?: string })?.name || "",
      userEmail: (c.author as { email?: string })?.email || "",
      avatar: (c.author as { avatar?: string })?.avatar || "",
      content: c.text,
      createdAt: formatDisplayDate(c.createdAt),
    })),
  };
}

export async function updateContentStatus(
  id: string,
  status: "Published" | "Reported" | "Hidden"
) {
  const p = await Post.findById(id);
  if (!p) throw httpError("Content not found", 404);
  p.moderationStatus = status;
  await p.save();
  return { id, status, message: "Content updated" };
}

export async function deleteContent(id: string) {
  const p = await Post.findById(id);
  if (!p) throw httpError("Content not found", 404);
  await Comment.deleteMany({ post: id });
  await p.deleteOne();
  return { message: "Content deleted", id };
}

export async function listPrayerRequests(query: Record<string, unknown>) {
  return listContent({ ...query, type: "Prayer Request" });
}

export async function listPraises(query: Record<string, unknown>) {
  return listContent({ ...query, type: "Praise" });
}

export async function listLiveStreams(query: Record<string, unknown>) {
  const { page, limit, skip } = parsePageLimit(query);
  const filter: Record<string, unknown> = {};

  if (query.status === "Live") filter.status = "live";
  else if (query.status === "Ended") filter.status = "ended";

  if (typeof query.search === "string" && query.search.trim()) {
    const rx = new RegExp(escapeRegex(query.search.trim()), "i");
    filter.title = rx;
  }

  const [total, docs] = await Promise.all([
    LiveStreamSession.countDocuments(filter),
    LiveStreamSession.find(filter)
      .populate("hostUserId", "name email avatar")
      .populate("churchId", "name")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
  ]);

  return {
    data: docs.map((s) => {
      const durationMs = s.endedAt
        ? new Date(s.endedAt).getTime() - new Date(s.startedAt).getTime()
        : Date.now() - new Date(s.startedAt).getTime();
      const mins = Math.max(0, Math.floor(durationMs / 60000));
      return {
        id: s._id.toString(),
        title: s.title,
        hostName: (s.hostUserId as { name?: string })?.name || "",
        hostEmail: (s.hostUserId as { email?: string })?.email || "",
        avatar: (s.hostUserId as { avatar?: string })?.avatar || "",
        type: "Video" as const,
        churchName: (s.churchId as { name?: string })?.name || "—",
        viewers: s.viewerCount ?? 0,
        duration: `${mins} min`,
        reports: 0,
        status: s.status === "live" ? "Live" : "Ended",
        scheduledAt: formatDisplayDate(s.startedAt),
      };
    }),
    meta: listMeta(page, limit, total),
  };
}

export async function getLiveStream(id: string) {
  if (!mongoose.isValidObjectId(id)) throw httpError("Invalid id", 400);
  const s = await LiveStreamSession.findById(id)
    .populate("hostUserId", "name email avatar")
    .populate("churchId", "name")
    .lean();
  if (!s) throw httpError("Live stream not found", 404);

  return {
    id: s._id.toString(),
    title: s.title,
    hostName: (s.hostUserId as { name?: string })?.name || "",
    hostEmail: (s.hostUserId as { email?: string })?.email || "",
    avatar: (s.hostUserId as { avatar?: string })?.avatar || "",
    type: "Video",
    churchName: (s.churchId as { name?: string })?.name || "—",
    viewers: s.viewerCount ?? 0,
    status: s.status === "live" ? "Live" : "Ended",
    scheduledAt: formatDisplayDate(s.startedAt),
    participants: [],
  };
}

export async function endLiveStream(id: string, adminId: string) {
  const s = await LiveStreamSession.findById(id);
  if (!s) throw httpError("Live stream not found", 404);
  if (s.status === "ended") return { id, status: "Ended", message: "Already ended" };
  s.status = "ended";
  s.endedAt = new Date();
  s.endedBy = new mongoose.Types.ObjectId(adminId);
  await s.save();
  return { id, status: "Ended", message: "Live stream ended" };
}
