import mongoose from "mongoose";
import { EmailCampaign } from "../../models/emailCampaign.model.js";
import type { EmailCampaignStatus } from "../../models/emailCampaign.model.js";
import { User } from "../../models/user.model.js";
import { UserSubscription } from "../../models/userSubscription.model.js";
import {
  escapeRegex,
  formatDisplayDate,
  httpError,
  listMeta,
  parsePageLimit,
} from "./admin.helpers.js";

function mapCampaign(c: {
  _id: { toString(): string };
  name: string;
  subject: string;
  message?: string;
  audience?: string;
  recipients?: number;
  openRate?: string;
  clickRate?: string;
  status?: string;
  scheduledAt?: Date | null;
  sentAt?: Date | null;
  createdByName?: string;
  createdAt?: Date;
}) {
  return {
    id: c._id.toString(),
    name: c.name,
    subject: c.subject,
    message: c.message ?? "",
    audience: c.audience ?? "All Users",
    recipients: c.recipients ?? 0,
    openRate: c.openRate ?? "-",
    clickRate: c.clickRate ?? "-",
    status: c.status ?? "Draft",
    scheduledAt: c.scheduledAt
      ? c.scheduledAt.toLocaleString("en-US", {
          month: "short",
          day: "2-digit",
          year: "numeric",
          hour: "numeric",
          minute: "2-digit",
        })
      : "-",
    sentAt: c.sentAt?.toISOString() ?? "",
    createdBy: c.createdByName ?? "Admin",
    createdAt: formatDisplayDate(c.createdAt),
  };
}

async function countAudience(audience?: string) {
  const filter: Record<string, unknown> = {
    role: { $ne: "admin" },
    status: { $ne: "blocked" },
  };
  if (audience === "Premium Users") {
    const activeUserIds = await UserSubscription.find({ status: "Active" }).distinct(
      "user"
    );
    return activeUserIds.length;
  }
  return User.countDocuments(filter);
}

export async function listEmailCampaigns(query: Record<string, unknown>) {
  const { page, limit, skip } = parsePageLimit(query);
  const filter: Record<string, unknown> = {};

  if (typeof query.status === "string" && query.status !== "All") {
    filter.status = query.status;
  }
  if (typeof query.search === "string" && query.search.trim()) {
    const rx = new RegExp(escapeRegex(query.search.trim()), "i");
    filter.$or = [{ name: rx }, { subject: rx }, { message: rx }];
  }

  const [total, docs, statusAgg] = await Promise.all([
    EmailCampaign.countDocuments(filter),
    EmailCampaign.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    EmailCampaign.aggregate([{ $group: { _id: "$status", count: { $sum: 1 } } }]),
  ]);

  const stats = {
    total: total,
    draft: 0,
    scheduled: 0,
    sent: 0,
    failed: 0,
  };
  for (const row of statusAgg) {
    if (row._id === "Draft") stats.draft = row.count;
    if (row._id === "Scheduled") stats.scheduled = row.count;
    if (row._id === "Sent") stats.sent = row.count;
    if (row._id === "Failed") stats.failed = row.count;
  }

  return {
    data: docs.map((c) => mapCampaign(c)),
    meta: listMeta(page, limit, total),
    stats,
  };
}

export async function getEmailCampaign(id: string) {
  if (!mongoose.isValidObjectId(id)) throw httpError("Invalid id", 400);
  const c = await EmailCampaign.findById(id).lean();
  if (!c) throw httpError("Campaign not found", 404);
  return mapCampaign(c);
}

export async function createEmailCampaign(
  body: Record<string, unknown>,
  adminUserId?: string
) {
  const name = String(body.name ?? "").trim();
  const subject = String(body.subject ?? "").trim();
  if (!name || !subject) {
    throw httpError("name and subject are required", 400);
  }

  const audience = String(body.audience ?? "All Users");
  const recipients = await countAudience(audience);
  const status = body.scheduledAt ? "Scheduled" : "Draft";

  const campaign = await EmailCampaign.create({
    name,
    subject,
    message: String(body.message ?? "").trim(),
    audience,
    recipients,
    status,
    scheduledAt: body.scheduledAt ? new Date(String(body.scheduledAt)) : null,
    createdBy: adminUserId && mongoose.isValidObjectId(adminUserId) ? adminUserId : null,
    createdByName: String(body.createdBy ?? "Admin"),
  });

  return mapCampaign(campaign);
}

export async function updateEmailCampaign(
  id: string,
  body: Record<string, unknown>
) {
  if (!mongoose.isValidObjectId(id)) throw httpError("Invalid id", 400);
  const c = await EmailCampaign.findById(id);
  if (!c) throw httpError("Campaign not found", 404);
  if (c.status === "Sent") {
    throw httpError("Sent campaigns cannot be edited", 409);
  }

  if (body.name !== undefined) c.name = String(body.name).trim();
  if (body.subject !== undefined) c.subject = String(body.subject).trim();
  if (body.message !== undefined) c.message = String(body.message).trim();
  if (body.audience !== undefined) {
    c.audience = String(body.audience);
    c.recipients = await countAudience(c.audience);
  }
  if (body.scheduledAt !== undefined) {
    c.scheduledAt = body.scheduledAt ? new Date(String(body.scheduledAt)) : null;
    if (c.status === "Draft" && c.scheduledAt) c.status = "Scheduled";
  }
  if (body.status !== undefined) {
    c.status = body.status as EmailCampaignStatus;
  }

  await c.save();
  return mapCampaign(c);
}

export async function deleteEmailCampaign(id: string) {
  if (!mongoose.isValidObjectId(id)) throw httpError("Invalid id", 400);
  const result = await EmailCampaign.deleteOne({ _id: id });
  if (!result.deletedCount) throw httpError("Campaign not found", 404);
  return { message: "Deleted", id };
}

export async function sendEmailCampaign(id: string) {
  if (!mongoose.isValidObjectId(id)) throw httpError("Invalid id", 400);
  const c = await EmailCampaign.findById(id);
  if (!c) throw httpError("Campaign not found", 404);
  if (c.status === "Sent") throw httpError("Campaign already sent", 409);

  c.status = "Sending";
  await c.save();

  try {
    c.recipients = await countAudience(c.audience);
    c.status = "Sent";
    c.sentAt = new Date();
    c.openRate = "0%";
    c.clickRate = "0%";
    await c.save();
    return {
      ...mapCampaign(c),
      message:
        "Campaign marked as sent. Connect an email provider (SendGrid, SES, etc.) for real delivery.",
    };
  } catch (e) {
    c.status = "Failed";
    await c.save();
    throw e;
  }
}
