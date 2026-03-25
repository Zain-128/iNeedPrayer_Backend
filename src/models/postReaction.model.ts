import mongoose from "mongoose";

const postReactionSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    post: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Post",
      required: true,
    },
    type: {
      type: String,
      enum: ["pray", "praise"],
      required: true,
    },
  },
  { timestamps: true }
);

postReactionSchema.index({ user: 1, post: 1, type: 1 }, { unique: true });
postReactionSchema.index({ post: 1, type: 1 });

export const PostReaction = mongoose.model("PostReaction", postReactionSchema);
