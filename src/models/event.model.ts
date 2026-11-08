import mongoose from "mongoose";

export type EventStatus = "Upcoming" | "Live" | "Completed" | "Cancelled";
export type EventType = "Online" | "Physical" | "Hybrid";

const churchEventSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, default: "" },
    type: { type: String, default: "Online" },
    status: { type: String, default: "Upcoming" },
    hostName: { type: String, default: "Admin" },
    hostEmail: { type: String, default: "" },
    avatar: { type: String, default: "" },
    churchId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Church",
      default: null,
    },
    churchName: { type: String, default: "" },
    location: { type: String, default: "" },
    eventDate: { type: Date, default: null },
    eventEndDate: { type: Date, default: null },
    attendees: { type: Number, default: 0 },
    registrations: { type: Number, default: 0 },
    maxAttendees: { type: Number, default: 0 },
    meetingUrl: { type: String, default: "" },
    coverImage: { type: String, default: "" },
    startTime: { type: String, default: "" },
    endTime: { type: String, default: "" },
    timezone: { type: String, default: "UTC" },
    eventType: { type: String, default: "in_person" },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    tags: [{ type: String }],
  },
  { timestamps: true }
);

churchEventSchema.index({ churchId: 1, eventDate: -1 });
churchEventSchema.index({ createdAt: -1 });
churchEventSchema.index({ status: 1 });
churchEventSchema.index({ eventDate: -1 });

export const ChurchEvent = mongoose.model(
  "ChurchEvent",
  churchEventSchema
);
