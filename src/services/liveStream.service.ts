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
  type AgoraRole,
} from "./agora.service.js";
import { getIo } from "../socket/ioSingleton.js";
import { notifyLiveSessionEnded } from "../socket/live.socket.js";

export type LiveScope = "church" | "group";

/** In-memory set of active live session ids (avoids DB hit per comment). */
const activeLiveSessionIds = new Set<string>();

export function isSessionActiveInMemory(sessionId: string) {
  return activeLiveSessionIds.has(sessionId);
}

export function markSessionActive(sessionId: string) {
  activeLiveSessionIds.add(sessionId);
}

export function markSessionInactive(sessionId: string) {
  activeLiveSessionIds.delete(sessionId);
}

/** Restore in-memory active set after server restart. */
export async function bootstrapActiveLiveSessions() {
  const live = await LiveStreamSession.find({ status: "live" })
    .select("_id")
    .lean();
  for (const s of live) {
    activeLiveSessionIds.add(s._id.toString());
  }
}

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

async function endSessionRecord(
  session: mongoose.Document & ILiveStreamSession & { _id: mongoose.Types.ObjectId },
  opts: { endedBy?: string | null; reason: string }
) {
  session.status = "ended";
  session.endedAt = new Date();
  session.endedBy = opts.endedBy
    ? new mongoose.Types.ObjectId(opts.endedBy)
    : null;
  await session.save();

  const sessionId = session._id.toString();
  markSessionInactive(sessionId);
  emitStreamEnded(sessionId, {
    reason: opts.reason,
    churchId: session.churchId?.toString() ?? null,
    groupId: session.groupId?.toString() ?? null,
  });
  notifyLiveSessionEnded(sessionId);
  return sessionId;
}

export async function endStaleLiveSessions(maxAgeMs: number): Promise<number> {
  const cutoff = new Date(Date.now() - maxAgeMs);
  const stale = await LiveStreamSession.find({
    status: "live",
    $or: [
      { lastHeartbeatAt: { $lt: cutoff } },
      { lastHeartbeatAt: null, startedAt: { $lt: cutoff } },
    ],
  });

  for (const session of stale) {
    await endSessionRecord(
      session as mongoose.Document &
        ILiveStreamSession & { _id: mongoose.Types.ObjectId },
      { reason: "host_timeout", endedBy: null }
    );
  }

  return stale.length;
}

export async function recordHostHeartbeat(opts: {
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
  if (session.hostUserId.toString() !== userId) {
    throw httpError("Only the host can send heartbeat", 403);
  }

  session.lastHeartbeatAt = new Date();
  await session.save();
  markSessionActive(session._id.toString());

  return { ok: true as const, sessionId: session._id.toString() };
}

/** Single DB round-trip for socket heartbeats (host already verified at stream start). */
export async function touchHostHeartbeat(opts: {
  scope: LiveScope;
  entityId: string;
  userId: string;
}) {
  const { scope, entityId, userId } = opts;
  const filter =
    scope === "church"
      ? { churchId: entityId, status: "live" as const, hostUserId: userId }
      : { groupId: entityId, status: "live" as const, hostUserId: userId };

  const session = await LiveStreamSession.findOneAndUpdate(
    filter,
    { lastHeartbeatAt: new Date() },
    { new: true }
  ).select("_id");

  if (!session) throw httpError("No active live stream", 404);

  const sessionId = session._id.toString();
  markSessionActive(sessionId);
  return { ok: true as const, sessionId };
}

/** Lightweight live check for socket join (avoids loading host profile). */
export async function assertSessionIsLive(sessionId: string): Promise<boolean> {
  if (!mongoose.isValidObjectId(sessionId)) return false;

  if (isSessionActiveInMemory(sessionId)) return true;

  const session = await LiveStreamSession.findById(sessionId)
    .select("status")
    .lean();
  if (!session || session.status !== "live") {
    markSessionInactive(sessionId);
    return false;
  }

  markSessionActive(sessionId);
  return true;
}

export async function refreshLiveToken(opts: {
  scope: LiveScope;
  entityId: string;
  userId: string;
}) {
  const { scope, entityId, userId } = opts;
  const session = await findActiveSession(scope, entityId);
  if (!session) throw httpError("No active live stream", 404);

  const isHost = session.hostUserId.toString() === userId;
  let role: AgoraRole = "subscriber";

  if (isHost) {
    if (scope === "church") {
      await assertChurchManager(entityId, userId);
    } else {
      await assertGroupManager(entityId, userId);
    }
    role = "publisher";
    session.lastHeartbeatAt = new Date();
    await session.save();
  }

  const uid = uidFromUserId(userId);
  const tokenData = buildRtcToken(session.channelName, uid, role);

  return {
    sessionId: session._id.toString(),
    ...tokenData,
    role,
  };
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
    existing.lastHeartbeatAt = new Date();
    await existing.save();
    markSessionActive(existing._id.toString());
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
    lastHeartbeatAt: new Date(),
  });

  markSessionActive(session._id.toString());

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

  await endSessionRecord(
    session as mongoose.Document &
      ILiveStreamSession & { _id: mongoose.Types.ObjectId },
    { endedBy: userId, reason: "host_ended" }
  );

  return {
    sessionId: session._id.toString(),
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
  if (session.status === "live") {
    markSessionActive(sessionId);
  } else {
    markSessionInactive(sessionId);
  }
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

const pendingViewerCounts = new Map<string, number>();
let viewerCountFlushTimer: ReturnType<typeof setTimeout> | null = null;
const VIEWER_COUNT_DB_FLUSH_MS = 10_000;

function scheduleViewerCountFlush() {
  if (viewerCountFlushTimer) return;
  viewerCountFlushTimer = setTimeout(() => {
    viewerCountFlushTimer = null;
    flushViewerCountsToDb().catch((err) => {
      console.error("[live] viewer count flush failed:", err);
    });
  }, VIEWER_COUNT_DB_FLUSH_MS);
}

async function flushViewerCountsToDb() {
  if (pendingViewerCounts.size === 0) return;
  const batch = new Map(pendingViewerCounts);
  pendingViewerCounts.clear();

  await Promise.all(
    Array.from(batch.entries()).map(([sessionId, count]) =>
      LiveStreamSession.findByIdAndUpdate(sessionId, {
        viewerCount: Math.max(0, count),
      })
    )
  );
}

export function syncViewerCount(sessionId: string, count: number) {
  if (!mongoose.isValidObjectId(sessionId)) return;
  pendingViewerCounts.set(sessionId, Math.max(0, count));
  scheduleViewerCountFlush();
}

export function flushPendingViewerCount(sessionId: string) {
  const count = pendingViewerCounts.get(sessionId);
  if (count === undefined) return;
  pendingViewerCounts.delete(sessionId);
  return LiveStreamSession.findByIdAndUpdate(sessionId, {
    viewerCount: Math.max(0, count),
  });
}
