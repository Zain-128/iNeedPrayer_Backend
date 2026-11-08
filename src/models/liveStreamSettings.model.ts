import mongoose, { Document, Schema } from "mongoose";

export interface ILiveStreamSettings extends Document {
  sourceType: "church" | "group";
  sourceId: mongoose.Types.ObjectId;
  enabled: boolean;
  allowedRoles: string[];
  liveChatEnabled: boolean;
  superChatsEnabled: boolean;
  donationsEnabled: boolean;
  reactionsEnabled: boolean;
  replayEnabled: boolean;
  moderationEnabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const liveStreamSettingsSchema = new Schema(
  {
    sourceType: {
      type: String,
      enum: ["church", "group"],
      required: true,
      index: true,
    },
    sourceId: {
      type: Schema.Types.ObjectId,
      required: true,
      index: true,
    },
    enabled: { type: Boolean, default: true },
    allowedRoles: { type: [String], default: ["owner", "admin"] },
    liveChatEnabled: { type: Boolean, default: true },
    superChatsEnabled: { type: Boolean, default: true },
    donationsEnabled: { type: Boolean, default: true },
    reactionsEnabled: { type: Boolean, default: true },
    replayEnabled: { type: Boolean, default: true },
    moderationEnabled: { type: Boolean, default: true },
  },
  { timestamps: true }
);

liveStreamSettingsSchema.index({ sourceType: 1, sourceId: 1 }, { unique: true });

export const LiveStreamSettings = mongoose.model<ILiveStreamSettings>(
  "LiveStreamSettings",
  liveStreamSettingsSchema
);
