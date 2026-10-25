import mongoose from "mongoose";

const notificationSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    title: { type: String, required: true },
    body: { type: String, default: "" },
    read: { type: Boolean, default: false },
    kind: { type: String, default: "general" },
    refType: { type: String, default: "" },
    refId: { type: String, default: "" },
  },
  { timestamps: true }
);

notificationSchema.index({ user: 1, createdAt: -1 });

export const Notification = mongoose.model("Notification", notificationSchema);
