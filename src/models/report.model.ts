import mongoose from "mongoose";

const reportActionSchema = new mongoose.Schema(
  {
    action: { type: String, required: true },
    performedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    note: { type: String, default: "" },
    date: { type: Date, default: Date.now },
  },
  { _id: true }
);

const reportSchema = new mongoose.Schema(
  {
    reporter: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    targetType: {
      type: String,
      enum: ["post", "comment", "group", "user", "church", "prayer", "praise", "live"],
      required: true,
    },
    group: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Group",
      default: null,
    },
    post: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Post",
      default: null,
    },
    comment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Comment",
      default: null,
    },
    church: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Church",
      default: null,
    },
    reportedUser: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    reasonKey: { type: String, required: true },
    /** Alias of reasonKey for clients/admin that read `reason` */
    reason: { type: String, default: "" },
    otherText: { type: String, default: "" },
    status: {
      type: String,
      enum: ["Pending", "Under Review", "Resolved", "Dismissed"],
      default: "Pending",
      index: true,
    },
    actionHistory: { type: [reportActionSchema], default: [] },
    resolvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    resolvedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

reportSchema.index({ reporter: 1, post: 1 });
reportSchema.index({ reporter: 1, comment: 1 });
reportSchema.index({ reporter: 1, group: 1 });
reportSchema.index({ status: 1, createdAt: -1 });

export const Report = mongoose.model("Report", reportSchema);
