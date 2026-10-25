import mongoose from "mongoose";

const churchFollowSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    church: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Church",
      required: true,
    },
  },
  { timestamps: true }
);

churchFollowSchema.index({ user: 1, church: 1 }, { unique: true });

export const ChurchFollow = mongoose.model("ChurchFollow", churchFollowSchema);
