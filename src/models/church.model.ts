import mongoose from "mongoose";

const churchSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    locationShort: { type: String, default: "" },
    locationFull: { type: String, default: "" },
    image: { type: String, default: "" },
    bannerImage: { type: String, default: "" },
    website: { type: String, default: "" },
    email: { type: String, default: "" },
    phone: { type: String, default: "" },
    denomination: { type: String, default: "" },
    about: { type: String, default: "" },
    followerCount: { type: Number, default: 0 },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  { timestamps: true }
);

churchSchema.index({ name: "text", locationShort: "text", about: "text" });
churchSchema.index({ followerCount: -1 });

export const Church = mongoose.model("Church", churchSchema);
