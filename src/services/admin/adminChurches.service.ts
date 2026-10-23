import mongoose from "mongoose";
import { Church } from "../../models/church.model.js";
import { User } from "../../models/user.model.js";
import {
  escapeRegex,
  formatDisplayDate,
  httpError,
  listMeta,
  parsePageLimit,
} from "./admin.helpers.js";

function mapChurchList(c: {
  _id: { toString(): string };
  name: string;
  email?: string;
  pastorName?: string;
  type?: string;
  followerCount?: number;
  city?: string;
  country?: string;
  status?: string;
  image?: string;
  createdAt: Date;
  createdBy?: { name?: string; email?: string } | null;
}) {
  return {
    id: c._id.toString(),
    name: c.name,
    email: c.email || "",
    pastor:
      c.pastorName ||
      (c.createdBy as { name?: string } | undefined)?.name ||
      "—",
    type: (c.type as "Physical" | "Online" | "Both") || "Physical",
    followers: c.followerCount ?? 0,
    city: c.city || "—",
    country: c.country || "—",
    status: (c.status as "Approved" | "Pending" | "Suspended") || "Approved",
    logo: c.image || "",
    createdAt: formatDisplayDate(c.createdAt),
  };
}

export async function listChurches(query: Record<string, unknown>) {
  const { page, limit, skip } = parsePageLimit(query);
  const filter: Record<string, unknown> = {};

  if (typeof query.status === "string" && query.status) {
    filter.status = query.status;
  }
  if (typeof query.type === "string" && query.type) {
    filter.type = query.type;
  }
  if (typeof query.search === "string" && query.search.trim()) {
    const rx = new RegExp(escapeRegex(query.search.trim()), "i");
    filter.$or = [
      { name: rx },
      { email: rx },
      { city: rx },
      { country: rx },
      { pastorName: rx },
    ];
  }

  const [total, docs, statusRows] = await Promise.all([
    Church.countDocuments(filter),
    Church.find(filter)
      .populate("createdBy", "name email")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Church.aggregate([{ $group: { _id: "$status", count: { $sum: 1 } } }]),
  ]);

  const stats = {
    total: 0,
    approved: 0,
    pending: 0,
    suspended: 0,
  };
  for (const r of statusRows) {
    stats.total += r.count;
    if (r._id === "Approved") stats.approved = r.count;
    if (r._id === "Pending") stats.pending = r.count;
    if (r._id === "Suspended") stats.suspended = r.count;
  }

  return {
    data: docs.map((c) => mapChurchList(c as never)),
    meta: listMeta(page, limit, total),
    stats,
  };
}

export async function getChurch(id: string) {
  if (!mongoose.isValidObjectId(id)) throw httpError("Invalid id", 400);
  const c = await Church.findById(id).populate("createdBy", "name email").lean();
  if (!c) throw httpError("Church not found", 404);

  return {
    id: c._id.toString(),
    name: c.name,
    email: c.email || "",
    phone: c.phone || "",
    type: c.type || "Physical",
    status: c.status || "Approved",
    pastor: c.pastorName || (c.createdBy as { name?: string })?.name || "",
    pastorEmail:
      c.pastorEmail || (c.createdBy as { email?: string })?.email || "",
    pastorPhone: c.pastorPhone || "",
    pastorBio: c.pastorBio || "",
    denomination: c.denomination || "",
    language: "",
    country: c.country || "",
    state: c.state || "",
    city: c.city || "",
    shortLocation: c.locationShort || "",
    fullAddress: c.locationFull || c.streetAddress || "",
    website: c.website || "",
    about: c.about || c.shortBio || "",
    vision: "",
    mission: "",
    members: c.memberCount ?? 0,
    followers: c.followerCount ?? 0,
    logo: c.image || "",
    banner: c.bannerImage || "",
    createdAt: formatDisplayDate(c.createdAt),
    updatedAt: formatDisplayDate(c.updatedAt),
  };
}

export async function createChurch(body: Record<string, unknown>, adminId: string) {
  const name = String(body.name ?? "").trim();
  if (!name) throw httpError("name is required", 400);

  const church = await Church.create({
    name,
    email: String(body.email ?? "").trim(),
    phone: String(body.phone ?? "").trim(),
    type: body.type === "Online" || body.type === "Both" ? body.type : "Physical",
    status:
      body.status === "Pending" ||
      body.status === "Suspended" ||
      body.status === "Rejected"
        ? body.status
        : "Approved",
    pastorName: String(body.pastor ?? body.pastorName ?? "").trim(),
    pastorEmail: String(body.pastorEmail ?? "").trim(),
    pastorPhone: String(body.pastorPhone ?? "").trim(),
    pastorBio: String(body.pastorBio ?? "").trim(),
    denomination: String(body.denomination ?? "").trim(),
    country: String(body.country ?? "").trim(),
    state: String(body.state ?? "").trim(),
    city: String(body.city ?? "").trim(),
    locationShort: String(body.shortLocation ?? "").trim(),
    locationFull: String(body.fullAddress ?? "").trim(),
    website: String(body.website ?? "").trim(),
    about: String(body.about ?? "").trim(),
    image: String(body.logo ?? body.image ?? "").trim(),
    bannerImage: String(body.banner ?? "").trim(),
    memberCount: Number(body.members) || 1,
    createdBy: adminId,
  });

  return getChurch(church._id.toString());
}

export async function updateChurch(id: string, body: Record<string, unknown>) {
  const c = await Church.findById(id);
  if (!c) throw httpError("Church not found", 404);

  if (body.name !== undefined) c.name = String(body.name).trim();
  if (body.email !== undefined) c.email = String(body.email).trim();
  if (body.phone !== undefined) c.phone = String(body.phone).trim();
  if (body.type === "Physical" || body.type === "Online" || body.type === "Both") {
    c.type = body.type;
  }
  if (
    body.status === "Approved" ||
    body.status === "Pending" ||
    body.status === "Suspended" ||
    body.status === "Rejected"
  ) {
    c.status = body.status;
  }
  if (body.pastor !== undefined || body.pastorName !== undefined) {
    c.pastorName = String(body.pastor ?? body.pastorName).trim();
  }
  if (body.pastorEmail !== undefined) c.pastorEmail = String(body.pastorEmail).trim();
  if (body.pastorPhone !== undefined) c.pastorPhone = String(body.pastorPhone).trim();
  if (body.pastorBio !== undefined) c.pastorBio = String(body.pastorBio).trim();
  if (body.denomination !== undefined) c.denomination = String(body.denomination).trim();
  if (body.country !== undefined) c.country = String(body.country).trim();
  if (body.state !== undefined) c.state = String(body.state).trim();
  if (body.city !== undefined) c.city = String(body.city).trim();
  if (body.shortLocation !== undefined) c.locationShort = String(body.shortLocation).trim();
  if (body.fullAddress !== undefined) c.locationFull = String(body.fullAddress).trim();
  if (body.website !== undefined) c.website = String(body.website).trim();
  if (body.about !== undefined) c.about = String(body.about).trim();
  if (body.logo !== undefined) c.image = String(body.logo).trim();
  if (body.banner !== undefined) c.bannerImage = String(body.banner).trim();

  await c.save();
  return getChurch(id);
}

export async function setChurchStatus(
  id: string,
  status: "Approved" | "Pending" | "Suspended" | "Rejected"
) {
  const c = await Church.findById(id);
  if (!c) throw httpError("Church not found", 404);
  c.status = status;
  await c.save();
  return { id, status, message: `Church ${status.toLowerCase()}` };
}

export async function deleteChurch(id: string) {
  const c = await Church.findById(id);
  if (!c) throw httpError("Church not found", 404);
  await c.deleteOne();
  return { message: "Church deleted", id };
}
