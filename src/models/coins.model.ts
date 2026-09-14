import mongoose from "mongoose";

const userCoinsSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
      index: true,
    },
    balance: { type: Number, default: 0, min: 0 },
    totalPurchased: { type: Number, default: 0, min: 0 },
    totalSpent: { type: Number, default: 0, min: 0 },
  },
  { timestamps: true }
);

export const UserCoins = mongoose.model("UserCoins", userCoinsSchema);

export type CoinPurchaseStatus = "Completed" | "Pending" | "Failed" | "Refunded";

const coinPurchaseSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    coins: { type: Number, required: true, min: 1 },
    amountCents: { type: Number, required: true, min: 0 },
    packageLabel: { type: String, default: "" },
    stripeSessionId: { type: String, default: "", index: true },
    stripePaymentIntentId: { type: String, default: "" },
    status: {
      type: String,
      enum: ["Completed", "Pending", "Failed", "Refunded"],
      default: "Pending",
      index: true,
    },
  },
  { timestamps: true }
);

export const CoinPurchase = mongoose.model("CoinPurchase", coinPurchaseSchema);
