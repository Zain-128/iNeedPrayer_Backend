import mongoose from "mongoose";
import { Group } from "../models/group.model.js";
import { GroupMember } from "../models/groupMember.model.js";
import { Notification } from "../models/notification.model.js";
import { formatCountLabel } from "../utils/mappers.js";

function mapGroup(
  g: {
    _id: mongoose.Types.ObjectId;
    name: string;
    image?: string;
    description?: string;
    memberCount: number;
    createdBy?: mongoose.Types.ObjectId | null;
  },
  userId?: string,
  memberSet?: Set<string>
) {
  const id = g._id.toString();
  return {
    id,
    name: g.name.replace(/\\n/g, "\n"),
    membersLabel: formatCountLabel(g.memberCount ?? 0, "members"),
    image: g.image ?? "",
    description: g.description ?? "",
    isMyGroup: userId
      ? memberSet?.has(id) ?? false
      : false,
    createdBy: g.createdBy?.toString() ?? null,
  };
}

export async function listGroups(opts: { userId?: string; q?: string; mine?: boolean }) {
  const q = opts.q?.trim();
  const rx = q
    ? new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i")
    : null;
  const filter = rx ? { $or: [{ name: rx }, { description: rx }] } : {};

  let docs = await Group.find(filter).sort({ memberCount: -1 }).limit(100).lean();

  if (opts.userId && opts.mine) {
    const memberships = await GroupMember.find({ user: opts.userId })
      .select("group")
      .lean();
    const ids = new Set(memberships.map((m) => m.group.toString()));
    docs = docs.filter((d) => ids.has(d._id.toString()));
  }

  let memberSet = new Set<string>();
  if (opts.userId) {
    const memberships = await GroupMember.find({ user: opts.userId }).lean();
    memberSet = new Set(memberships.map((m) => m.group.toString()));
  }

  return docs.map((g) => mapGroup(g, opts.userId, memberSet));
}

export async function getGroup(groupId: string, userId?: string) {
  const g = await Group.findById(groupId).lean();
  if (!g) {
    const err = new Error("Group not found");
    (err as Error & { statusCode?: number }).statusCode = 404;
    throw err;
  }
  let memberSet = new Set<string>();
  if (userId) {
    const m = await GroupMember.find({ user: userId }).lean();
    memberSet = new Set(m.map((x) => x.group.toString()));
  }
  return {
    ...mapGroup(g, userId, memberSet),
    isMember: userId ? memberSet.has(groupId) : false,
  };
}

export async function createGroup(
  userId: string,
  body: { name: string; image?: string; description?: string }
) {
  if (!body.name?.trim()) {
    const err = new Error("Name is required");
    (err as Error & { statusCode?: number }).statusCode = 400;
    throw err;
  }
  const g = await Group.create({
    name: body.name.trim(),
    image: body.image?.trim() ?? "",
    description: body.description?.trim() ?? "",
    createdBy: userId,
    memberCount: 1,
  });
  await GroupMember.create({ user: userId, group: g._id, role: "admin" });
  return getGroup(g._id.toString(), userId);
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
  await GroupMember.create({ user: userId, group: groupId });
  g.memberCount += 1;
  await g.save();
  return getGroup(groupId, userId);
}

export async function leaveGroup(userId: string, groupId: string) {
  const ex = await GroupMember.findOne({ user: userId, group: groupId });
  if (!ex) {
    const err = new Error("Not a member");
    (err as Error & { statusCode?: number }).statusCode = 400;
    throw err;
  }
  await ex.deleteOne();
  await Group.findByIdAndUpdate(groupId, { $inc: { memberCount: -1 } });
  const g = await Group.findById(groupId);
  if (g && g.memberCount < 0) {
    g.memberCount = 0;
    await g.save();
  }
}

export async function inviteToGroup(
  inviterId: string,
  groupId: string,
  userIds: string[]
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
  });
  if (!inviterMember) {
    const err = new Error("Not a member of this group");
    (err as Error & { statusCode?: number }).statusCode = 403;
    throw err;
  }
  let added = 0;
  for (const uid of userIds) {
    if (uid === inviterId) continue;
    const exists = await GroupMember.findOne({ user: uid, group: groupId });
    if (exists) continue;
    await GroupMember.create({ user: uid, group: groupId });
    g.memberCount += 1;
    added += 1;
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
  return { invited: added };
}
