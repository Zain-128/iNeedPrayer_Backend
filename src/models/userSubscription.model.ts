import mongoose from "mongoose";

export type SubscriptionPaymentStatus = "Paid" | "Pending" | "Failed";
export type SubscriptionStatus = "Active" | "Expired" | "Cancelled";

const userSubscriptionSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
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

export const UserSubscription = mongoose.model(
  "UserSubscription",
  userSubscriptionSchema
);
