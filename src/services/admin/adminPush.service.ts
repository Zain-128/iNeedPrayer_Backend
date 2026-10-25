import { PushNotification } from "../../models/pushNotification.model.js";
import {
  parsePageLimit,
  listMeta,
  escapeRegex,
  httpError,
  formatDisplayDate,
} from "./admin.helpers.js";

function mapPush(p: {
  _id: { toString(): string };
  title: string;
  message?: string;
  audience?: string;
  status?: string;
  recipients?: number;
  opened?: number;
  clicked?: number;
  deepLink?: string;
  scheduledAt?: Date | null;
  sentAt?: Date | null;
  sentByName?: string;
  createdAt?: Date;
  updatedAt?: Date;
}) {
  return {
    id: p._id.toString(),
    title: p.title,
    message: p.message ?? "",
    audience: p.audience ?? "All Users",
    status: p.status ?? "Draft",
    recipients: p.recipients ?? 0,
    opened: p.opened ?? 0,
    clicked: p.clicked ?? 0,
    deepLink: p.deepLink ?? "",
    scheduledAt: p.scheduledAt?.toISOString() ?? "",
    sentAt: p.sentAt?.toISOString() ?? "",
    sentBy: p.sentByName ?? "Admin",
    createdAt: formatDisplayDate(p.createdAt),
    updatedAt: formatDisplayDate(p.updatedAt),
  };
}

export async function listPushNotifications(q: Record<string, unknown>) {
  const { page, limit, skip } = parsePageLimit(q);
  const filter: Record<string, unknown> = {};

  if (typeof q.search === "string" && q.search.trim()) {
    const re = new RegExp(escapeRegex(q.search.trim()), "i");
    filter.$or = [{ title: re }, { message: re }];
  }

  if (typeof q.status === "string" && q.status.trim()) {
    filter.status = q.status.trim();
  }

  if (typeof q.audience === "string" && q.audience.trim()) {
    filter.audience = q.audience.trim();
  }

  const [rows, total] = await Promise.all([
    PushNotification.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    PushNotification.countDocuments(filter),
  ]);

  return {
    data: rows.map(mapPush),
    meta: listMeta(page, limit, total),
  };
}

export async function getPushNotification(id: string) {
  const doc = await PushNotification.findById(id).lean();
  if (!doc) throw httpError("Push notification not found", 404);
  return mapPush(doc);
}

export async function createPushNotification(input: {
  title: string;
  message?: string;
  audience?: string;
  scheduledAt?: string;
  deepLink?: string;
}) {
  if (!input.title?.trim()) {
    throw httpError("title is required", 400);
  }
  const doc = await PushNotification.create({
    title: input.title.trim(),
    message: input.message ?? "",
    audience: input.audience ?? "All Users",
    status: input.scheduledAt ? "Scheduled" : "Draft",
    scheduledAt: input.scheduledAt ? new Date(input.scheduledAt) : null,
    deepLink: input.deepLink ?? "",
  });
  return mapPush(doc);
}

export async function updatePushNotification(
  id: string,
  data: Record<string, unknown>
) {
  const doc = await PushNotification.findByIdAndUpdate(id, data, {
    new: true,
    runValidators: true,
  }).lean();
  if (!doc) throw httpError("Push notification not found", 404);
  return mapPush(doc);
}

export async function deletePushNotification(id: string) {
  const doc = await PushNotification.findByIdAndDelete(id).lean();
  if (!doc) throw httpError("Push notification not found", 404);
  return { message: "Push notification deleted", id };
}

export async function sendPushNotification(id: string) {
  const doc = await PushNotification.findByIdAndUpdate(
    id,
    { status: "Sent", sentAt: new Date() },
    { new: true }
  ).lean();
  if (!doc) throw httpError("Push notification not found", 404);
  // TODO: integrate FCM / APNs here to actually deliver
  return mapPush(doc);
}
