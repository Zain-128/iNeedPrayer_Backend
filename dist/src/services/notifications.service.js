import mongoose from "mongoose";
import { Notification } from "../models/notification.model.js";
import { NotificationSettings } from "../models/notificationSettings.model.js";
import { timeAgo } from "../utils/timeAgo.js";
function httpError(message, statusCode) {
    const err = new Error(message);
    err.statusCode = statusCode;
    return err;
}
function mapNotification(n) {
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
export async function listNotifications(userId, opts = {}) {
    const limit = Math.min(50, Math.max(1, opts.limit ?? 20));
    const filter = { user: userId };
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
export async function getUnreadCount(userId) {
    const unreadCount = await Notification.countDocuments({
        user: userId,
        read: false,
    });
    return { unreadCount };
}
export async function markRead(userId, notificationId) {
    const n = await Notification.findOne({ _id: notificationId, user: userId });
    if (!n)
        throw httpError("Not found", 404);
    n.read = true;
    await n.save();
}
export async function markUnread(userId, notificationId) {
    const n = await Notification.findOne({ _id: notificationId, user: userId });
    if (!n)
        throw httpError("Not found", 404);
    n.read = false;
    await n.save();
}
export async function markAllRead(userId) {
    await Notification.updateMany({ user: userId, read: false }, { read: true });
}
export async function deleteNotification(userId, notificationId) {
    const result = await Notification.deleteOne({
        _id: notificationId,
        user: userId,
    });
    if (!result.deletedCount)
        throw httpError("Not found", 404);
}
export async function clearAllNotifications(userId) {
    const result = await Notification.deleteMany({ user: userId });
    return { deleted: result.deletedCount };
}
function mapSettings(doc) {
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
export async function getNotificationSettings(userId) {
    const doc = await NotificationSettings.findOne({ user: userId }).lean();
    return mapSettings(doc ?? DEFAULT_SETTINGS);
}
export async function updateNotificationSettings(userId, body) {
    const update = {};
    const fields = [
        "pushEnabled",
        "emailEnabled",
        "friendRequests",
        "messages",
        "groupActivity",
        "postActivity",
        "prayersAndPraises",
    ];
    for (const field of fields) {
        if (typeof body[field] === "boolean") {
            update[field] = body[field];
        }
    }
    const doc = await NotificationSettings.findOneAndUpdate({ user: userId }, { $set: update }, { upsert: true, new: true, setDefaultsOnInsert: true }).lean();
    return mapSettings(doc);
}
export async function muteNotifications(userId, body) {
    let mutedUntil = null;
    if (body.muted === false) {
        mutedUntil = null;
    }
    else {
        const minutes = body.durationMinutes ??
            (body.durationHours != null ? body.durationHours * 60 : 60);
        mutedUntil = new Date(Date.now() + Math.max(1, minutes) * 60 * 1000);
    }
    const doc = await NotificationSettings.findOneAndUpdate({ user: userId }, { $set: { mutedUntil } }, { upsert: true, new: true, setDefaultsOnInsert: true }).lean();
    return mapSettings(doc);
}
