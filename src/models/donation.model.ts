import mongoose from "mongoose";

export type DonationStatus = "Completed" | "Pending" | "Failed" | "Refunded";
export type DonationType = "One-Time" | "Monthly";
export type DonationRecipientType = "App" | "Church" | "Prayer Campaign";

const donationSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },
    donorName: { type: String, required: true, trim: true },
    donorEmail: { type: String, default: "", trim: true, lowercase: true },
    amountCents: { type: Number, required: true, min: 0 },
    type: {
      type: String,
      enum: ["One-Time", "Monthly"],
      default: "One-Time",
    },
    donatedTo: {
      type: String,
      enum: ["App", "Church", "Prayer Campaign"],
      default: "App",
      index: true,
    },
    recipientName: { type: String, default: "" },
    recipientRef: { type: String, default: "" },
    paymentMethod: { type: String, default: "Card" },
    transactionId: { type: String, default: "", index: true },
    status: {
      type: String,
      enum: ["Completed", "Pending", "Failed", "Refunded"],
      default: "Completed",
      index: true,
    },
    description: { type: String, default: "" },
    receiptUrl: { type: String, default: "" },
    donatedAt: { type: Date, default: () => new Date(), index: true },
  },
  { timestamps: true }
);

export const Donation = mongoose.model("Donation", donationSchema);
