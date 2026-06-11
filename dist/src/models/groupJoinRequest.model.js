import mongoose from "mongoose";
const groupJoinRequestSchema = new mongoose.Schema({
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
    status: {
        type: String,
        enum: ["pending", "approved", "rejected"],
        default: "pending",
    },
}, { timestamps: true });
groupJoinRequestSchema.index({ group: 1, user: 1 }, { unique: true });
groupJoinRequestSchema.index({ group: 1, status: 1 });
export const GroupJoinRequest = mongoose.model("GroupJoinRequest", groupJoinRequestSchema);
