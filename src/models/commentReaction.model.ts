import mongoose from "mongoose";

const commentReactionSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    comment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Comment",
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

commentReactionSchema.index({ user: 1, comment: 1, type: 1 }, { unique: true });
commentReactionSchema.index({ comment: 1, type: 1 });

export const CommentReaction = mongoose.model(
  "CommentReaction",
  commentReactionSchema
);
