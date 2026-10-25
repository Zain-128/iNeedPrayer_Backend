import mongoose from "mongoose";
import type { WalletOwnerType } from "./entityWallet.model.js";

export type WalletLedgerKind =
  | "purchase"
  | "donation"
  | "superchat"
  | "platform_fee"
  | "withdrawal_request"
  | "withdrawal_paid"
  | "withdrawal_rejected"
  | "bonus"
  | "adjustment";

export interface IWalletLedger {
  kind: WalletLedgerKind;
  fromOwnerType?: WalletOwnerType | null;
  fromOwnerId?: mongoose.Types.ObjectId | null;
  toOwnerType?: WalletOwnerType | null;
  toOwnerId?: mongoose.Types.ObjectId | null;
  coins: number;
  feeCoins: number;
  netCoins: number;
  message: string;
  sessionId?: mongoose.Types.ObjectId | null;
  actorUserId?: mongoose.Types.ObjectId | null;
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

const walletLedgerSchema = new mongoose.Schema<IWalletLedger>(
  {
    kind: {
      type: String,
      enum: [
        "purchase",
        "donation",
        "superchat",
        "platform_fee",
        "withdrawal_request",
        "withdrawal_paid",
        "withdrawal_rejected",
        "bonus",
        "adjustment",
      ],
      required: true,
      index: true,
    },
    fromOwnerType: {
      type: String,
      enum: ["user", "group", "church"],
      default: undefined,
    },
    fromOwnerId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
      index: true,
    },
    toOwnerType: {
      type: String,
      enum: ["user", "group", "church"],
      default: undefined,
    },
    toOwnerId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
      index: true,
    },
    coins: { type: Number, required: true },
    feeCoins: { type: Number, default: 0, min: 0 },
    netCoins: { type: Number, default: 0 },
    message: { type: String, default: "", maxlength: 280 },
    sessionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "LiveStreamSession",
      default: null,
      index: true,
    },
    actorUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

walletLedgerSchema.index({ createdAt: -1 });
walletLedgerSchema.index({ actorUserId: 1, createdAt: -1 });

export const WalletLedger = mongoose.model<IWalletLedger>(
  "WalletLedger",
  walletLedgerSchema
);
