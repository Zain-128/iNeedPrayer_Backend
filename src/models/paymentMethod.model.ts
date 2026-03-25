import mongoose from "mongoose";

const paymentMethodSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    brand: { type: String, default: "card" },
    last4: { type: String, required: true },
    holderName: { type: String, default: "" },
    /** Placeholder until a real PSP is integrated */
    token: { type: String, default: "" },
  },
  { timestamps: true }
);

paymentMethodSchema.index({ user: 1 });

export const PaymentMethod = mongoose.model("PaymentMethod", paymentMethodSchema);
