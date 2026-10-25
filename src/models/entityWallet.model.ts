import mongoose from "mongoose";

export type WalletOwnerType = "user" | "group" | "church";

export interface IEntityWallet {
  ownerType: WalletOwnerType;
  ownerId: mongoose.Types.ObjectId;
  balanceCoins: number;
  pendingCoins: number;
  totalEarnedCoins: number;
  totalWithdrawnCoins: number;
  createdAt: Date;
  updatedAt: Date;
}

const entityWalletSchema = new mongoose.Schema<IEntityWallet>(
  {
    ownerType: {
      type: String,
      enum: ["user", "group", "church"],
      required: true,
      index: true,
    },
    ownerId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      index: true,
    },
    balanceCoins: { type: Number, default: 0, min: 0 },
    pendingCoins: { type: Number, default: 0, min: 0 },
    totalEarnedCoins: { type: Number, default: 0, min: 0 },
    totalWithdrawnCoins: { type: Number, default: 0, min: 0 },
  },
  { timestamps: true }
);

entityWalletSchema.index({ ownerType: 1, ownerId: 1 }, { unique: true });

export const EntityWallet = mongoose.model<IEntityWallet>(
  "EntityWallet",
  entityWalletSchema
);
