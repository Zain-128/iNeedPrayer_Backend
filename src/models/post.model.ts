import mongoose from "mongoose";

export type PostMode = "prayer" | "praise";

const postSchema = new mongoose.Schema(
  {
    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    text: { type: String, default: "" },
    image: { type: String, default: "" },
    mode: {
      type: String,
      enum: ["prayer", "praise"],
      default: "prayer",
    },
    group: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Group",
      default: null,
      index: true,
    },
    church: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Church",
      default: null,
    },
    praysCount: { type: Number, default: 0 },
    praisesCount: { type: Number, default: 0 },
    commentsCount: { type: Number, default: 0 },
    sharesCount: { type: Number, default: 0 },
  },
  { timestamps: true }
);

postSchema.index({ createdAt: -1 });
postSchema.index({ author: 1, createdAt: -1 });

export const Post = mongoose.model("Post", postSchema);
