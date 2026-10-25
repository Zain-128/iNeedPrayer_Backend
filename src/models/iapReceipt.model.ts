import mongoose from "mongoose";

export interface IIapReceipt {
  user: mongoose.Types.ObjectId;
  platform: "ios" | "android";
  productId: string;
  receiptOrTokenHash: string;
  transactionId?: string;
  coins: number;
  priceCents: number;
  rawResponse?: any;
  createdAt: Date;
  updatedAt: Date;
}

const iapReceiptSchema = new mongoose.Schema<IIapReceipt>(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    platform: {
      type: String,
      enum: ["ios", "android"],
      required: true,
    },
    productId: {
      type: String,
      required: true,
      trim: true,
    },
    receiptOrTokenHash: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    transactionId: {
      type: String,
      default: "",
      trim: true,
    },
    coins: {
      type: Number,
      required: true,
    },
    priceCents: {
      type: Number,
      required: true,
    },
    rawResponse: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
  },
  { timestamps: true }
);

export const IapReceipt = mongoose.model<IIapReceipt>(
  "IapReceipt",
  iapReceiptSchema
);
