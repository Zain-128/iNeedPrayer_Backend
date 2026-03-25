import { Notification } from "../models/notification.model.js";
import { timeAgo } from "../utils/timeAgo.js";

export async function listNotifications(userId: string, limit = 80) {
  const rows = await Notification.find({ user: userId })
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();
  return rows.map((n) => ({
    id: n._id.toString(),
    title: n.title,
    body: n.body,
    time: timeAgo(n.createdAt),
    read: n.read,
    kind: n.kind,
    refType: n.refType,
    refId: n.refId,
  }));
}

export async function markRead(userId: string, notificationId: string) {
  const n = await Notification.findOne({ _id: notificationId, user: userId });
  if (!n) {
    const err = new Error("Not found");
    (err as Error & { statusCode?: number }).statusCode = 404;
    throw err;
  }
  n.read = true;
  await n.save();
}

export async function markAllRead(userId: string) {
  await Notification.updateMany({ user: userId, read: false }, { read: true });
}
