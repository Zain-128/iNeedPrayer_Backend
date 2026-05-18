import mongoose from "mongoose";
import { Group } from "../models/group.model.js";
import { GroupMember } from "../models/groupMember.model.js";
import { Notification } from "../models/notification.model.js";
import { User } from "../models/user.model.js";
import { formatCountLabel } from "../utils/mappers.js";
import {
  normalizeGroupInput,
  validateCreateGroupInput,
  type NormalizedGroupInput,
} from "../utils/groupInput.js";

export type GroupMemberRole = "owner" | "admin" | "member";

type GroupDoc = {
  _id: mongoose.Types.ObjectId;
  name: string;
  image?: string;
  description?: string;
  memberCount: number;
  createdBy?: mongoose.Types.ObjectId | null;
};

type GroupMutable = {
  name: string;
  image: string;
  description: string;
  memberCount: number;
  createdBy?: mongoose.Types.ObjectId | null;
  save(): Promise<unknown>;
  deleteOne(): Promise<unknown>;
};

function mapGroup(
  g: GroupDoc,
  userId?: string,
  memberSet?: Set<string>,
  createdByMeSet?: Set<string>
) {
  const id = g._id.toString();
  const isJoined = userId && memberSet ? memberSet.has(id) : false;
  const isMyGroup =
    userId && createdByMeSet
      ? createdByMeSet.has(id)
      : g.createdBy?.toString() === userId;

  return {
    id,
    name: g.name.replace(/\\n/g, "\n"),
    membersLabel: formatCountLabel(g.memberCount ?? 0, "members"),
    memberCount: g.memberCount ?? 0,
    image: g.image ?? "",
    description: g.description ?? "",
    isMyGroup: !!isMyGroup,
    isJoined,
    isMember: isJoined,
    createdBy: g.createdBy?.toString() ?? null,
  };
}

async function loadGroupContext(userId?: string) {
  let memberSet = new Set<string>();
  let createdByMeSet = new Set<string>();

  if (!userId) return { memberSet, createdByMeSet };

  const [memberships, owned] = await Promise.all([
    GroupMember.find({ user: userId }).select("group").lean(),
    Group.find({ createdBy: userId }).select("_id").lean(),
  ]);

  memberSet = new Set(memberships.map((m) => m.group.toString()));
  createdByMeSet = new Set(owned.map((g) => g._id.toString()));

  return { memberSet, createdByMeSet };
}

async function assertGroupManager(
  groupId: string,
  userId: string
): Promise<{ group: GroupMutable }> {
  const group = await Group.findById(groupId);
  if (!group) {
    const err = new Error("Group not found");
    (err as Error & { statusCode?: number }).statusCode = 404;
    throw err;
  }
  const doc = group as unknown as GroupMutable;
  if (group.createdBy?.toString() === userId) {
    return { group: doc };
  }
  const member = await GroupMember.findOne({
    group: groupId,
    user: userId,
    role: { $in: ["owner", "admin"] },
  });
  if (!member) {
    const err = new Error("Not allowed");
    (err as Error & { statusCode?: number }).statusCode = 403;
    throw err;
  }
  return { group: doc };
}

function applyGroupInput(group: GroupMutable, input: NormalizedGroupInput, partial = false) {
  if (!partial || input.name) group.name = input.name;
  if (!partial || input.image) group.image = input.image;
  if (!partial || input.description !== undefined) {
    if (!partial || input.description) group.description = input.description;
  }
}

export async function listGroups(opts: {
  userId?: string;
  q?: string;
  tab?: "joined" | "my";
  mine?: boolean;
}) {
  const q = opts.q?.trim();
  const rx = q
    ? new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i")
    : null;
  const filter = rx ? { $or: [{ name: rx }, { description: rx }] } : {};

  let docs = await Group.find(filter).sort({ memberCount: -1 }).limit(100).lean();
  const { memberSet, createdByMeSet } = await loadGroupContext(opts.userId);

  const tab = opts.tab ?? (opts.mine ? "my" : undefined);

  if (opts.userId && tab === "joined") {
    docs = docs.filter((d) => memberSet.has(d._id.toString()));
  }
  if (opts.userId && tab === "my") {
    docs = docs.filter((d) => createdByMeSet.has(d._id.toString()));
  }

  return docs.map((g) =>
    mapGroup(g as GroupDoc, opts.userId, memberSet, createdByMeSet)
  );
}

export async function discoverGroups(opts: { userId?: string; q?: string }) {
  const q = opts.q?.trim();
  const rx = q
    ? new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i")
    : null;
  const filter = rx ? { $or: [{ name: rx }, { description: rx }] } : {};

  let docs = await Group.find(filter).sort({ memberCount: -1 }).limit(100).lean();
  const { memberSet, createdByMeSet } = await loadGroupContext(opts.userId);

  if (opts.userId) {
    docs = docs.filter((d) => !memberSet.has(d._id.toString()));
  }

  return docs.map((g) => mapGroup(g as GroupDoc, opts.userId, memberSet, createdByMeSet));
}

export async function getGroup(groupId: string, userId?: string) {
  const g = await Group.findById(groupId).lean();
  if (!g) {
    const err = new Error("Group not found");
    (err as Error & { statusCode?: number }).statusCode = 404;
    throw err;
  }
  const { memberSet, createdByMeSet } = await loadGroupContext(userId);
  const mapped = mapGroup(g as GroupDoc, userId, memberSet, createdByMeSet);

  let myRole: GroupMemberRole | null = null;
  if (userId) {
    if (g.createdBy?.toString() === userId) {
      myRole = "owner";
    } else {
      const m = await GroupMember.findOne({ user: userId, group: groupId }).lean();
      myRole = (m?.role as GroupMemberRole) ?? null;
    }
  }

  return {
    ...mapped,
    myRole,
    isCreatorOrAdmin: myRole === "owner" || myRole === "admin",
  };
}

export async function createGroup(
  userId: string,
  body: Record<string, unknown> | null | undefined
) {
  const input = normalizeGroupInput(body);
  const validationError = validateCreateGroupInput(input);
  if (validationError) {
    const err = new Error(validationError);
    (err as Error & { statusCode?: number }).statusCode = 400;
    throw err;
  }

  const g = await Group.create({
    name: input.name,
    image: input.image,
    description: input.description,
    createdBy: userId,
    memberCount: 1,
  });

  await GroupMember.create({ user: userId, group: g._id, role: "owner" });

  return getGroup(g._id.toString(), userId);
}

export async function updateGroup(
  groupId: string,
  userId: string,
  body: Record<string, unknown> | null | undefined
) {
  const { group } = await assertGroupManager(groupId, userId);
  const input = normalizeGroupInput(body);
  if (!input.name && (body as { name?: string })?.name === "") {
    const err = new Error("Group name is required");
    (err as Error & { statusCode?: number }).statusCode = 400;
    throw err;
  }
  applyGroupInput(group, input, true);
  if (input.name) group.name = input.name;
  await group.save();
  return getGroup(groupId, userId);
}

export async function deleteGroup(groupId: string, userId: string) {
  const group = await Group.findById(groupId);
  if (!group) {
    const err = new Error("Group not found");
    (err as Error & { statusCode?: number }).statusCode = 404;
    throw err;
  }
  if (group.createdBy?.toString() !== userId) {
    const err = new Error("Only the group owner can delete");
    (err as Error & { statusCode?: number }).statusCode = 403;
    throw err;
  }
  await Promise.all([
    GroupMember.deleteMany({ group: groupId }),
    group.deleteOne(),
  ]);
  return { ok: true };
}

export async function joinGroup(userId: string, groupId: string) {
  const g = await Group.findById(groupId);
  if (!g) {
    const err = new Error("Group not found");
    (err as Error & { statusCode?: number }).statusCode = 404;
    throw err;
  }
  const ex = await GroupMember.findOne({ user: userId, group: groupId });
  if (ex) {
    const err = new Error("Already a member");
    (err as Error & { statusCode?: number }).statusCode = 400;
    throw err;
  }
  await GroupMember.create({ user: userId, group: groupId, role: "member" });
  g.memberCount += 1;
  await g.save();
  return getGroup(groupId, userId);
}

export async function leaveGroup(userId: string, groupId: string) {
  const g = await Group.findById(groupId);
  if (!g) {
    const err = new Error("Group not found");
    (err as Error & { statusCode?: number }).statusCode = 404;
    throw err;
  }
  if (g.createdBy?.toString() === userId) {
    const err = new Error("Owner cannot leave; delete the group or transfer ownership first");
    (err as Error & { statusCode?: number }).statusCode = 400;
    throw err;
  }
  const ex = await GroupMember.findOne({ user: userId, group: groupId });
  if (!ex) {
    const err = new Error("Not a member");
    (err as Error & { statusCode?: number }).statusCode = 400;
    throw err;
  }
  await ex.deleteOne();
  g.memberCount = Math.max(0, g.memberCount - 1);
  await g.save();
  return { ok: true, memberCount: g.memberCount };
}

export async function listGroupMembers(groupId: string, userId: string) {
  const g = await Group.findById(groupId);
  if (!g) {
    const err = new Error("Group not found");
    (err as Error & { statusCode?: number }).statusCode = 404;
    throw err;
  }
  const membership = await GroupMember.findOne({ user: userId, group: groupId });
  if (!membership && g.createdBy?.toString() !== userId) {
    const err = new Error("Not a member of this group");
    (err as Error & { statusCode?: number }).statusCode = 403;
    throw err;
  }

  const members = await GroupMember.find({ group: groupId })
    .populate("user", "name email avatar")
    .sort({ role: 1, createdAt: 1 })
    .lean();

  return members.map((m) => ({
    id: m._id.toString(),
    userId: (m.user as { _id?: mongoose.Types.ObjectId })?._id?.toString() ?? "",
    name: (m.user as { name?: string })?.name ?? "",
    email: (m.user as { email?: string })?.email ?? "",
    avatar: (m.user as { avatar?: string })?.avatar ?? "",
    role: m.role as GroupMemberRole,
    joinedAt: m.createdAt,
  }));
}

export async function listInviteCandidates(
  groupId: string,
  actorId: string,
  q?: string
) {
  await assertGroupManager(groupId, actorId);

  const existing = await GroupMember.find({ group: groupId }).select("user").lean();
  const exclude = new Set(existing.map((m) => m.user.toString()));
  exclude.add(actorId);

  const search = q?.trim();
  const rx = search
    ? new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i")
    : null;

  const excludeIds = [...exclude]
    .filter((id) => mongoose.isValidObjectId(id))
    .map((id) => new mongoose.Types.ObjectId(id));

  const userFilter = rx
    ? { $or: [{ name: rx }, { email: rx }], _id: { $nin: excludeIds } }
    : { _id: { $nin: excludeIds } };

  const users = await User.find(userFilter)
    .select("name email avatar")
    .sort({ name: 1 })
    .limit(50)
    .lean();

  return users.map((u) => ({
    id: u._id.toString(),
    name: u.name,
    avatar: u.avatar ?? "",
    email: u.email,
  }));
}

export async function inviteToGroup(
  inviterId: string,
  groupId: string,
  opts: { userIds?: string[]; emails?: string[] }
) {
  const g = await Group.findById(groupId);
  if (!g) {
    const err = new Error("Group not found");
    (err as Error & { statusCode?: number }).statusCode = 404;
    throw err;
  }

  const inviterMember = await GroupMember.findOne({
    user: inviterId,
    group: groupId,
    role: { $in: ["owner", "admin"] },
  });
  if (!inviterMember && g.createdBy?.toString() !== inviterId) {
    const err = new Error("Not allowed to invite");
    (err as Error & { statusCode?: number }).statusCode = 403;
    throw err;
  }

  const targetIds = new Set<string>();

  for (const uid of opts.userIds ?? []) {
    if (mongoose.isValidObjectId(uid)) targetIds.add(uid);
  }

  for (const email of opts.emails ?? []) {
    const trimmed = email.trim().toLowerCase();
    if (!trimmed) continue;
    const u = await User.findOne({ email: trimmed });
    if (u) targetIds.add(u._id.toString());
  }

  let invited = 0;
  for (const uid of targetIds) {
    if (uid === inviterId) continue;
    const exists = await GroupMember.findOne({ user: uid, group: groupId });
    if (exists) continue;
    await GroupMember.create({ user: uid, group: groupId, role: "member" });
    g.memberCount += 1;
    invited += 1;
    await Notification.create({
      user: uid,
      title: "Group invite",
      body: `You were added to ${g.name}`,
      kind: "group_invite",
      refType: "group",
      refId: groupId,
    });
  }

  await g.save();
  return {
    invited,
    memberCount: g.memberCount,
    membersLabel: formatCountLabel(g.memberCount, "members"),
  };
}

export async function addGroupMember(
  groupId: string,
  actorId: string,
  body: { userId?: string; email?: string; role?: GroupMemberRole }
) {
  await assertGroupManager(groupId, actorId);

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

  const role: GroupMemberRole =
    body.role === "admin" || body.role === "member" ? body.role : "member";

  const g = await Group.findById(groupId);
  if (!g) {
    const err = new Error("Group not found");
    (err as Error & { statusCode?: number }).statusCode = 404;
    throw err;
  }

  const ex = await GroupMember.findOne({ group: groupId, user: targetUserId });
  if (ex) {
    const err = new Error("User is already a member");
    (err as Error & { statusCode?: number }).statusCode = 400;
    throw err;
  }

  await GroupMember.create({ group: groupId, user: targetUserId, role });
  g.memberCount += 1;
  await g.save();

  const user = await User.findById(targetUserId).select("name email avatar").lean();
  return {
    member: {
      userId: targetUserId,
      name: user?.name ?? "",
      email: user?.email ?? "",
      avatar: user?.avatar ?? "",
      role,
    },
    memberCount: g.memberCount,
    membersLabel: formatCountLabel(g.memberCount, "members"),
  };
}

export async function removeGroupMember(
  groupId: string,
  actorId: string,
  targetUserId: string
) {
  await assertGroupManager(groupId, actorId);

  const g = await Group.findById(groupId);
  if (!g) {
    const err = new Error("Group not found");
    (err as Error & { statusCode?: number }).statusCode = 404;
    throw err;
  }

  if (g.createdBy?.toString() === targetUserId) {
    const err = new Error("Cannot remove the group owner");
    (err as Error & { statusCode?: number }).statusCode = 400;
    throw err;
  }

  const ex = await GroupMember.findOne({ group: groupId, user: targetUserId });
  if (!ex) {
    const err = new Error("Member not found");
    (err as Error & { statusCode?: number }).statusCode = 404;
    throw err;
  }

  await ex.deleteOne();
  g.memberCount = Math.max(0, g.memberCount - 1);
  await g.save();
  return { ok: true, memberCount: g.memberCount };
}

export async function updateGroupMemberRole(
  groupId: string,
  actorId: string,
  targetUserId: string,
  role: GroupMemberRole
) {
  const g = await Group.findById(groupId);
  if (!g) {
    const err = new Error("Group not found");
    (err as Error & { statusCode?: number }).statusCode = 404;
    throw err;
  }
  if (g.createdBy?.toString() !== actorId) {
    const err = new Error("Only the group owner can change roles");
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

  const ex = await GroupMember.findOne({ group: groupId, user: targetUserId });
  if (!ex) {
    const err = new Error("Member not found");
    (err as Error & { statusCode?: number }).statusCode = 404;
    throw err;
  }

  ex.role = role;
  await ex.save();
  return { ok: true, userId: targetUserId, role };
}
