import mongoose from "mongoose";
import { Church } from "../models/church.model.js";
import { ChurchFollow } from "../models/churchFollow.model.js";
import { ChurchMember } from "../models/churchMember.model.js";
import { User } from "../models/user.model.js";
import { CHURCH_VERIFY_CODE } from "../contants.js";
import { formatCountLabel } from "../utils/mappers.js";
import {
  normalizeChurchInput,
  validateCreateChurchInput,
  type NormalizedChurchInput,
} from "../utils/churchInput.js";

export type ChurchFilter =
  | "recommended"
  | "most_followed"
  | "nearest"
  | "trending_posts"
  | "trending_search";

export type ChurchMemberRole = "owner" | "admin" | "member";

type ChurchMutable = {
  name: string;
  email: string;
  isVerified: boolean;
  verificationCode: string | null;
  verificationCodeExpiresAt: Date | null;
  createdBy?: mongoose.Types.ObjectId | null;
  memberCount?: number;
  followerCount: number;
  save(): Promise<unknown>;
  deleteOne(): Promise<unknown>;
  set(update: Record<string, unknown>): void;
};

type ChurchDoc = mongoose.FlattenMaps<Record<string, unknown>> & {
  _id: mongoose.Types.ObjectId;
  name: string;
  locationShort: string;
  locationFull?: string;
  country?: string;
  state?: string;
  city?: string;
  streetAddress?: string;
  landmark?: string;
  followerCount: number;
  memberCount?: number;
  image: string;
  bannerImage?: string;
  website?: string;
  email?: string;
  phone?: string;
  denomination?: string;
  shortBio?: string;
  about?: string;
  liveStreamUrl?: string;
  isVerified?: boolean;
  createdBy?: mongoose.Types.ObjectId | null;
};

function generateVerificationCode(): string {
  return String(Math.floor(10000 + Math.random() * 90000));
}

async function assertChurchManager(
  churchId: string,
  userId: string
): Promise<{ church: ChurchMutable }> {
  const church = await Church.findById(churchId);
  if (!church) {
    const err = new Error("Church not found");
    (err as Error & { statusCode?: number }).statusCode = 404;
    throw err;
  }
  const doc = church as unknown as ChurchMutable;
  if (church.createdBy?.toString() === userId) {
    return { church: doc };
  }
  const member = await ChurchMember.findOne({
    church: churchId,
    user: userId,
    role: { $in: ["owner", "admin"] },
  });
  if (!member) {
    const err = new Error("Not allowed");
    (err as Error & { statusCode?: number }).statusCode = 403;
    throw err;
  }
  return { church: doc };
}

function mapChurch(
  c: ChurchDoc,
  userId?: string,
  followedSet?: Set<string>,
  myChurchSet?: Set<string>
) {
  const id = c._id.toString();
  const banner = c.bannerImage ?? "";
  return {
    id,
    name: c.name,
    locationShort: c.locationShort ?? "",
    locationFull: c.locationFull ?? "",
    country: c.country ?? "",
    state: c.state ?? "",
    city: c.city ?? "",
    streetAddress: c.streetAddress ?? "",
    landmark: c.landmark ?? "",
    followersLabel: formatCountLabel(c.followerCount ?? 0, "followers"),
    membersLabel: formatCountLabel(c.memberCount ?? 1, "members"),
    image: c.image ?? "",
    bannerImage: banner,
    banner,
    website: c.website ?? "",
    email: c.email ?? "",
    phone: c.phone ?? "",
    denomination: c.denomination ?? "",
    shortBio: c.shortBio ?? "",
    about: c.about ?? "",
    liveStreamUrl: c.liveStreamUrl ?? "",
    isVerified: !!c.isVerified,
    isFollowed: userId && followedSet ? followedSet.has(id) : false,
    isMyChurch:
      userId && myChurchSet
        ? myChurchSet.has(id)
        : c.createdBy?.toString() === userId,
    followerCount: c.followerCount ?? 0,
    memberCount: c.memberCount ?? 1,
  };
}

async function loadUserContext(userId?: string) {
  let followedSet = new Set<string>();
  let myChurchSet = new Set<string>();
  if (!userId) return { followedSet, myChurchSet };

  const [follows, owned, adminMemberships] = await Promise.all([
    ChurchFollow.find({ user: userId }).select("church").lean(),
    Church.find({ createdBy: userId }).select("_id").lean(),
    ChurchMember.find({ user: userId }).select("church role").lean(),
  ]);

  followedSet = new Set(follows.map((f) => f.church.toString()));
  myChurchSet = new Set(owned.map((m) => m._id.toString()));
  for (const m of adminMemberships) {
    if (m.role === "owner" || m.role === "admin") {
      myChurchSet.add(m.church.toString());
    }
  }
  return { followedSet, myChurchSet };
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
        $or: [
          { name: rx },
          { locationShort: rx },
          { about: rx },
          { city: rx },
          { country: rx },
        ],
      }
    : {};

  let docs = await Church.find(mongoFilter).sort(sort).limit(100).lean();

  const { followedSet, myChurchSet } = await loadUserContext(opts.userId);

  if (opts.userId && opts.tab === "my") {
    docs = docs.filter((c) => myChurchSet.has(c._id.toString()));
  }
  if (opts.userId && opts.tab === "followed") {
    docs = docs.filter((c) => followedSet.has(c._id.toString()));
  }

  return docs.map((c) =>
    mapChurch(c as ChurchDoc, opts.userId, followedSet, myChurchSet)
  );
}

export async function discoverChurches(opts: { userId?: string; q?: string }) {
  const q = opts.q?.trim();
  const rx = q
    ? new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i")
    : null;
  const mongoFilter = rx
    ? {
        $or: [{ name: rx }, { locationShort: rx }, { city: rx }],
      }
    : {};

  let docs = await Church.find(mongoFilter)
    .sort({ followerCount: -1 })
    .limit(100)
    .lean();

  const { followedSet, myChurchSet } = await loadUserContext(opts.userId);

  if (opts.userId) {
    docs = docs.filter(
      (c) =>
        !myChurchSet.has(c._id.toString()) &&
        !followedSet.has(c._id.toString())
    );
  }

  return docs.map((c) =>
    mapChurch(c as ChurchDoc, opts.userId, followedSet, myChurchSet)
  );
}

export async function getChurch(id: string, userId?: string) {
  const c = await Church.findById(id).lean();
  if (!c) {
    const err = new Error("Church not found");
    (err as Error & { statusCode?: number }).statusCode = 404;
    throw err;
  }
  const { followedSet, myChurchSet } = await loadUserContext(userId);
  return mapChurch(c as ChurchDoc, userId, followedSet, myChurchSet);
}

function applyNormalizedToChurch(
  church: ChurchMutable,
  input: NormalizedChurchInput,
  partial = false
) {
  const fields: (keyof NormalizedChurchInput)[] = [
    "name",
    "website",
    "country",
    "state",
    "city",
    "streetAddress",
    "landmark",
    "locationShort",
    "locationFull",
    "email",
    "phone",
    "shortBio",
    "about",
    "image",
    "bannerImage",
    "denomination",
    "liveStreamUrl",
  ];
  for (const f of fields) {
    const v = input[f];
    if (partial && v === "") continue;
    if (!partial || v !== undefined) {
      (church as unknown as Record<string, string>)[f] = v;
    }
  }
}

export async function createChurch(
  userId: string,
  body: Record<string, unknown> | null | undefined,
  opts?: { skipVerification?: boolean; verificationCode?: string }
) {
  const input = normalizeChurchInput(body);
  const validationError = validateCreateChurchInput(input);
  if (validationError) {
    const err = new Error(validationError);
    (err as Error & { statusCode?: number }).statusCode = 400;
    throw err;
  }

  const code =
    opts?.verificationCode?.trim() ||
    (opts?.skipVerification ? null : generateVerificationCode());
  const isVerified =
    opts?.skipVerification ||
    (code !== null && code === CHURCH_VERIFY_CODE);

  const c = await Church.create({
    ...input,
    name: input.name,
    isVerified: !!isVerified,
    verificationCode: isVerified ? null : code,
    verificationCodeExpiresAt: isVerified
      ? null
      : new Date(Date.now() + 15 * 60 * 1000),
    createdBy: userId,
    memberCount: 1,
  });

  await ChurchMember.create({
    user: userId,
    church: c._id,
    role: "owner",
  });

  const church = await getChurch(c._id.toString(), userId);
  return {
    church,
    verificationRequired: !isVerified,
    /** Dev only — remove when email OTP is wired. */
    devVerificationCode: !isVerified ? code : undefined,
  };
}

export async function updateChurch(
  churchId: string,
  userId: string,
  body: Record<string, unknown> | null | undefined
) {
  const { church } = await assertChurchManager(churchId, userId);
  const input = normalizeChurchInput(body);
  if (input.name === "" && (body as { name?: string })?.name !== "") {
    const err = new Error("Church name is required");
    (err as Error & { statusCode?: number }).statusCode = 400;
    throw err;
  }
  applyNormalizedToChurch(church, input, true);
  if (input.name) church.name = input.name;
  await church.save();
  return getChurch(churchId, userId);
}

export async function deleteChurch(churchId: string, userId: string) {
  const church = await Church.findById(churchId);
  if (!church) {
    const err = new Error("Church not found");
    (err as Error & { statusCode?: number }).statusCode = 404;
    throw err;
  }
  if (church.createdBy?.toString() !== userId) {
    const err = new Error("Only the church owner can delete");
    (err as Error & { statusCode?: number }).statusCode = 403;
    throw err;
  }
  await Promise.all([
    ChurchFollow.deleteMany({ church: churchId }),
    ChurchMember.deleteMany({ church: churchId }),
    church.deleteOne(),
  ]);
  return { ok: true };
}

export async function sendChurchVerification(churchId: string, userId: string) {
  const { church } = await assertChurchManager(churchId, userId);
  if (church.isVerified) {
    return { ok: true, alreadyVerified: true };
  }
  const code = generateVerificationCode();
  church.verificationCode = code;
  church.verificationCodeExpiresAt = new Date(Date.now() + 15 * 60 * 1000);
  await church.save();
  return {
    ok: true,
    channel: "email",
    target: church.email,
    devVerificationCode: code,
  };
}

export async function verifyChurch(
  churchId: string,
  code: string,
  userId?: string
) {
  const raw = await Church.findById(churchId).select(
    "+verificationCode +verificationCodeExpiresAt"
  );
  if (!raw) {
    const err = new Error("Church not found");
    (err as Error & { statusCode?: number }).statusCode = 404;
    throw err;
  }
  const church = raw as unknown as ChurchMutable;

  const trimmed = String(code ?? "").trim();
  const stubOk = trimmed === CHURCH_VERIFY_CODE;
  const storedOk =
    church.verificationCode &&
    trimmed === church.verificationCode &&
    church.verificationCodeExpiresAt &&
    church.verificationCodeExpiresAt > new Date();

  if (!stubOk && !storedOk) {
    const err = new Error("Invalid verification code");
    (err as Error & { statusCode?: number }).statusCode = 400;
    throw err;
  }

  church.isVerified = true;
  church.verificationCode = null;
  church.verificationCodeExpiresAt = null;
  await church.save();

  return {
    ok: true,
    church: await getChurch(churchId, userId),
  };
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
    return {
      following: false,
      followerCount: church.followerCount,
      followersLabel: formatCountLabel(church.followerCount, "followers"),
    };
  }
  await ChurchFollow.create({ user: userId, church: churchId });
  church.followerCount += 1;
  await church.save();
  return {
    following: true,
    followerCount: church.followerCount,
    followersLabel: formatCountLabel(church.followerCount, "followers"),
  };
}

export async function listChurchMembers(churchId: string, userId: string) {
  await assertChurchManager(churchId, userId);
  const members = await ChurchMember.find({ church: churchId })
    .populate("user", "name email avatar")
    .sort({ role: 1, createdAt: 1 })
    .lean();

  return members.map((m) => ({
    id: m._id.toString(),
    userId: m.user?._id?.toString() ?? "",
    name: (m.user as { name?: string })?.name ?? "",
    email: (m.user as { email?: string })?.email ?? "",
    avatar: (m.user as { avatar?: string })?.avatar ?? "",
    role: m.role as ChurchMemberRole,
    joinedAt: m.createdAt,
  }));
}

export async function addChurchMember(
  churchId: string,
  actorId: string,
  body: { userId?: string; email?: string; role?: ChurchMemberRole }
) {
  await assertChurchManager(churchId, actorId);

  let targetUserId = body.userId?.trim();
  if (!targetUserId && body.email?.trim()) {
    const u = await User.findOne({ email: body.email.trim().toLowerCase() });
    if (!u) {
      const err = new Error("User not found for that email");
      (err as Error & { statusCode?: number }).statusCode = 404;
      throw err;
    }
    targetUserId = u._id.toString();
  }
  if (!targetUserId || !mongoose.isValidObjectId(targetUserId)) {
    const err = new Error("userId or email is required");
    (err as Error & { statusCode?: number }).statusCode = 400;
    throw err;
  }

  const role: ChurchMemberRole =
    body.role === "admin" || body.role === "member" ? body.role : "member";

  const church = await Church.findById(churchId);
  if (!church) {
    const err = new Error("Church not found");
    (err as Error & { statusCode?: number }).statusCode = 404;
    throw err;
  }

  const ex = await ChurchMember.findOne({ church: churchId, user: targetUserId });
  if (ex) {
    const err = new Error("User is already a church member");
    (err as Error & { statusCode?: number }).statusCode = 400;
    throw err;
  }

  await ChurchMember.create({ church: churchId, user: targetUserId, role });
  church.memberCount = (church.memberCount ?? 0) + 1;
  await church.save();

  const user = await User.findById(targetUserId).select("name email avatar").lean();
  return {
    member: {
      userId: targetUserId,
      name: user?.name ?? "",
      email: user?.email ?? "",
      avatar: user?.avatar ?? "",
      role,
    },
    memberCount: church.memberCount,
  };
}

export async function removeChurchMember(
  churchId: string,
  actorId: string,
  targetUserId: string
) {
  await assertChurchManager(churchId, actorId);

  const church = await Church.findById(churchId);
  if (!church) {
    const err = new Error("Church not found");
    (err as Error & { statusCode?: number }).statusCode = 404;
    throw err;
  }

  if (church.createdBy?.toString() === targetUserId) {
    const err = new Error("Cannot remove the church owner");
    (err as Error & { statusCode?: number }).statusCode = 400;
    throw err;
  }

  const ex = await ChurchMember.findOne({ church: churchId, user: targetUserId });
  if (!ex) {
    const err = new Error("Member not found");
    (err as Error & { statusCode?: number }).statusCode = 404;
    throw err;
  }

  await ex.deleteOne();
  church.memberCount = Math.max(1, (church.memberCount ?? 1) - 1);
  await church.save();
  return { ok: true, memberCount: church.memberCount };
}

export async function updateChurchMemberRole(
  churchId: string,
  actorId: string,
  targetUserId: string,
  role: ChurchMemberRole
) {
  const church = await Church.findById(churchId);
  if (!church) {
    const err = new Error("Church not found");
    (err as Error & { statusCode?: number }).statusCode = 404;
    throw err;
  }
  if (church.createdBy?.toString() !== actorId) {
    const err = new Error("Only the church owner can change roles");
    (err as Error & { statusCode?: number }).statusCode = 403;
    throw err;
  }
  if (targetUserId === actorId) {
    const err = new Error("Cannot change owner role");
    (err as Error & { statusCode?: number }).statusCode = 400;
    throw err;
  }
  if (role !== "admin" && role !== "member") {
    const err = new Error("role must be admin or member");
    (err as Error & { statusCode?: number }).statusCode = 400;
    throw err;
  }

  const ex = await ChurchMember.findOne({ church: churchId, user: targetUserId });
  if (!ex) {
    const err = new Error("Member not found");
    (err as Error & { statusCode?: number }).statusCode = 404;
    throw err;
  }

  ex.role = role;
  await ex.save();
  return { ok: true, userId: targetUserId, role };
}
