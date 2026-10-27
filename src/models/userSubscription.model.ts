import mongoose from "mongoose";

export type SubscriptionPaymentStatus = "Paid" | "Pending" | "Failed";
export type SubscriptionStatus = "Active" | "Expired" | "Cancelled";
export type SubscriptionTarget = "individual" | "community" | "church";

const userSubscriptionSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    target: {
      type: String,
      enum: ["individual", "community", "church"],
      default: "individual",
      index: true,
    },
    church: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Church",
      default: null,
      index: true,
    },
    community: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Group",
      default: null,
      index: true,
    },
    plan: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "SubscriptionPlan",
      default: null,
    },
    planName: { type: String, default: "Monthly" },
    amountCents: { type: Number, default: 0, min: 0 },
    billing: { type: String, default: "Monthly" },
    startDate: { type: Date, default: () => new Date() },
    expiryDate: { type: Date, default: null },
    autoRenew: { type: Boolean, default: true },
    cancelAtPeriodEnd: { type: Boolean, default: false },
    paymentStatus: {
      type: String,
      enum: ["Paid", "Pending", "Failed"],
      default: "Paid",
      index: true,
    },
    status: {
      type: String,
      enum: ["Active", "Expired", "Cancelled"],
      default: "Active",
      index: true,
    },
    transactionId: { type: String, default: "" },
  },
  { timestamps: true }
);

userSubscriptionSchema.index({ status: 1, createdAt: -1 });
userSubscriptionSchema.index({ user: 1, target: 1, status: 1 });
userSubscriptionSchema.index({ church: 1, status: 1 });
userSubscriptionSchema.index({ community: 1, status: 1 });

export const UserSubscription = mongoose.model(
  "UserSubscription",
  userSubscriptionSchema
);
