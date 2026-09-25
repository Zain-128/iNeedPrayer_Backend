import mongoose from "mongoose";

export type SubscriptionBillingCycle = "Monthly" | "Yearly" | "Lifetime";

const subscriptionPlanSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    description: { type: String, default: "" },
    priceCents: { type: Number, required: true, min: 0 },
    billingCycle: {
      type: String,
      enum: ["Monthly", "Yearly", "Lifetime"],
      default: "Monthly",
    },
    features: { type: [String], default: [] },
    isActive: { type: Boolean, default: true, index: true },
    trialPeriodDays: { type: Number, default: 0, min: 0 },
    subscribersCount: { type: Number, default: 0, min: 0 },
    appStoreProductId: { type: String, default: "", trim: true },
    googlePlayProductId: { type: String, default: "", trim: true },
  },
  { timestamps: true }
);

export const SubscriptionPlan = mongoose.model(
  "SubscriptionPlan",
  subscriptionPlanSchema
);
