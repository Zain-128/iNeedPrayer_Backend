import mongoose from "mongoose";
const groupInviteSchema = new mongoose.Schema({
    group: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Group",
        required: true,
    },
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
    },
    invitedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
    },
    status: {
        type: String,
        enum: ["pending", "accepted", "rejected"],
        default: "pending",
    },
}, { timestamps: true });
groupInviteSchema.index({ group: 1, user: 1 }, { unique: true });
groupInviteSchema.index({ group: 1, status: 1 });
export const GroupInvite = mongoose.model("GroupInvite", groupInviteSchema);
