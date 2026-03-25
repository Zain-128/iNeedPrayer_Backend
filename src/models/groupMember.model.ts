import mongoose from "mongoose";

const groupMemberSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    group: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Group",
      required: true,
    },
    role: {
      type: String,
      enum: ["member", "admin"],
      default: "member",
    },
  },
  { timestamps: true }
);

groupMemberSchema.index({ user: 1, group: 1 }, { unique: true });
groupMemberSchema.index({ group: 1 });

export const GroupMember = mongoose.model("GroupMember", groupMemberSchema);
