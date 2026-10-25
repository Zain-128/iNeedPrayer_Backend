import mongoose from "mongoose";

export type PushStatus = "Draft" | "Scheduled" | "Sent" | "Failed";
export type PushAudience =
  | "All Users"
  | "Subscribed Users"
  | "Church Owners"
  | "Church Members"
  | "Group Members"
  | "Inactive Users";

const pushNotificationSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    message: { type: String, default: "" },
    audience: { type: String, default: "All Users" },
    status: { type: String, default: "Draft" },
    recipients: { type: Number, default: 0 },
    opened: { type: Number, default: 0 },
    clicked: { type: Number, default: 0 },
    deepLink: { type: String, default: "" },
    scheduledAt: { type: Date, default: null },
    sentAt: { type: Date, default: null },
    sentBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    sentByName: { type: String, default: "Admin" },
  },
  { timestamps: true }
);

pushNotificationSchema.index({ createdAt: -1 });
pushNotificationSchema.index({ status: 1 });

export const PushNotification = mongoose.model(
  "PushNotification",
  pushNotificationSchema
);
