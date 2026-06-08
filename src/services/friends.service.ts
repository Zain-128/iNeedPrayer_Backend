import mongoose from "mongoose";
import { FriendRequest } from "../models/friendRequest.model.js";
import { User } from "../models/user.model.js";
import { UserBlock } from "../models/userBlock.model.js";
import { mapAuthor } from "../utils/mappers.js";

function httpError(message: string, statusCode: number) {
  const err = new Error(message);
  (err as Error & { statusCode?: number }).statusCode = statusCode;
  return err;
}

async function assertNotBlocked(a: string, b: string) {
  const blocked = await UserBlock.findOne({
    $or: [
      { blocker: a, blocked: b },
      { blocker: b, blocked: a },
    ],
  });
  if (blocked) throw httpError("Cannot perform this action", 403);
}

async function assertUserExists(userId: string) {
  const exists = await User.exists({ _id: userId });
  if (!exists) throw httpError("User not found", 404);
}

export async function areFriends(userA: string, userB: string) {
  const row = await FriendRequest.findOne({
    status: "accepted",
    $or: [
      { from: userA, to: userB },
      { from: userB, to: userA },
    ],
  });
  return !!row;
}

export async function sendFriendRequest(fromId: string, toId: string) {
  if (fromId === toId) throw httpError("Cannot send request to yourself", 400);
  await assertUserExists(toId);
  await assertNotBlocked(fromId, toId);

  if (await areFriends(fromId, toId)) {
    return { status: "accepted" as const, message: "Already friends" };
  }

  const reversePending = await FriendRequest.findOne({
    from: toId,
    to: fromId,
    status: "pending",
  });
  if (reversePending) {
    reversePending.status = "accepted";
    await reversePending.save();
    return { status: "accepted" as const, message: "Friend request accepted" };
  }

  const existing = await FriendRequest.findOne({ from: fromId, to: toId });
  if (existing?.status === "pending") {
    return { status: "pending" as const, message: "Request already sent" };
  }
  if (existing?.status === "accepted") {
    return { status: "accepted" as const, message: "Already friends" };
  }

  await FriendRequest.findOneAndUpdate(
    { from: fromId, to: toId },
    { status: "pending" },
    { upsert: true, new: true }
  );
  return { status: "pending" as const, message: "Friend request sent" };
}

export async function acceptFriendRequest(accepterId: string, requesterId: string) {
  if (accepterId === requesterId) throw httpError("Invalid request", 400);
  await assertNotBlocked(accepterId, requesterId);

  const row = await FriendRequest.findOne({
    from: requesterId,
    to: accepterId,
    status: "pending",
  });
  if (!row) throw httpError("Friend request not found", 404);

  row.status = "accepted";
  await row.save();
  return { status: "accepted" as const, message: "Friend request accepted" };
}

export async function rejectFriendRequest(accepterId: string, requesterId: string) {
  if (accepterId === requesterId) throw httpError("Invalid request", 400);

  const row = await FriendRequest.findOne({
    from: requesterId,
    to: accepterId,
    status: "pending",
  });
  if (!row) throw httpError("Friend request not found", 404);

  row.status = "rejected";
  await row.save();
  return { message: "Friend request rejected" };
}

export async function listFriends(userId: string) {
  const rows = await FriendRequest.find({
    status: "accepted",
    $or: [{ from: userId }, { to: userId }],
  })
    .populate("from", "name avatar city state country")
    .populate("to", "name avatar city state country")
    .lean();

  const blocked = await UserBlock.find({
    $or: [{ blocker: userId }, { blocked: userId }],
  }).lean();
  const hide = new Set<string>();
  for (const b of blocked) {
    if (b.blocker.toString() === userId) hide.add(b.blocked.toString());
    else hide.add(b.blocker.toString());
  }

  const friends = rows
    .map((r) => {
      const peer =
        r.from._id.toString() === userId
          ? (r.to as unknown as Parameters<typeof mapAuthor>[0])
          : (r.from as unknown as Parameters<typeof mapAuthor>[0]);
      return mapAuthor(peer);
    })
    .filter((u) => !hide.has(u.id));

  return friends;
}

function mapRequestUser(row: {
  _id: { toString(): string };
  from: unknown;
  to: unknown;
  createdAt: Date;
}, peerField: "from" | "to") {
  const peer = row[peerField] as {
    _id?: mongoose.Types.ObjectId;
    name?: string;
    avatar?: string;
    city?: string;
    state?: string;
    country?: string;
  };
  return {
    requestId: row._id.toString(),
    user: mapAuthor(peer as Parameters<typeof mapAuthor>[0]),
    requestedAt: row.createdAt,
  };
}

export async function listIncomingFriendRequests(userId: string) {
  const rows = await FriendRequest.find({ to: userId, status: "pending" })
    .populate("from", "name avatar city state country")
    .sort({ createdAt: -1 })
    .lean();

  const hide = await UserBlock.find({
    $or: [{ blocker: userId }, { blocked: userId }],
  }).lean();
  const blocked = new Set<string>();
  for (const b of hide) {
    if (b.blocker.toString() === userId) blocked.add(b.blocked.toString());
    else blocked.add(b.blocker.toString());
  }

  return rows
    .filter((r) => !blocked.has(r.from._id.toString()))
    .map((r) => mapRequestUser(r as never, "from"));
}

export async function listOutgoingFriendRequests(userId: string) {
  const rows = await FriendRequest.find({ from: userId, status: "pending" })
    .populate("to", "name avatar city state country")
    .sort({ createdAt: -1 })
    .lean();

  const hide = await UserBlock.find({
    $or: [{ blocker: userId }, { blocked: userId }],
  }).lean();
  const blocked = new Set<string>();
  for (const b of hide) {
    if (b.blocker.toString() === userId) blocked.add(b.blocked.toString());
    else blocked.add(b.blocker.toString());
  }

  return rows
    .filter((r) => !blocked.has(r.to._id.toString()))
    .map((r) => mapRequestUser(r as never, "to"));
}

export async function cancelFriendRequest(fromId: string, toId: string) {
  if (fromId === toId) throw httpError("Invalid request", 400);

  const row = await FriendRequest.findOne({
    from: fromId,
    to: toId,
    status: "pending",
  });
  if (!row) throw httpError("Friend request not found", 404);

  await row.deleteOne();
  return { message: "Friend request cancelled" };
}

export async function removeFriend(userId: string, friendId: string) {
  if (userId === friendId) throw httpError("Invalid request", 400);

  const row = await FriendRequest.findOne({
    status: "accepted",
    $or: [
      { from: userId, to: friendId },
      { from: friendId, to: userId },
    ],
  });
  if (!row) throw httpError("Friend not found", 404);

  await row.deleteOne();
  return { message: "Friend removed" };
}

export async function getFriendRequestStatus(
  viewerId: string,
  targetUserId: string
): Promise<"none" | "pending_sent" | "pending_received" | "friends"> {
  if (viewerId === targetUserId) return "none";
  if (await areFriends(viewerId, targetUserId)) return "friends";
  const sent = await FriendRequest.findOne({
    from: viewerId,
    to: targetUserId,
    status: "pending",
  });
  if (sent) return "pending_sent";
  const received = await FriendRequest.findOne({
    from: targetUserId,
    to: viewerId,
    status: "pending",
  });
  if (received) return "pending_received";
  return "none";
}
