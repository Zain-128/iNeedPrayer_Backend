import mongoose from "mongoose";
import { Church } from "../models/church.model.js";
import { ChurchFollow } from "../models/churchFollow.model.js";
import { formatCountLabel } from "../utils/mappers.js";

export type ChurchFilter =
  | "recommended"
  | "most_followed"
  | "nearest"
  | "trending_posts"
  | "trending_search";

function mapChurch(
  c: mongoose.FlattenMaps<Record<string, unknown>> & {
    _id: mongoose.Types.ObjectId;
    name: string;
    locationShort: string;
    followerCount: number;
    image: string;
    bannerImage?: string;
    website?: string;
    email?: string;
    phone?: string;
    denomination?: string;
    about?: string;
    locationFull?: string;
    createdBy?: mongoose.Types.ObjectId | null;
  },
  userId?: string,
  followedSet?: Set<string>,
  myChurchSet?: Set<string>
) {
  const id = c._id.toString();
  return {
    id,
    name: c.name,
    locationShort: c.locationShort ?? "",
    followersLabel: formatCountLabel(c.followerCount ?? 0, "followers"),
    image: c.image ?? "",
    isFollowed: userId && followedSet ? followedSet.has(id) : false,
    isMyChurch:
      userId && myChurchSet
        ? myChurchSet.has(id)
        : c.createdBy?.toString() === userId,
    bannerImage: c.bannerImage ?? "",
    website: c.website ?? "",
    email: c.email ?? "",
    phone: c.phone ?? "",
    denomination: c.denomination ?? "",
    about: c.about ?? "",
    locationFull: c.locationFull ?? "",
  };
}

export async function listChurches(opts: {
  userId?: string;
  q?: string;
  filter?: ChurchFilter;
  tab?: "my" | "followed";
}) {
  let sort: Record<string, 1 | -1> = { followerCount: -1 };
  if (
    opts.filter === "nearest" ||
    opts.filter === "trending_posts" ||
    opts.filter === "trending_search"
  ) {
    sort = { updatedAt: -1 };
  }

  const q = opts.q?.trim();
  const rx = q
    ? new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i")
    : null;
  const mongoFilter = rx
    ? {
        $or: [{ name: rx }, { locationShort: rx }, { about: rx }],
      }
    : {};

  let docs = await Church.find(mongoFilter).sort(sort).limit(100).lean();

  if (opts.userId && opts.tab === "my") {
    docs = docs.filter(
      (c) => c.createdBy?.toString() === opts.userId
    );
  }
  if (opts.userId && opts.tab === "followed") {
    const follows = await ChurchFollow.find({ user: opts.userId })
      .select("church")
      .lean();
    const ids = new Set(follows.map((f) => f.church.toString()));
    docs = docs.filter((c) => ids.has(c._id.toString()));
  }

  let followedSet = new Set<string>();
  let myChurchSet = new Set<string>();
  if (opts.userId) {
    const follows = await ChurchFollow.find({ user: opts.userId }).lean();
    followedSet = new Set(follows.map((f) => f.church.toString()));
    const mine = await Church.find({ createdBy: opts.userId }).select("_id").lean();
    myChurchSet = new Set(mine.map((m) => m._id.toString()));
  }

  return docs.map((c) =>
    mapChurch(c as Parameters<typeof mapChurch>[0], opts.userId, followedSet, myChurchSet)
  );
}

export async function getChurch(id: string, userId?: string) {
  const c = await Church.findById(id).lean();
  if (!c) {
    const err = new Error("Church not found");
    (err as Error & { statusCode?: number }).statusCode = 404;
    throw err;
  }
  let followedSet = new Set<string>();
  let myChurchSet = new Set<string>();
  if (userId) {
    const f = await ChurchFollow.findOne({ user: userId, church: id });
    if (f) followedSet.add(id);
    if (c.createdBy?.toString() === userId) myChurchSet.add(id);
  }
  return mapChurch(c as Parameters<typeof mapChurch>[0], userId, followedSet, myChurchSet);
}

export async function createChurch(
  userId: string,
  body: Partial<{
    name: string;
    locationShort: string;
    locationFull: string;
    image: string;
    bannerImage: string;
    website: string;
    email: string;
    phone: string;
    denomination: string;
    about: string;
  }>
) {
  if (!body.name?.trim()) {
    const err = new Error("Name is required");
    (err as Error & { statusCode?: number }).statusCode = 400;
    throw err;
  }
  const c = await Church.create({
    ...body,
    name: body.name.trim(),
    createdBy: userId,
  });
  return getChurch(c._id.toString(), userId);
}

export async function updateChurch(
  churchId: string,
  userId: string,
  body: Record<string, string | undefined>
) {
  const c = await Church.findById(churchId);
  if (!c) {
    const err = new Error("Church not found");
    (err as Error & { statusCode?: number }).statusCode = 404;
    throw err;
  }
  if (c.createdBy?.toString() !== userId) {
    const err = new Error("Not allowed");
    (err as Error & { statusCode?: number }).statusCode = 403;
    throw err;
  }
  const fields = [
    "name",
    "locationShort",
    "locationFull",
    "image",
    "bannerImage",
    "website",
    "email",
    "phone",
    "denomination",
    "about",
  ] as const;
  for (const f of fields) {
    if (body[f] !== undefined) (c as unknown as Record<string, string>)[f] = body[f]!;
  }
  await c.save();
  return getChurch(churchId, userId);
}

export async function toggleFollowChurch(userId: string, churchId: string) {
  const church = await Church.findById(churchId);
  if (!church) {
    const err = new Error("Church not found");
    (err as Error & { statusCode?: number }).statusCode = 404;
    throw err;
  }
  const ex = await ChurchFollow.findOne({ user: userId, church: churchId });
  if (ex) {
    await ex.deleteOne();
    church.followerCount = Math.max(0, church.followerCount - 1);
    await church.save();
    return { following: false, followerCount: church.followerCount };
  }
  await ChurchFollow.create({ user: userId, church: churchId });
  church.followerCount += 1;
  await church.save();
  return { following: true, followerCount: church.followerCount };
}
