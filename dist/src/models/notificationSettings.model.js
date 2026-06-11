import mongoose from "mongoose";
const notificationSettingsSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
        unique: true,
    },
    pushEnabled: { type: Boolean, default: true },
    emailEnabled: { type: Boolean, default: true },
    friendRequests: { type: Boolean, default: true },
    messages: { type: Boolean, default: true },
    groupActivity: { type: Boolean, default: true },
    postActivity: { type: Boolean, default: true },
    prayersAndPraises: { type: Boolean, default: true },
    mutedUntil: { type: Date, default: null },
}, { timestamps: true });
export const NotificationSettings = mongoose.model("NotificationSettings", notificationSettingsSchema);
