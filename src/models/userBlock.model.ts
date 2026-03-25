import mongoose from "mongoose";

const userBlockSchema = new mongoose.Schema(
  {
    blocker: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    blocked: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  { timestamps: true }
);

userBlockSchema.index({ blocker: 1, blocked: 1 }, { unique: true });
userBlockSchema.index({ blocker: 1 });

export const UserBlock = mongoose.model("UserBlock", userBlockSchema);
