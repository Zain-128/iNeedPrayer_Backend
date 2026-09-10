import mongoose from "mongoose";

const adminSettingsSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true, trim: true },
    value: { type: mongoose.Schema.Types.Mixed, default: null },
    category: { type: String, default: "general" },
    description: { type: String, default: "" },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  { timestamps: true }
);

adminSettingsSchema.index({ category: 1 });

export const AdminSettings = mongoose.model(
  "AdminSettings",
  adminSettingsSchema
);
