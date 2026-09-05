import mongoose from "mongoose";

const socialLinkSchema = new mongoose.Schema(
  {
    platform: { type: String, required: true, trim: true },
    url: { type: String, required: true, trim: true },
  },
  { _id: false }
);

const churchSchema = new mongoose.Schema(
  {
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
    socialLinks: { type: [socialLinkSchema], default: [] },
    followerCount: { type: Number, default: 0 },
    memberCount: { type: Number, default: 1 },
    isVerified: { type: Boolean, default: false },
    type: {
      type: String,
      enum: ["Physical", "Online", "Both"],
      default: "Physical",
    },
    status: {
      type: String,
      enum: ["Approved", "Pending", "Suspended", "Rejected"],
      default: "Approved",
      index: true,
    },
    pastorName: { type: String, default: "" },
    pastorEmail: { type: String, default: "" },
    pastorPhone: { type: String, default: "" },
    pastorBio: { type: String, default: "" },
    verificationCode: { type: String, select: false, default: null },
    verificationCodeExpiresAt: { type: Date, select: false, default: null },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  { timestamps: true }
);

churchSchema.index({ name: "text", locationShort: "text", about: "text", city: "text" });
churchSchema.index({ followerCount: -1 });
churchSchema.index({ createdBy: 1 });
churchSchema.index({ status: 1 });

export const Church = mongoose.model("Church", churchSchema);
