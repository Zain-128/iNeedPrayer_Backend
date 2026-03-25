import mongoose from "mongoose";

const reportSchema = new mongoose.Schema(
  {
    reporter: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    targetType: {
      type: String,
      enum: ["post", "comment"],
      required: true,
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
    reasonKey: { type: String, required: true },
    otherText: { type: String, default: "" },
  },
  { timestamps: true }
);

reportSchema.index({ reporter: 1, post: 1 });
reportSchema.index({ reporter: 1, comment: 1 });

export const Report = mongoose.model("Report", reportSchema);
