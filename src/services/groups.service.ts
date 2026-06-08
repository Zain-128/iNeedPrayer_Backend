import mongoose from "mongoose";
import { Group } from "../models/group.model.js";
import { GroupMember } from "../models/groupMember.model.js";
import { GroupInvite } from "../models/groupInvite.model.js";
import { GroupJoinRequest } from "../models/groupJoinRequest.model.js";
import { GroupMute } from "../models/groupMute.model.js";
import { Notification } from "../models/notification.model.js";
import { User } from "../models/user.model.js";
import * as postsService from "./posts.service.js";
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

function httpError(message: string, statusCode: number) {
  const err = new Error(message);
  (err as Error & { statusCode?: number }).statusCode = statusCode;
  return err;
}

async function assertGroupMember(groupId: string, userId: string) {
  const group = await Group.findById(groupId);
  if (!group) throw httpError("Group not found", 404);
  const membership = await GroupMember.findOne({ user: userId, group: groupId });
  if (!membership && group.createdBy?.toString() !== userId) {
    throw httpError("Not a member of this group", 403);
  }
  return { group, membership };
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
    GroupInvite.deleteMany({ group: groupId }),
    GroupJoinRequest.deleteMany({ group: groupId }),
    GroupMute.deleteMany({ group: groupId }),
    group.deleteOne(),
  ]);
  return { ok: true };
}

async function addGroupMemberDirect(groupId: string, userId: string) {
  const g = await Group.findById(groupId);
  if (!g) throw httpError("Group not found", 404);

  const ex = await GroupMember.findOne({ user: userId, group: groupId });
  if (ex) throw httpError("Already a member", 400);

  const pendingInvite = await GroupInvite.findOne({
    group: groupId,
    user: userId,
    status: "pending",
  });
  if (pendingInvite) {
    pendingInvite.status = "accepted";
    await pendingInvite.save();
  }

  await GroupMember.create({ user: userId, group: groupId, role: "member" });
  g.memberCount += 1;
  await g.save();
  return g;
}

export async function joinGroup(userId: string, groupId: string) {
  const g = await Group.findById(groupId);
  if (!g) throw httpError("Group not found", 404);

  const ex = await GroupMember.findOne({ user: userId, group: groupId });
  if (ex) throw httpError("Already a member", 400);

  if (g.requiresApproval) {
    const existing = await GroupJoinRequest.findOne({ group: groupId, user: userId });
    if (existing?.status === "pending") {
      return { status: "pending" as const, message: "Join request already pending" };
    }
    if (existing?.status === "rejected") {
      existing.status = "pending";
      await existing.save();
    } else if (!existing) {
      await GroupJoinRequest.create({ group: groupId, user: userId, status: "pending" });
    }

    const admins = await GroupMember.find({
      group: groupId,
      role: { $in: ["owner", "admin"] },
    }).select("user");
    const ownerId = g.createdBy?.toString();
    const notifyIds = new Set(admins.map((a) => a.user.toString()));
    if (ownerId) notifyIds.add(ownerId);

    await Promise.all(
      [...notifyIds].map((adminId) =>
        Notification.create({
          user: adminId,
          title: "Join request",
          body: `Someone requested to join ${g.name}`,
          kind: "group_join_request",
          refType: "group",
          refId: groupId,
        })
      )
    );

    return { status: "pending" as const, message: "Join request submitted" };
  }

  await addGroupMemberDirect(groupId, userId);
  const group = await getGroup(groupId, userId);
  return { status: "joined" as const, group };
}

function mapJoinRequest(row: {
  _id: { toString(): string };
  user: unknown;
  status: string;
  createdAt: Date;
}) {
  return {
    id: row._id.toString(),
    userId: (row.user as { _id?: mongoose.Types.ObjectId })?._id?.toString() ?? "",
    name: (row.user as { name?: string })?.name ?? "",
    email: (row.user as { email?: string })?.email ?? "",
    avatar: (row.user as { avatar?: string })?.avatar ?? "",
    status: row.status,
    requestedAt: row.createdAt,
  };
}

export async function listPendingJoinRequests(groupId: string, actorId: string) {
  await assertGroupManager(groupId, actorId);

  const rows = await GroupJoinRequest.find({ group: groupId, status: "pending" })
    .populate("user", "name email avatar")
    .sort({ createdAt: -1 })
    .lean();

  return rows.map(mapJoinRequest);
}

export async function approveJoinRequest(
  groupId: string,
  actorId: string,
  targetUserId: string
) {
  await assertGroupManager(groupId, actorId);

  const request = await GroupJoinRequest.findOne({
    group: groupId,
    user: targetUserId,
    status: "pending",
  });
  if (!request) throw httpError("Join request not found", 404);

  await addGroupMemberDirect(groupId, targetUserId);
  request.status = "approved";
  await request.save();

  const g = await Group.findById(groupId);
  await Notification.create({
    user: targetUserId,
    title: "Join request approved",
    body: `You were approved to join ${g?.name ?? "the group"}`,
    kind: "group_join_approved",
    refType: "group",
    refId: groupId,
  });

  return { ok: true, userId: targetUserId, status: "approved" };
}

export async function rejectJoinRequest(
  groupId: string,
  actorId: string,
  targetUserId: string
) {
  await assertGroupManager(groupId, actorId);

  const request = await GroupJoinRequest.findOne({
    group: groupId,
    user: targetUserId,
    status: "pending",
  });
  if (!request) throw httpError("Join request not found", 404);

  request.status = "rejected";
  await request.save();

  const g = await Group.findById(groupId);
  await Notification.create({
    user: targetUserId,
    title: "Join request declined",
    body: `Your request to join ${g?.name ?? "the group"} was declined`,
    kind: "group_join_rejected",
    refType: "group",
    refId: groupId,
  });

  return { ok: true, userId: targetUserId, status: "rejected" };
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

  const [existingMembers, pendingInvites] = await Promise.all([
    GroupMember.find({ group: groupId }).select("user").lean(),
    GroupInvite.find({ group: groupId, status: "pending" }).select("user").lean(),
  ]);
  const exclude = new Set([
    ...existingMembers.map((m) => m.user.toString()),
    ...pendingInvites.map((i) => i.user.toString()),
  ]);
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

    const isMember = await GroupMember.findOne({ user: uid, group: groupId });
    if (isMember) continue;

    const existingInvite = await GroupInvite.findOne({ user: uid, group: groupId });
    if (existingInvite?.status === "pending") continue;
    if (existingInvite?.status === "accepted") continue;

    if (existingInvite) {
      existingInvite.status = "pending";
      existingInvite.invitedBy = new mongoose.Types.ObjectId(inviterId);
      await existingInvite.save();
    } else {
      await GroupInvite.create({
        group: groupId,
        user: uid,
        invitedBy: inviterId,
        status: "pending",
      });
    }

    invited += 1;
    await Notification.create({
      user: uid,
      title: "Group invite",
      body: `You were invited to join ${g.name}`,
      kind: "group_invite",
      refType: "group",
      refId: groupId,
    });
  }

  return {
    invited,
    memberCount: g.memberCount,
    membersLabel: formatCountLabel(g.memberCount, "members"),
  };
}

export type GroupInviteStatusFilter =
  | "all"
  | "invited"
  | "pending"
  | "accepted"
  | "rejected";

function mapGroupInvite(inv: {
  _id: { toString(): string };
  user: unknown;
  invitedBy: unknown;
  status: string;
  createdAt: Date;
}) {
  return {
    id: inv._id.toString(),
    userId: (inv.user as { _id?: mongoose.Types.ObjectId })?._id?.toString() ?? "",
    name: (inv.user as { name?: string })?.name ?? "",
    email: (inv.user as { email?: string })?.email ?? "",
    avatar: (inv.user as { avatar?: string })?.avatar ?? "",
    status: inv.status,
    invitedBy: {
      id:
        (inv.invitedBy as { _id?: mongoose.Types.ObjectId })?._id?.toString() ?? "",
      name: (inv.invitedBy as { name?: string })?.name ?? "",
      avatar: (inv.invitedBy as { avatar?: string })?.avatar ?? "",
    },
    invitedAt: inv.createdAt,
  };
}

export async function listGroupInvites(
  groupId: string,
  actorId: string,
  status: GroupInviteStatusFilter = "all"
) {
  await assertGroupManager(groupId, actorId);

  type InviteStatus = "pending" | "accepted" | "rejected";
  const filter: {
    group: string;
    status?: InviteStatus | { $in: InviteStatus[] };
  } = { group: groupId };

  if (status === "pending") {
    filter.status = "pending";
  } else if (status === "accepted") {
    filter.status = "accepted";
  } else if (status === "rejected") {
    filter.status = "rejected";
  } else if (status === "invited") {
    filter.status = { $in: ["pending", "accepted"] };
  }

  const invites = await GroupInvite.find(filter)
    .populate("user", "name email avatar")
    .populate("invitedBy", "name avatar")
    .sort({ createdAt: -1 })
    .lean();

  return invites.map(mapGroupInvite);
}

async function findGroupInvite(groupId: string, targetUserId: string) {
  const invite = await GroupInvite.findOne({
    group: groupId,
    user: targetUserId,
  })
    .populate("user", "name email avatar")
    .populate("invitedBy", "name avatar");
  if (!invite) throw httpError("Invite not found", 404);
  return invite;
}

async function fulfillGroupInvite(groupId: string, userId: string) {
  const g = await Group.findById(groupId);
  if (!g) throw httpError("Group not found", 404);

  const existing = await GroupMember.findOne({ user: userId, group: groupId });
  if (existing) throw httpError("Already a member", 400);

  await GroupMember.create({ user: userId, group: groupId, role: "member" });
  g.memberCount += 1;
  await g.save();
}

export async function cancelGroupInvite(
  groupId: string,
  actorId: string,
  targetUserId: string
) {
  await assertGroupManager(groupId, actorId);
  const invite = await findGroupInvite(groupId, targetUserId);
  if (invite.status !== "pending") {
    throw httpError("Only pending invites can be cancelled", 400);
  }
  await invite.deleteOne();
  return { ok: true };
}

export async function resendGroupInvite(
  groupId: string,
  actorId: string,
  targetUserId: string
) {
  await assertGroupManager(groupId, actorId);
  const g = await Group.findById(groupId);
  if (!g) throw httpError("Group not found", 404);

  const invite = await findGroupInvite(groupId, targetUserId);

  const isMember = await GroupMember.findOne({ user: targetUserId, group: groupId });
  if (isMember) throw httpError("User is already a member", 400);
  if (invite.status === "pending") {
    throw httpError("Invite is already pending", 400);
  }
  if (invite.status === "accepted") {
    throw httpError("Invite already accepted", 400);
  }

  invite.status = "pending";
  invite.invitedBy = new mongoose.Types.ObjectId(actorId);
  await invite.save();

  await Notification.create({
    user: targetUserId,
    title: "Group invite",
    body: `You were invited to join ${g.name}`,
    kind: "group_invite",
    refType: "group",
    refId: groupId,
  });

  return { invite: mapGroupInvite(invite.toObject()) };
}

export async function acceptGroupInvite(
  groupId: string,
  actorId: string,
  targetUserId: string
) {
  if (actorId !== targetUserId) {
    throw httpError("You can only accept your own invite", 403);
  }

  const invite = await findGroupInvite(groupId, targetUserId);
  if (invite.status === "accepted") {
    throw httpError("Invite already accepted", 400);
  }
  if (invite.status === "rejected") {
    throw httpError("Invite was rejected", 400);
  }

  await fulfillGroupInvite(groupId, targetUserId);
  invite.status = "accepted";
  await invite.save();

  const group = await getGroup(groupId, actorId);
  return { group, invite: mapGroupInvite(invite.toObject()) };
}

export async function rejectGroupInvite(
  groupId: string,
  actorId: string,
  targetUserId: string
) {
  if (actorId !== targetUserId) {
    throw httpError("You can only reject your own invite", 403);
  }

  const invite = await findGroupInvite(groupId, targetUserId);
  if (invite.status === "accepted") {
    throw httpError("Invite already accepted", 400);
  }
  if (invite.status === "rejected") {
    throw httpError("Invite already rejected", 400);
  }

  invite.status = "rejected";
  await invite.save();
  return { invite: mapGroupInvite(invite.toObject()) };
}

export async function listGroupPosts(
  groupId: string,
  userId: string,
  opts: { page?: number; limit?: number; q?: string; lang?: string }
) {
  await assertGroupMember(groupId, userId);
  return postsService.listPosts({
    viewerId: userId,
    groupId,
    page: opts.page,
    limit: opts.limit,
    q: opts.q,
    lang: opts.lang,
  });
}

export async function listGroupAdmins(groupId: string, userId: string) {
  await assertGroupMember(groupId, userId);

  const g = await Group.findById(groupId).lean();
  if (!g) throw httpError("Group not found", 404);

  const admins = await GroupMember.find({
    group: groupId,
    role: { $in: ["owner", "admin"] },
  })
    .populate("user", "name email avatar")
    .sort({ role: 1, createdAt: 1 })
    .lean();

  return admins.map((m) => ({
    id: m._id.toString(),
    userId: (m.user as { _id?: mongoose.Types.ObjectId })?._id?.toString() ?? "",
    name: (m.user as { name?: string })?.name ?? "",
    email: (m.user as { email?: string })?.email ?? "",
    avatar: (m.user as { avatar?: string })?.avatar ?? "",
    role: m.role as GroupMemberRole,
    isOwner: g.createdBy?.toString() === (m.user as { _id?: mongoose.Types.ObjectId })?._id?.toString(),
  }));
}

export async function makeGroupAdmin(
  groupId: string,
  actorId: string,
  targetUserId: string
) {
  return updateGroupMemberRole(groupId, actorId, targetUserId, "admin");
}

export async function removeGroupAdmin(
  groupId: string,
  actorId: string,
  targetUserId: string
) {
  return updateGroupMemberRole(groupId, actorId, targetUserId, "member");
}

export async function muteGroup(groupId: string, userId: string) {
  await assertGroupMember(groupId, userId);
  await GroupMute.findOneAndUpdate(
    { user: userId, group: groupId },
    {},
    { upsert: true, new: true }
  );
  return { muted: true };
}

export async function unmuteGroup(groupId: string, userId: string) {
  await assertGroupMember(groupId, userId);
  await GroupMute.deleteOne({ user: userId, group: groupId });
  return { muted: false };
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
