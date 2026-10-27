import mongoose from "mongoose";

export type SubscriptionBillingCycle = "Monthly" | "Yearly" | "Lifetime";
export type SubscriptionTarget = "individual" | "community" | "church";

const subscriptionPlanSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    description: { type: String, default: "" },
    target: {
      type: String,
      enum: ["individual", "community", "church"],
      default: "individual",
      index: true,
    },
    tier: { type: String, default: "starter" },
    badge: { type: String, default: "" },
    priceCents: { type: Number, required: true, min: 0 },
    billingCycle: {
      type: String,
      enum: ["Monthly", "Yearly", "Lifetime"],
      default: "Monthly",
    },
    features: { type: [String], default: [] },
    limits: {
      maxMembers: { type: Number, default: 0 },
      maxPrayerRequests: { type: Number, default: 0 },
      liveStreamEnabled: { type: Boolean, default: false },
      analyticsEnabled: { type: Boolean, default: false },
      prioritySupport: { type: Boolean, default: false },
    },
    isActive: { type: Boolean, default: true, index: true },
    trialPeriodDays: { type: Number, default: 0, min: 0 },
    subscribersCount: { type: Number, default: 0, min: 0 },
    appStoreProductId: { type: String, default: "" },
    googlePlayProductId: { type: String, default: "" },
  },
  { timestamps: true }
);

export const SubscriptionPlan = mongoose.model(
  "SubscriptionPlan",
  subscriptionPlanSchema
);
