import mongoose from "mongoose";
import { LiveStreamComment } from "../models/liveStreamComment.model.js";

export type PersistedLiveComment = {
  id: string;
  sessionId: string;
  userId: string;
  userName: string;
  avatar: string;
  text: string;
  createdAt: string;
};

export async function saveLiveComment(input: {
  sessionId: string;
  userId: string;
  userName: string;
  avatar: string;
  text: string;
}): Promise<PersistedLiveComment> {
  const doc = await LiveStreamComment.create({
    sessionId: input.sessionId,
    userId: input.userId,
    userName: input.userName,
    avatar: input.avatar,
    text: input.text,
    createdAt: new Date(),
  });

  return mapComment(doc);
}

export async function getRecentLiveComments(
  sessionId: string,
  limit = 40
): Promise<PersistedLiveComment[]> {
  if (!mongoose.isValidObjectId(sessionId)) return [];

  const docs = await LiveStreamComment.find({ sessionId })
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();

  return docs
    .map((d) =>
      mapComment({
        _id: d._id,
        sessionId: d.sessionId,
        userId: d.userId,
        userName: d.userName,
        avatar: d.avatar,
        text: d.text,
        createdAt: d.createdAt,
      })
    )
    .reverse();
}

function mapComment(doc: {
  _id: mongoose.Types.ObjectId;
  sessionId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  userName: string;
  avatar: string;
  text: string;
  createdAt: Date;
}): PersistedLiveComment {
  return {
    id: doc._id.toString(),
    sessionId: doc.sessionId.toString(),
    userId: doc.userId.toString(),
    userName: doc.userName,
    avatar: doc.avatar ?? "",
    text: doc.text,
    createdAt: doc.createdAt.toISOString(),
  };
}
