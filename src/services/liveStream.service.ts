import mongoose from "mongoose";
import { Church } from "../models/church.model.js";
import { ChurchMember } from "../models/churchMember.model.js";
import { Group } from "../models/group.model.js";
import { GroupMember } from "../models/groupMember.model.js";
import {
  LiveStreamSession,
  type ILiveStreamSession,
} from "../models/liveStreamSession.model.js";
import { User } from "../models/user.model.js";
import {
  buildChannelName,
  buildRtcToken,
  uidFromUserId,
} from "./agora.service.js";
import { getIo } from "../socket/ioSingleton.js";
import { notifyLiveSessionEnded } from "../socket/live.socket.js";

export type LiveScope = "church" | "group";

function httpError(message: string, statusCode: number) {
  const err = new Error(message);
  (err as Error & { statusCode?: number }).statusCode = statusCode;
  return err;
}

async function assertChurchManager(churchId: string, userId: string) {
  const church = await Church.findById(churchId);
  if (!church) throw httpError("Church not found", 404);
  if (church.createdBy?.toString() === userId) return church;
  const member = await ChurchMember.findOne({
    church: churchId,
    user: userId,
    role: { $in: ["owner", "admin"] },
  });
  if (!member) throw httpError("Not allowed to manage this church stream", 403);
  return church;
}

async function assertGroupManager(groupId: string, userId: string) {
  const group = await Group.findById(groupId);
  if (!group) throw httpError("Group not found", 404);
  if (group.createdBy?.toString() === userId) return group;
  const member = await GroupMember.findOne({
    group: groupId,
    user: userId,
    role: { $in: ["owner", "admin"] },
  });
  if (!member) throw httpError("Not allowed to manage this group stream", 403);
  return group;
}

function mapSession(
  session: ILiveStreamSession & { _id: mongoose.Types.ObjectId },
  host?: { name?: string; avatar?: string } | null
) {
  return {
    sessionId: session._id.toString(),
    churchId: session.churchId?.toString() ?? null,
    groupId: session.groupId?.toString() ?? null,
    channelName: session.channelName,
    title: session.title,
    status: session.status,
    viewerCount: session.viewerCount,
    hostUserId: session.hostUserId.toString(),
    hostName: host?.name ?? "Host",
    hostAvatar: host?.avatar ?? "",
    startedAt: session.startedAt,
    endedAt: session.endedAt ?? null,
  };
}

async function loadHost(userId: string) {
  const u = await User.findById(userId).select("name avatar").lean();
  return u ? { name: u.name, avatar: u.avatar ?? "" } : null;
}

async function findActiveSession(scope: LiveScope, entityId: string) {
  const filter =
    scope === "church"
      ? { churchId: entityId, status: "live" as const }
      : { groupId: entityId, status: "live" as const };
  return LiveStreamSession.findOne(filter).sort({ startedAt: -1 });
}

function emitStreamStarted(session: ReturnType<typeof mapSession>) {
  const io = getIo();
  if (!io) return;
  const room = session.churchId
    ? `live-scope:church:${session.churchId}`
    : `live-scope:group:${session.groupId}`;
  io.to(room).emit("stream-started", session);
  io.to(`live:${session.sessionId}`).emit("stream-started", session);
}

function emitStreamEnded(
  sessionId: string,
  payload: { reason?: string; churchId?: string | null; groupId?: string | null }
) {
  const io = getIo();
  if (!io) return;
  io.to(`live:${sessionId}`).emit("stream-ended", {
    sessionId,
    ...payload,
  });
  if (payload.churchId) {
    io.to(`live-scope:church:${payload.churchId}`).emit("stream-ended", {
      sessionId,
      ...payload,
    });
  }
  if (payload.groupId) {
    io.to(`live-scope:group:${payload.groupId}`).emit("stream-ended", {
      sessionId,
      ...payload,
    });
  }
}

export async function getLiveStatus(scope: LiveScope, entityId: string) {
  const session = await findActiveSession(scope, entityId);
  if (!session) {
    return { isLive: false as const, session: null };
  }
  const host = await loadHost(session.hostUserId.toString());
  return {
    isLive: true as const,
    session: mapSession(
      session as ILiveStreamSession & { _id: mongoose.Types.ObjectId },
      host
    ),
  };
}

export async function startLiveStream(opts: {
  scope: LiveScope;
  entityId: string;
  userId: string;
  title?: string;
}) {
  const { scope, entityId, userId } = opts;
  const title = (opts.title ?? "Live Stream").trim().slice(0, 120);

  if (scope === "church") {
    await assertChurchManager(entityId, userId);
  } else {
    await assertGroupManager(entityId, userId);
  }

  const existing = await findActiveSession(scope, entityId);
  if (existing) {
    if (existing.hostUserId.toString() !== userId) {
      throw httpError("A live stream is already active for this page", 409);
    }
    const host = await loadHost(userId);
    const uid = uidFromUserId(userId);
    const tokenData = buildRtcToken(existing.channelName, uid, "publisher");
    return {
      ...mapSession(
        existing as ILiveStreamSession & { _id: mongoose.Types.ObjectId },
        host
      ),
      ...tokenData,
      role: "publisher" as const,
    };
  }

  const channelName = buildChannelName(scope, entityId);
  const session = await LiveStreamSession.create({
    churchId: scope === "church" ? entityId : null,
    groupId: scope === "group" ? entityId : null,
    channelName,
    hostUserId: userId,
    title,
    status: "live",
    viewerCount: 0,
    startedAt: new Date(),
  });

  const host = await loadHost(userId);
  const mapped = mapSession(
    session as ILiveStreamSession & { _id: mongoose.Types.ObjectId },
    host
  );
  emitStreamStarted(mapped);

  const uid = uidFromUserId(userId);
  const tokenData = buildRtcToken(channelName, uid, "publisher");

  return {
    ...mapped,
    ...tokenData,
    role: "publisher" as const,
  };
}

export async function stopLiveStream(opts: {
  scope: LiveScope;
  entityId: string;
  userId: string;
}) {
  const { scope, entityId, userId } = opts;

  if (scope === "church") {
    await assertChurchManager(entityId, userId);
  } else {
    await assertGroupManager(entityId, userId);
  }

  const session = await findActiveSession(scope, entityId);
  if (!session) throw httpError("No active live stream", 404);

  session.status = "ended";
  session.endedAt = new Date();
  session.endedBy = new mongoose.Types.ObjectId(userId);
  await session.save();

  const sessionId = session._id.toString();
  emitStreamEnded(sessionId, {
    reason: "host_ended",
    churchId: session.churchId?.toString() ?? null,
    groupId: session.groupId?.toString() ?? null,
  });
  notifyLiveSessionEnded(sessionId);

  return {
    sessionId,
    status: "ended" as const,
  };
}

export async function joinLiveStream(opts: {
  scope: LiveScope;
  entityId: string;
  userId: string;
}) {
  const { scope, entityId, userId } = opts;
  const session = await findActiveSession(scope, entityId);
  if (!session) throw httpError("No live stream is active", 404);

  const host = await loadHost(session.hostUserId.toString());
  const uid = uidFromUserId(userId);
  const tokenData = buildRtcToken(session.channelName, uid, "subscriber");

  return {
    ...mapSession(
      session as ILiveStreamSession & { _id: mongoose.Types.ObjectId },
      host
    ),
    ...tokenData,
    role: "subscriber" as const,
  };
}

export async function getSessionById(sessionId: string) {
  if (!mongoose.isValidObjectId(sessionId)) {
    throw httpError("Invalid session id", 400);
  }
  const session = await LiveStreamSession.findById(sessionId);
  if (!session) throw httpError("Session not found", 404);
  const host = await loadHost(session.hostUserId.toString());
  return mapSession(
    session as ILiveStreamSession & { _id: mongoose.Types.ObjectId },
    host
  );
}

export async function incrementViewerCount(sessionId: string, delta: number) {
  if (!mongoose.isValidObjectId(sessionId)) return;
  await LiveStreamSession.findByIdAndUpdate(sessionId, {
    $inc: { viewerCount: delta },
  });
}

export async function syncViewerCount(sessionId: string, count: number) {
  if (!mongoose.isValidObjectId(sessionId)) return;
  await LiveStreamSession.findByIdAndUpdate(sessionId, {
    viewerCount: Math.max(0, count),
  });
}
