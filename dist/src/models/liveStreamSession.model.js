import mongoose from "mongoose";
const liveStreamSessionSchema = new mongoose.Schema({
    churchId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Church",
        default: null,
        index: true,
    },
    groupId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Group",
        default: null,
        index: true,
    },
    channelName: { type: String, required: true, unique: true },
    hostUserId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
    },
    title: { type: String, default: "Live Stream", trim: true, maxlength: 120 },
    status: {
        type: String,
        enum: ["live", "ended"],
        default: "live",
        index: true,
    },
    viewerCount: { type: Number, default: 0 },
    lastHeartbeatAt: { type: Date, default: null, index: true },
    startedAt: { type: Date, default: Date.now },
    endedAt: { type: Date, default: null },
    endedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        default: null,
    },
}, { timestamps: true });
liveStreamSessionSchema.index({ churchId: 1, status: 1 }, { partialFilterExpression: { status: "live", churchId: { $type: "objectId" } } });
liveStreamSessionSchema.index({ groupId: 1, status: 1 }, { partialFilterExpression: { status: "live", groupId: { $type: "objectId" } } });
export const LiveStreamSession = mongoose.model("LiveStreamSession", liveStreamSessionSchema);
