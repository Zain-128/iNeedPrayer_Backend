import mongoose from "mongoose";

const groupSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    image: { type: String, default: "" },
    description: { type: String, default: "" },
    memberCount: { type: Number, default: 0 },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    requiresApproval: { type: Boolean, default: false },
    category: { type: String, default: "Community" },
    privacy: {
      type: String,
      enum: ["Public", "Private"],
      default: "Public",
    },
    status: {
      type: String,
      enum: ["Active", "Pending", "Suspended"],
      default: "Active",
      index: true,
    },
    postsCount: { type: Number, default: 0 },
    reportsCount: { type: Number, default: 0 },
  },
  { timestamps: true }
);

groupSchema.index({ name: "text", description: "text" });
groupSchema.index({ status: 1 });

export const Group = mongoose.model("Group", groupSchema);
