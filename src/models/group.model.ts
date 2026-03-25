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
  },
  { timestamps: true }
);

groupSchema.index({ name: "text", description: "text" });

export const Group = mongoose.model("Group", groupSchema);
