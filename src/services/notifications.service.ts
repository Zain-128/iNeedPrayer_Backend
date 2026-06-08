import mongoose from "mongoose";
import { Notification } from "../models/notification.model.js";
import { NotificationSettings } from "../models/notificationSettings.model.js";
import { timeAgo } from "../utils/timeAgo.js";

function httpError(message: string, statusCode: number) {
  const err = new Error(message);
  (err as Error & { statusCode?: number }).statusCode = statusCode;
  return err;
}

function mapNotification(n: {
  _id: { toString(): string };
  title: string;
  body: string;
  createdAt: Date;
  read: boolean;
  kind: string;
  refType: string;
  refId: string;
}) {
  return {
    id: n._id.toString(),
    title: n.title,
    body: n.body,
    time: timeAgo(n.createdAt),
    createdAt: n.createdAt,
    read: n.read,
    kind: n.kind,
    refType: n.refType,
    refId: n.refId,
  };
}

export async function listNotifications(
  userId: string,
  opts: { cursor?: string; limit?: number } = {}
) {
  const limit = Math.min(50, Math.max(1, opts.limit ?? 20));
  const filter: Record<string, unknown> = { user: userId };

  if (opts.cursor) {
    if (!mongoose.isValidObjectId(opts.cursor)) {
      throw httpError("Invalid cursor", 400);
    }
    const cursorDoc = await Notification.findOne({
      _id: opts.cursor,
      user: userId,
    }).lean();
    if (cursorDoc) {
      filter.$or = [
        { createdAt: { $lt: cursorDoc.createdAt } },
        { createdAt: cursorDoc.createdAt, _id: { $lt: cursorDoc._id } },
      ];
    }
  }

  const rows = await Notification.find(filter)
    .sort({ createdAt: -1, _id: -1 })
    .limit(limit + 1)
    .lean();

  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;
  const notifications = page.map(mapNotification);
  const nextCursor = hasMore
    ? page[page.length - 1]._id.toString()
    : null;

  return { notifications, nextCursor, hasMore };
}

export async function getUnreadCount(userId: string) {
  const unreadCount = await Notification.countDocuments({
    user: userId,
    read: false,
  });
  return { unreadCount };
}

export async function markRead(userId: string, notificationId: string) {
  const n = await Notification.findOne({ _id: notificationId, user: userId });
  if (!n) throw httpError("Not found", 404);
  n.read = true;
  await n.save();
}

export async function markUnread(userId: string, notificationId: string) {
  const n = await Notification.findOne({ _id: notificationId, user: userId });
  if (!n) throw httpError("Not found", 404);
  n.read = false;
  await n.save();
}

export async function markAllRead(userId: string) {
  await Notification.updateMany({ user: userId, read: false }, { read: true });
}

export async function deleteNotification(userId: string, notificationId: string) {
  const result = await Notification.deleteOne({
    _id: notificationId,
    user: userId,
  });
  if (!result.deletedCount) throw httpError("Not found", 404);
}

export async function clearAllNotifications(userId: string) {
  const result = await Notification.deleteMany({ user: userId });
  return { deleted: result.deletedCount };
}

function mapSettings(doc: {
  pushEnabled: boolean;
  emailEnabled: boolean;
  friendRequests: boolean;
  messages: boolean;
  groupActivity: boolean;
  postActivity: boolean;
  prayersAndPraises: boolean;
  mutedUntil?: Date | null;
}) {
  const mutedUntil = doc.mutedUntil ?? null;
  const muted = !!(mutedUntil && mutedUntil > new Date());
  return {
    pushEnabled: doc.pushEnabled,
    emailEnabled: doc.emailEnabled,
    friendRequests: doc.friendRequests,
    messages: doc.messages,
    groupActivity: doc.groupActivity,
    postActivity: doc.postActivity,
    prayersAndPraises: doc.prayersAndPraises,
    muted,
    mutedUntil,
  };
}

const DEFAULT_SETTINGS = {
  pushEnabled: true,
  emailEnabled: true,
  friendRequests: true,
  messages: true,
  groupActivity: true,
  postActivity: true,
  prayersAndPraises: true,
  mutedUntil: null,
};

export async function getNotificationSettings(userId: string) {
  const doc = await NotificationSettings.findOne({ user: userId }).lean();
  return mapSettings(doc ?? DEFAULT_SETTINGS);
}

export async function updateNotificationSettings(
  userId: string,
  body: Partial<{
    pushEnabled: boolean;
    emailEnabled: boolean;
    friendRequests: boolean;
    messages: boolean;
    groupActivity: boolean;
    postActivity: boolean;
    prayersAndPraises: boolean;
  }>
) {
  const update: Record<string, boolean> = {};
  const fields = [
    "pushEnabled",
    "emailEnabled",
    "friendRequests",
    "messages",
    "groupActivity",
    "postActivity",
    "prayersAndPraises",
  ] as const;

  for (const field of fields) {
    if (typeof body[field] === "boolean") {
      update[field] = body[field]!;
    }
  }

  const doc = await NotificationSettings.findOneAndUpdate(
    { user: userId },
    { $set: update },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  ).lean();

  return mapSettings(doc!);
}

export async function muteNotifications(
  userId: string,
  body: { muted?: boolean; durationMinutes?: number; durationHours?: number }
) {
  let mutedUntil: Date | null = null;

  if (body.muted === false) {
    mutedUntil = null;
  } else {
    const minutes =
      body.durationMinutes ??
      (body.durationHours != null ? body.durationHours * 60 : 60);
    mutedUntil = new Date(Date.now() + Math.max(1, minutes) * 60 * 1000);
  }

  const doc = await NotificationSettings.findOneAndUpdate(
    { user: userId },
    { $set: { mutedUntil } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  ).lean();

  return mapSettings(doc!);
}
