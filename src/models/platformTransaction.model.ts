import mongoose from "mongoose";

export type PlatformTransactionType =
  | "Subscription"
  | "Donation"
  | "Coins Purchase"
  | "Withdrawal"
  | "Refund"
  | "Reward";

export type PlatformTransactionStatus =
  | "Completed"
  | "Pending"
  | "Failed"
  | "Refunded";

const platformTransactionSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },
    userName: { type: String, default: "" },
    email: { type: String, default: "" },
    avatar: { type: String, default: "" },
    type: {
      type: String,
      enum: [
        "Subscription",
        "Donation",
        "Coins Purchase",
        "Withdrawal",
        "Refund",
        "Reward",
      ],
      required: true,
      index: true,
    },
    amountCents: { type: Number, required: true },
    coins: { type: Number, default: 0 },
    method: { type: String, default: "Card" },
    transactionId: { type: String, default: "", index: true },
    status: {
      type: String,
      enum: ["Completed", "Pending", "Failed", "Refunded"],
      default: "Completed",
      index: true,
    },
    description: { type: String, default: "" },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
    occurredAt: { type: Date, default: () => new Date(), index: true },
  },
  { timestamps: true }
);

export const PlatformTransaction = mongoose.model(
  "PlatformTransaction",
  platformTransactionSchema
);
