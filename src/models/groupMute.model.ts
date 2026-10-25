import mongoose from "mongoose";

const groupMuteSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    group: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Group",
      required: true,
    },
  },
  { timestamps: true }
);

groupMuteSchema.index({ user: 1, group: 1 }, { unique: true });

export const GroupMute = mongoose.model("GroupMute", groupMuteSchema);
