import mongoose from "mongoose";
import { Notification } from "../../models/notification.model.js";
import { AdminBroadcast } from "../../models/adminBroadcast.model.js";
import { AdminActivity } from "../../models/adminActivity.model.js";
import { User } from "../../models/user.model.js";
import {
  escapeRegex,
  formatDisplayDate,
  httpError,
  listMeta,
  parsePageLimit,
} from "./admin.helpers.js";

// ── Broadcast notifications (admin-sent only) ─────────

export async function listAdminNotifications(query: Record<string, unknown>) {
  const { page, limit, skip } = parsePageLimit(query);
  const filter: Record<string, unknown> = {};

  if (typeof query.search === "string" && query.search.trim()) {
    const rx = new RegExp(escapeRegex(query.search.trim()), "i");
    filter.$or = [{ title: rx }, { message: rx }];
  }

  const [total, docs] = await Promise.all([
    AdminBroadcast.countDocuments(filter),
    AdminBroadcast.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
  ]);

  const ids = docs.map((d) => d._id.toString());
  const openedAgg = ids.length
    ? await Notification.aggregate([
        {
          $match: {
            refType: "admin",
            refId: { $in: ids },
            read: true,
          },
        },
        { $group: { _id: "$refId", opened: { $sum: 1 } } },
      ])
    : [];
  const openedMap = new Map(
    openedAgg.map((r) => [String(r._id), r.opened as number])
  );

  return {
    data: docs.map((n) => ({
      id: n._id.toString(),
      title: n.title,
      message: n.message,
      type: n.type || "In-App",
      audience: n.audience || "All Users",
      sentBy: n.sentByName || "Admin",
      avatar: "",
      recipients: n.recipients ?? 0,
      opened: openedMap.get(n._id.toString()) ?? 0,
      status: n.status || "Sent",
      createdAt: formatDisplayDate(n.createdAt),
      kind: n.kind,
      refType: "admin",
      refId: n._id.toString(),
    })),
    meta: listMeta(page, limit, total),
  };
}

export async function broadcastNotification(
  body: {
    title?: string;
    message?: string;
    audience?: string;
    kind?: string;
  },
  adminUserId?: string
) {
  const title = body.title?.trim();
  const message = body.message?.trim() ?? "";
  if (!title) throw httpError("title is required", 400);

  const audience = body.audience || "All Users";
  const kind = body.kind || "announcement";

  let userFilter: Record<string, unknown> = {
    role: { $ne: "admin" },
    status: { $ne: "blocked" },
  };

  // Reserved audience filters for later expansion
  if (audience === "Church Owners") {
    // keep all eligible users for now; ownership filter TBD with billing/roles
  }

  const users = await User.find(userFilter).select("_id").lean();

  let sentByName = "Admin";
  if (adminUserId && mongoose.isValidObjectId(adminUserId)) {
    const admin = await User.findById(adminUserId).select("name").lean();
    sentByName = admin?.name ?? "Admin";
  }

  const broadcast = await AdminBroadcast.create({
    title,
    message,
    audience,
    kind,
    type: "In-App",
    sentBy:
      adminUserId && mongoose.isValidObjectId(adminUserId)
        ? adminUserId
        : null,
    sentByName,
    recipients: users.length,
    status: users.length ? "Sent" : "Failed",
  });

  if (!users.length) {
    return {
      id: broadcast._id.toString(),
      sent: 0,
      message: "No recipients",
      audience,
    };
  }

  const docs = users.map((u) => ({
    user: u._id,
    title,
    body: message,
    kind,
    refType: "admin",
    refId: broadcast._id.toString(),
    read: false,
  }));

  await Notification.insertMany(docs);

  return {
    id: broadcast._id.toString(),
    sent: docs.length,
    message: "Notification sent",
    audience,
  };
}

export async function deleteAdminNotification(id: string) {
  if (!mongoose.isValidObjectId(id)) throw httpError("Invalid id", 400);

  // Prefer AdminBroadcast id (new shape)
  const broadcast = await AdminBroadcast.findById(id);
  if (broadcast) {
    await Promise.all([
      Notification.deleteMany({ refType: "admin", refId: id }),
      broadcast.deleteOne(),
    ]);
    return { message: "Deleted", id };
  }

  // Legacy: delete a single per-user notification row that was admin-sent
  const legacy = await Notification.findById(id);
  if (!legacy || legacy.refType !== "admin") {
    throw httpError("Notification not found", 404);
  }
  await legacy.deleteOne();
  return { message: "Deleted", id };
}

// ── Top-bar activity notifications ────────────────────

export async function listActivityNotifications(
  query: Record<string, unknown>,
  adminUserId: string
) {
  const { page, limit, skip } = parsePageLimit(query);
  const filter: Record<string, unknown> = {};

  if (query.unreadOnly === "true" || query.unreadOnly === true) {
    filter.readBy = { $ne: new mongoose.Types.ObjectId(adminUserId) };
  }

  if (typeof query.type === "string" && query.type.trim()) {
    filter.type = query.type.trim();
  }

  if (typeof query.search === "string" && query.search.trim()) {
    const rx = new RegExp(escapeRegex(query.search.trim()), "i");
    filter.$or = [{ title: rx }, { message: rx }, { actorName: rx }];
  }

  const adminOid = new mongoose.Types.ObjectId(adminUserId);

  const [total, docs, unreadCount] = await Promise.all([
    AdminActivity.countDocuments(filter),
    AdminActivity.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    AdminActivity.countDocuments({
      readBy: { $ne: adminOid },
    }),
  ]);

  return {
    data: docs.map((a) => ({
      id: a._id.toString(),
      type: a.type,
      title: a.title,
      message: a.message,
      refType: a.refType,
      refId: a.refId,
      actorId: a.actorId?.toString() ?? null,
      actorName: a.actorName || "",
      actorAvatar: a.actorAvatar || "",
      meta: a.meta ?? {},
      read: (a.readBy ?? []).some(
        (id) => id.toString() === adminUserId
      ),
      createdAt: a.createdAt,
      time: formatDisplayDate(a.createdAt),
    })),
    meta: listMeta(page, limit, total),
    unreadCount,
  };
}

export async function markActivityRead(id: string, adminUserId: string) {
  if (!mongoose.isValidObjectId(id)) throw httpError("Invalid id", 400);
  const result = await AdminActivity.updateOne(
    { _id: id },
    { $addToSet: { readBy: adminUserId } }
  );
  if (!result.matchedCount) throw httpError("Activity not found", 404);
  return { message: "Marked as read", id };
}

export async function markAllActivitiesRead(adminUserId: string) {
  await AdminActivity.updateMany(
    { readBy: { $ne: new mongoose.Types.ObjectId(adminUserId) } },
    { $addToSet: { readBy: adminUserId } }
  );
  return { message: "All marked as read" };
}
