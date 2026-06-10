import mongoose from "mongoose";

export type LiveStreamStatus = "live" | "ended";

export interface ILiveStreamSession {
  churchId?: mongoose.Types.ObjectId | null;
  groupId?: mongoose.Types.ObjectId | null;
  channelName: string;
  hostUserId: mongoose.Types.ObjectId;
  title: string;
  status: LiveStreamStatus;
  viewerCount: number;
  lastHeartbeatAt?: Date | null;
  startedAt: Date;
  endedAt?: Date | null;
  endedBy?: mongoose.Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
}

const liveStreamSessionSchema = new mongoose.Schema<ILiveStreamSession>(
  {
    churchId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Church",
      default: null,
      index: true,
    },
    groupId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Group",
      default: null,
      index: true,
    },
    channelName: { type: String, required: true, unique: true },
    hostUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    title: { type: String, default: "Live Stream", trim: true, maxlength: 120 },
    status: {
      type: String,
      enum: ["live", "ended"],
      default: "live",
      index: true,
    },
    viewerCount: { type: Number, default: 0 },
    lastHeartbeatAt: { type: Date, default: null, index: true },
    startedAt: { type: Date, default: Date.now },
    endedAt: { type: Date, default: null },
    endedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  { timestamps: true }
);

liveStreamSessionSchema.index(
  { churchId: 1, status: 1 },
  { partialFilterExpression: { status: "live", churchId: { $type: "objectId" } } }
);
liveStreamSessionSchema.index(
  { groupId: 1, status: 1 },
  { partialFilterExpression: { status: "live", groupId: { $type: "objectId" } } }
);

export const LiveStreamSession = mongoose.model<ILiveStreamSession>(
  "LiveStreamSession",
  liveStreamSessionSchema
);
