import mongoose from "mongoose";

const conversationHideSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    conversation: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Conversation",
      required: true,
    },
  },
  { timestamps: true }
);

conversationHideSchema.index({ user: 1, conversation: 1 }, { unique: true });

export const ConversationHide = mongoose.model(
  "ConversationHide",
  conversationHideSchema
);
