import mongoose from "mongoose";

export interface ILiveStreamComment {
  sessionId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  userName: string;
  avatar: string;
  text: string;
  createdAt: Date;
}

const liveStreamCommentSchema = new mongoose.Schema<ILiveStreamComment>(
  {
    sessionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "LiveStreamSession",
      required: true,
      index: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    userName: { type: String, default: "User", trim: true },
    avatar: { type: String, default: "" },
    text: { type: String, required: true, trim: true, maxlength: 280 },
    createdAt: { type: Date, default: Date.now },
  },
  { timestamps: false }
);

liveStreamCommentSchema.index({ sessionId: 1, createdAt: -1 });

export const LiveStreamComment = mongoose.model<ILiveStreamComment>(
  "LiveStreamComment",
  liveStreamCommentSchema
);
