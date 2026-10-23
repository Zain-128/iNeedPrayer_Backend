import mongoose from "mongoose";

export type AnnouncementPriority = "Low" | "Medium" | "High" | "Urgent";
export type AnnouncementStatus = "Draft" | "Published" | "Scheduled" | "Archived";
export type AnnouncementAudience =
  | "All Users"
  | "Church Owners"
  | "Church Members"
  | "Group Members"
  | "Subscribed Users";

const announcementSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    content: { type: String, default: "" },
    summary: { type: String, default: "" },
    priority: {
      type: String,
      enum: ["Low", "Medium", "High", "Urgent"],
      default: "Medium",
      index: true,
    },
    audience: {
      type: String,
      enum: [
        "All Users",
        "Church Owners",
        "Church Members",
        "Group Members",
        "Subscribed Users",
      ],
      default: "All Users",
      index: true,
    },
    status: {
      type: String,
      enum: ["Draft", "Published", "Scheduled", "Archived"],
      default: "Draft",
      index: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    createdByName: { type: String, default: "Admin" },
    createdByEmail: { type: String, default: "" },
    avatar: { type: String, default: "" },
    views: { type: Number, default: 0, min: 0 },
    likes: { type: Number, default: 0, min: 0 },
    comments: { type: Number, default: 0, min: 0 },
    scheduledAt: { type: Date, default: null },
    publishedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

export const Announcement = mongoose.model("Announcement", announcementSchema);
