import mongoose, { Document, Schema } from "mongoose";

export interface IChurchInvite extends Document {
  church: mongoose.Types.ObjectId;
  user: mongoose.Types.ObjectId;
  invitedBy: mongoose.Types.ObjectId;
  status: "pending" | "accepted" | "declined" | "rejected" | "cancelled";
  createdAt: Date;
  updatedAt: Date;
}

const churchInviteSchema = new Schema(
  {
    church: {
      type: Schema.Types.ObjectId,
      ref: "Church",
      required: true,
      index: true,
    },
    user: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    invitedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    status: {
      type: String,
      enum: ["pending", "accepted", "declined", "rejected", "cancelled"],
      default: "pending",
      index: true,
    },
  },
  { timestamps: true }
);

churchInviteSchema.index({ church: 1, user: 1 }, { unique: true });
churchInviteSchema.index({ church: 1, status: 1 });
churchInviteSchema.index({ user: 1, status: 1 });

export const ChurchInvite = mongoose.model<IChurchInvite>(
  "ChurchInvite",
  churchInviteSchema
);
