import mongoose from "mongoose";

export type WithdrawalStatus = "Pending" | "Rejected" | "Paid";
export type WithdrawalRole = "User" | "Church Owner";
export type WithdrawalMethod = "Bank" | "PayPal" | "Stripe";

const withdrawalSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },
    name: { type: String, required: true, trim: true },
    email: { type: String, default: "", trim: true, lowercase: true },
    avatar: { type: String, default: "" },
    role: {
      type: String,
      enum: ["User", "Church Owner"],
      default: "User",
      index: true,
    },
    amountCents: { type: Number, required: true, min: 0 },
    method: {
      type: String,
      enum: ["Bank", "PayPal", "Stripe"],
      default: "Bank",
      index: true,
    },
    account: { type: String, default: "" },
    status: {
      type: String,
      enum: ["Pending", "Rejected", "Paid"],
      default: "Pending",
      index: true,
    },
    transactionId: { type: String, default: "", index: true },
    requestedAt: { type: Date, default: () => new Date(), index: true },
    processedAt: { type: Date, default: null },
    processedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    rejectReason: { type: String, default: "" },
  },
  { timestamps: true }
);

export const Withdrawal = mongoose.model("Withdrawal", withdrawalSchema);
