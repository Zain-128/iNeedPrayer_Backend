import mongoose from "mongoose";

export type EmailCampaignStatus =
  | "Draft"
  | "Scheduled"
  | "Sending"
  | "Sent"
  | "Failed";

const emailCampaignSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    subject: { type: String, required: true, trim: true },
    message: { type: String, default: "" },
    audience: { type: String, default: "All Users" },
    recipients: { type: Number, default: 0, min: 0 },
    openRate: { type: String, default: "-" },
    clickRate: { type: String, default: "-" },
    status: {
      type: String,
      enum: ["Draft", "Scheduled", "Sending", "Sent", "Failed"],
      default: "Draft",
      index: true,
    },
    scheduledAt: { type: Date, default: null },
    sentAt: { type: Date, default: null },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    createdByName: { type: String, default: "Admin" },
  },
  { timestamps: true }
);

export const EmailCampaign = mongoose.model("EmailCampaign", emailCampaignSchema);
