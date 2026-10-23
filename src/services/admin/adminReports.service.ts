import mongoose from "mongoose";
import { Report } from "../../models/report.model.js";
import { Post } from "../../models/post.model.js";
import { Group } from "../../models/group.model.js";
import {
  escapeRegex,
  formatDisplayDate,
  httpError,
  listMeta,
  parsePageLimit,
} from "./admin.helpers.js";

const TYPE_LABEL: Record<string, string> = {
  post: "Post",
  comment: "Comment",
  group: "Group",
  user: "User",
  church: "Church",
  prayer: "Prayer Request",
  praise: "Praise",
  live: "Live Stream",
};

async function mapReport(r: {
  _id: { toString(): string };
  targetType: string;
  reasonKey: string;
  reason?: string;
  otherText?: string;
  status: string;
  createdAt: Date;
  reporter?: { name?: string; email?: string; avatar?: string };
  post?: { text?: string; author?: { name?: string; email?: string } };
  comment?: { text?: string; author?: { name?: string; email?: string } };
  group?: { name?: string };
  actionHistory?: Array<{
    _id: { toString(): string };
    action: string;
    performedBy?: { name?: string };
    note?: string;
    date: Date;
  }>;
}) {
  const itemTitle =
    (r.post as { text?: string })?.text?.slice(0, 80) ||
    (r.comment as { text?: string })?.text?.slice(0, 80) ||
    (r.group as { name?: string })?.name ||
    TYPE_LABEL[r.targetType] ||
    "Item";

  const owner =
    (r.post as { author?: { name?: string; email?: string } })?.author ||
    (r.comment as { author?: { name?: string; email?: string } })?.author ||
    {};

  return {
    id: r._id.toString(),
    reportId: `RPT-${r._id.toString().slice(-4).toUpperCase()}`,
    type: TYPE_LABEL[r.targetType] || r.targetType,
    itemTitle,
    reason: r.reasonKey || r.reason || "",
    description: r.otherText || "",
    reportedBy: r.reporter?.name || "",
    reportedByEmail: r.reporter?.email || "",
    ownerName: owner.name || "",
    ownerEmail: owner.email || "",
    avatar: r.reporter?.avatar || "",
    reportsCount: 1,
    status: r.status,
    createdAt: formatDisplayDate(r.createdAt),
    actionHistory: (r.actionHistory || []).map((a) => ({
      id: a._id.toString(),
      action: a.action,
      performedBy: (a.performedBy as { name?: string })?.name || "Admin",
      date: formatDisplayDate(a.date),
      note: a.note || "",
    })),
  };
}

export async function listReports(query: Record<string, unknown>) {
  const { page, limit, skip } = parsePageLimit(query);
  const filter: Record<string, unknown> = {};

  if (typeof query.status === "string" && query.status) {
    filter.status = query.status;
  }

  if (typeof query.type === "string" && query.type) {
    const entry = Object.entries(TYPE_LABEL).find(
      ([, label]) => label.toLowerCase() === query.type!.toString().toLowerCase()
    );
    if (entry) filter.targetType = entry[0];
  }

  if (typeof query.search === "string" && query.search.trim()) {
    const rx = new RegExp(escapeRegex(query.search.trim()), "i");
    filter.$or = [{ reasonKey: rx }, { otherText: rx }];
  }

  const [total, docs, statusRows] = await Promise.all([
    Report.countDocuments(filter),
    Report.find(filter)
      .populate("reporter", "name email avatar")
      .populate({
        path: "post",
        select: "text author",
        populate: { path: "author", select: "name email" },
      })
      .populate({
        path: "comment",
        select: "text author",
        populate: { path: "author", select: "name email" },
      })
      .populate("group", "name")
      .populate("actionHistory.performedBy", "name")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Report.aggregate([{ $group: { _id: "$status", count: { $sum: 1 } } }]),
  ]);

  const stats = { total: 0, pending: 0, resolved: 0, critical: 0 };
  for (const r of statusRows) {
    stats.total += r.count;
    if (r._id === "Pending" || r._id === "Under Review") stats.pending += r.count;
    if (r._id === "Resolved") stats.resolved = r.count;
  }

  const data = await Promise.all(docs.map((d) => mapReport(d as never)));
  stats.critical = data.filter((d) => d.reportsCount > 5).length;

  return {
    data,
    meta: listMeta(page, limit, total),
    stats,
  };
}

export async function getReport(id: string) {
  if (!mongoose.isValidObjectId(id)) throw httpError("Invalid id", 400);
  const r = await Report.findById(id)
    .populate("reporter", "name email avatar")
    .populate({
      path: "post",
      select: "text author",
      populate: { path: "author", select: "name email" },
    })
    .populate({
      path: "comment",
      select: "text author",
      populate: { path: "author", select: "name email" },
    })
    .populate("group", "name")
    .populate("actionHistory.performedBy", "name")
    .lean();
  if (!r) throw httpError("Report not found", 404);
  return mapReport(r as never);
}

async function addAction(
  reportId: string,
  adminId: string,
  action: string,
  note?: string,
  status?: "Pending" | "Under Review" | "Resolved" | "Dismissed"
) {
  const r = await Report.findById(reportId);
  if (!r) throw httpError("Report not found", 404);

  r.actionHistory.push({
    action,
    performedBy: new mongoose.Types.ObjectId(adminId),
    note: note || "",
    date: new Date(),
  } as never);

  if (status) {
    r.status = status;
    if (status === "Resolved" || status === "Dismissed") {
      r.resolvedBy = new mongoose.Types.ObjectId(adminId);
      r.resolvedAt = new Date();
    }
  }

  await r.save();
  return getReport(reportId);
}

export async function resolveReport(id: string, adminId: string, note?: string) {
  return addAction(id, adminId, "Resolved", note, "Resolved");
}

export async function dismissReport(id: string, adminId: string, note?: string) {
  return addAction(id, adminId, "Dismissed", note, "Dismissed");
}

export async function suspendReportedContent(
  id: string,
  adminId: string,
  note?: string
) {
  const r = await Report.findById(id);
  if (!r) throw httpError("Report not found", 404);

  if (r.post) {
    await Post.findByIdAndUpdate(r.post, { moderationStatus: "Hidden" });
  }
  if (r.group) {
    await Group.findByIdAndUpdate(r.group, { status: "Suspended" });
  }

  return addAction(
    id,
    adminId,
    "Suspended content",
    note,
    "Under Review"
  );
}
