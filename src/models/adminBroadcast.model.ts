import mongoose from "mongoose";

const adminBroadcastSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    message: { type: String, default: "" },
    audience: { type: String, default: "All Users" },
    kind: { type: String, default: "announcement" },
    type: { type: String, default: "In-App" },
    sentBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    sentByName: { type: String, default: "Admin" },
    recipients: { type: Number, default: 0 },
    status: {
      type: String,
      enum: ["Sent", "Failed"],
      default: "Sent",
    },
  },
  { timestamps: true }
);

adminBroadcastSchema.index({ createdAt: -1 });

export const AdminBroadcast = mongoose.model(
  "AdminBroadcast",
  adminBroadcastSchema
);
