import mongoose from "mongoose";
const churchSchema = new mongoose.Schema({
    name: { type: String, required: true, trim: true },
    locationShort: { type: String, default: "" },
    locationFull: { type: String, default: "" },
    country: { type: String, default: "" },
    state: { type: String, default: "" },
    city: { type: String, default: "" },
    streetAddress: { type: String, default: "" },
    landmark: { type: String, default: "" },
    image: { type: String, default: "" },
    bannerImage: { type: String, default: "" },
    website: { type: String, default: "" },
    email: { type: String, default: "" },
    phone: { type: String, default: "" },
    denomination: { type: String, default: "" },
    shortBio: { type: String, default: "" },
    about: { type: String, default: "" },
    liveStreamUrl: { type: String, default: "" },
    followerCount: { type: Number, default: 0 },
    memberCount: { type: Number, default: 1 },
    isVerified: { type: Boolean, default: false },
    verificationCode: { type: String, select: false, default: null },
    verificationCodeExpiresAt: { type: Date, select: false, default: null },
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        default: null,
    },
}, { timestamps: true });
churchSchema.index({ name: "text", locationShort: "text", about: "text", city: "text" });
churchSchema.index({ followerCount: -1 });
churchSchema.index({ createdBy: 1 });
export const Church = mongoose.model("Church", churchSchema);
