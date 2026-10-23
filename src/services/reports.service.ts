import { Report } from "../models/report.model.js";
import { Post } from "../models/post.model.js";
import { Comment } from "../models/comment.model.js";
import { Group } from "../models/group.model.js";
import { recordAdminActivity } from "./admin/adminActivity.service.js";

/** Parse report body: prefers reasonKey, falls back to reason. */
export function parseReportBody(body: unknown): {
  reasonKey: string;
  otherText: string;
} {
  const b = (body ?? {}) as {
    reasonKey?: unknown;
    reason?: unknown;
    otherText?: unknown;
  };

  const rawKey =
    typeof b.reasonKey === "string" && b.reasonKey.trim()
      ? b.reasonKey.trim()
      : typeof b.reason === "string" && b.reason.trim()
        ? b.reason.trim()
        : "";

  if (!rawKey) {
    const err = new Error("reasonKey is required");
    (err as Error & { statusCode?: number }).statusCode = 400;
    throw err;
  }

  const otherRaw =
    typeof b.otherText === "string" ? b.otherText.trim() : "";

  // otherText only saved when reason is "other"
  const otherText = rawKey === "other" ? otherRaw : "";

  return { reasonKey: rawKey, otherText };
}

function reportPayload(reporterId: string, reasonKey: string, otherText: string) {
  // Dual-write reasonKey + reason so admin/UI that reads either field works
  return {
    reporter: reporterId,
    reasonKey,
    reason: reasonKey,
    otherText,
  };
}

export async function reportPost(
  reporterId: string,
  postId: string,
  reasonKey: string,
  otherText?: string
) {
  const post = await Post.findById(postId);
  if (!post) {
    const err = new Error("Post not found");
    (err as Error & { statusCode?: number }).statusCode = 404;
    throw err;
  }
  const text = reasonKey === "other" ? (otherText?.trim() ?? "") : "";
  const report = await Report.create({
    ...reportPayload(reporterId, reasonKey, text),
    targetType: "post",
    post: postId,
  });
  void recordAdminActivity({
    type: "content_reported",
    title: "Post reported",
    message: `Reason: ${reasonKey}`,
    refType: "report",
    refId: report._id.toString(),
    actorId: reporterId,
    meta: { targetType: "post", postId },
  });
  void recordAdminActivity({
    type: "moderation_required",
    title: "Moderation action required",
    message: `A post was reported (${reasonKey})`,
    refType: "report",
    refId: report._id.toString(),
    actorId: reporterId,
  });
}

export async function reportComment(
  reporterId: string,
  commentId: string,
  reasonKey: string,
  otherText?: string
) {
  const comment = await Comment.findById(commentId);
  if (!comment) {
    const err = new Error("Comment not found");
    (err as Error & { statusCode?: number }).statusCode = 404;
    throw err;
  }
  const text = reasonKey === "other" ? (otherText?.trim() ?? "") : "";
  const report = await Report.create({
    ...reportPayload(reporterId, reasonKey, text),
    targetType: "comment",
    comment: commentId,
    post: comment.post,
  });
  void recordAdminActivity({
    type: "content_reported",
    title: "Comment reported",
    message: `Reason: ${reasonKey}`,
    refType: "report",
    refId: report._id.toString(),
    actorId: reporterId,
    meta: { targetType: "comment", commentId },
  });
  void recordAdminActivity({
    type: "moderation_required",
    title: "Moderation action required",
    message: `A comment was reported (${reasonKey})`,
    refType: "report",
    refId: report._id.toString(),
    actorId: reporterId,
  });
}

export async function reportGroup(
  reporterId: string,
  groupId: string,
  reasonKey: string,
  otherText?: string
) {
  const group = await Group.findById(groupId);
  if (!group) {
    const err = new Error("Group not found");
    (err as Error & { statusCode?: number }).statusCode = 404;
    throw err;
  }
  const text = reasonKey === "other" ? (otherText?.trim() ?? "") : "";
  const report = await Report.create({
    ...reportPayload(reporterId, reasonKey, text),
    targetType: "group",
    group: groupId,
  });
  void recordAdminActivity({
    type: "group_reported",
    title: "Group reported",
    message: `${group.name} — ${reasonKey}`,
    refType: "report",
    refId: report._id.toString(),
    actorId: reporterId,
    meta: { groupId },
  });
  void recordAdminActivity({
    type: "moderation_required",
    title: "Moderation action required",
    message: `Group "${group.name}" was reported`,
    refType: "report",
    refId: report._id.toString(),
    actorId: reporterId,
  });
}

export async function reportUser(
  reporterId: string,
  reportedUserId: string,
  reasonKey: string,
  otherText?: string
) {
  const { User } = await import("../models/user.model.js");
  const user = await User.findById(reportedUserId);
  if (!user) {
    const err = new Error("User not found");
    (err as Error & { statusCode?: number }).statusCode = 404;
    throw err;
  }
  const text = reasonKey === "other" ? (otherText?.trim() ?? "") : "";
  const report = await Report.create({
    ...reportPayload(reporterId, reasonKey, text),
    targetType: "user",
    reportedUser: reportedUserId,
  });
  void recordAdminActivity({
    type: "user_reported",
    title: "User reported",
    message: `${user.name} — ${reasonKey}`,
    refType: "report",
    refId: report._id.toString(),
    actorId: reporterId,
    meta: { reportedUserId },
  });
  void recordAdminActivity({
    type: "moderation_required",
    title: "Moderation action required",
    message: `User "${user.name}" was reported`,
    refType: "report",
    refId: report._id.toString(),
    actorId: reporterId,
  });
}

export async function reportChurch(
  reporterId: string,
  churchId: string,
  reasonKey: string,
  otherText?: string
) {
  const { Church } = await import("../models/church.model.js");
  const church = await Church.findById(churchId);
  if (!church) {
    const err = new Error("Church not found");
    (err as Error & { statusCode?: number }).statusCode = 404;
    throw err;
  }
  const text = reasonKey === "other" ? (otherText?.trim() ?? "") : "";
  const report = await Report.create({
    ...reportPayload(reporterId, reasonKey, text),
    targetType: "church",
    church: churchId,
  });
  void recordAdminActivity({
    type: "church_reported",
    title: "Church reported",
    message: `${church.name} — ${reasonKey}`,
    refType: "report",
    refId: report._id.toString(),
    actorId: reporterId,
    meta: { churchId },
  });
  void recordAdminActivity({
    type: "moderation_required",
    title: "Moderation action required",
    message: `Church "${church.name}" was reported`,
    refType: "report",
    refId: report._id.toString(),
    actorId: reporterId,
  });
}

export async function reportLive(
  reporterId: string,
  sessionId: string,
  reasonKey: string,
  otherText?: string
) {
  const text = reasonKey === "other" ? (otherText?.trim() ?? "") : "";
  const report = await Report.create({
    ...reportPayload(reporterId, reasonKey, text),
    targetType: "live",
    // session id stored in otherText/meta via reason fields; also keep in otherText if needed
    otherText: text || `session:${sessionId}`,
  });
  void recordAdminActivity({
    type: "live_reported",
    title: "Live stream reported",
    message: `Session ${sessionId} — ${reasonKey}`,
    refType: "report",
    refId: report._id.toString(),
    actorId: reporterId,
    meta: { sessionId },
  });
  void recordAdminActivity({
    type: "moderation_required",
    title: "Moderation action required",
    message: `A live stream was reported (${reasonKey})`,
    refType: "report",
    refId: report._id.toString(),
    actorId: reporterId,
  });
}
