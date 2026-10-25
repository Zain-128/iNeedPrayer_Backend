import { ChurchEvent } from "../../models/event.model.js";
import {
  parsePageLimit,
  listMeta,
  escapeRegex,
  httpError,
  formatDisplayDate,
} from "./admin.helpers.js";

function mapEvent(e: {
  _id: { toString(): string };
  title: string;
  description?: string;
  type?: string;
  status?: string;
  hostName?: string;
  hostEmail?: string;
  avatar?: string;
  churchId?: { toString(): string } | null;
  churchName?: string;
  location?: string;
  eventDate?: Date | null;
  eventEndDate?: Date | null;
  attendees?: number;
  registrations?: number;
  maxAttendees?: number;
  meetingUrl?: string;
  coverImage?: string;
  tags?: string[];
  createdAt?: Date;
  updatedAt?: Date;
}) {
  return {
    id: e._id.toString(),
    title: e.title,
    description: e.description ?? "",
    type: e.type ?? "Online",
    status: e.status ?? "Upcoming",
    hostName: e.hostName ?? "Admin",
    hostEmail: e.hostEmail ?? "",
    avatar: e.avatar ?? "",
    churchId: e.churchId?.toString() ?? null,
    churchName: e.churchName ?? "",
    location: e.location ?? "",
    eventDate: e.eventDate?.toISOString() ?? "",
    eventEndDate: e.eventEndDate?.toISOString() ?? "",
    attendees: e.attendees ?? 0,
    registrations: e.registrations ?? 0,
    maxAttendees: e.maxAttendees ?? 0,
    meetingUrl: e.meetingUrl ?? "",
    coverImage: e.coverImage ?? "",
    tags: e.tags ?? [],
    createdAt: formatDisplayDate(e.createdAt),
    updatedAt: formatDisplayDate(e.updatedAt),
  };
}

export async function listEvents(q: Record<string, unknown>) {
  const { page, limit, skip } = parsePageLimit(q);
  const filter: Record<string, unknown> = {};

  if (typeof q.search === "string" && q.search.trim()) {
    const re = new RegExp(escapeRegex(q.search.trim()), "i");
    filter.$or = [{ title: re }, { hostName: re }, { churchName: re }];
  }

  if (typeof q.status === "string" && q.status.trim()) {
    filter.status = q.status.trim();
  }

  if (typeof q.type === "string" && q.type.trim()) {
    filter.type = q.type.trim();
  }

  const [rows, total] = await Promise.all([
    ChurchEvent.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    ChurchEvent.countDocuments(filter),
  ]);

  return {
    data: rows.map(mapEvent),
    meta: listMeta(page, limit, total),
  };
}

export async function getEvent(id: string) {
  const doc = await ChurchEvent.findById(id).lean();
  if (!doc) throw httpError("Event not found", 404);
  return mapEvent(doc);
}

export async function createEvent(input: {
  title: string;
  description?: string;
  type?: string;
  hostName?: string;
  hostEmail?: string;
  avatar?: string;
  churchId?: string;
  churchName?: string;
  location?: string;
  eventDate?: string;
  eventEndDate?: string;
  maxAttendees?: number;
  meetingUrl?: string;
  coverImage?: string;
  tags?: string[];
}) {
  if (!input.title?.trim()) {
    throw httpError("title is required", 400);
  }
  const doc = await ChurchEvent.create({
    title: input.title.trim(),
    description: input.description ?? "",
    type: input.type ?? "Online",
    hostName: input.hostName ?? "Admin",
    hostEmail: input.hostEmail ?? "",
    avatar: input.avatar ?? "",
    churchId: input.churchId || null,
    churchName: input.churchName ?? "",
    location: input.location ?? "",
    eventDate: input.eventDate ? new Date(input.eventDate) : null,
    eventEndDate: input.eventEndDate ? new Date(input.eventEndDate) : null,
    maxAttendees: input.maxAttendees ?? 0,
    meetingUrl: input.meetingUrl ?? "",
    coverImage: input.coverImage ?? "",
    tags: input.tags ?? [],
  });
  return mapEvent(doc);
}

export async function updateEvent(
  id: string,
  data: Record<string, unknown>
) {
  const doc = await ChurchEvent.findByIdAndUpdate(id, data, {
    new: true,
    runValidators: true,
  }).lean();
  if (!doc) throw httpError("Event not found", 404);
  return mapEvent(doc);
}

export async function deleteEvent(id: string) {
  const doc = await ChurchEvent.findByIdAndDelete(id).lean();
  if (!doc) throw httpError("Event not found", 404);
  return { message: "Event deleted", id };
}

export async function cancelEvent(id: string) {
  const doc = await ChurchEvent.findByIdAndUpdate(
    id,
    { status: "Cancelled" },
    { new: true }
  ).lean();
  if (!doc) throw httpError("Event not found", 404);
  return mapEvent(doc);
}
