import mongoose from "mongoose";

export type AdminActivityType =
  | "user_registered"
  | "post_created"
  | "prayer_created"
  | "praise_created"
  | "comment_created"
  | "content_reported"
  | "user_reported"
  | "group_reported"
  | "church_reported"
  | "live_reported"
  | "church_created"
  | "church_pending"
  | "group_created"
  | "withdrawal_created"
  | "moderation_required";

const adminActivitySchema = new mongoose.Schema(
  {
    type: {
      type: String,
      required: true,
      index: true,
    },
    title: { type: String, required: true },
    message: { type: String, default: "" },
    refType: { type: String, default: "" },
    refId: { type: String, default: "", index: true },
    actorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    actorName: { type: String, default: "" },
    actorAvatar: { type: String, default: "" },
    meta: { type: mongoose.Schema.Types.Mixed, default: {} },
    /** Admins who have read this activity (top-bar inbox). */
    readBy: {
      type: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
      default: [],
    },
  },
  { timestamps: true }
);

adminActivitySchema.index({ createdAt: -1 });

export const AdminActivity = mongoose.model("AdminActivity", adminActivitySchema);
