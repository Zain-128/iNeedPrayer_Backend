import mongoose from "mongoose";
import {
  COINS_PACKAGES,
  COIN_WITHDRAW_VALUE_CENTS,
  CUSTOM_COINS_MAX,
  CUSTOM_COINS_MIN,
  CUSTOM_COIN_UNIT_CENTS,
  PLATFORM_FEE_BPS,
} from "../contants.js";
import { UserCoins } from "../models/coins.model.js";
import {
  EntityWallet,
  type WalletOwnerType,
} from "../models/entityWallet.model.js";
import { WalletLedger } from "../models/walletLedger.model.js";
import { Donation } from "../models/donation.model.js";
import { Withdrawal } from "../models/withdrawal.model.js";
import { PlatformTransaction } from "../models/platformTransaction.model.js";
import { User } from "../models/user.model.js";
import { Group } from "../models/group.model.js";
import { GroupMember } from "../models/groupMember.model.js";
import { Church } from "../models/church.model.js";
import { ChurchMember } from "../models/churchMember.model.js";
import { LiveStreamSession } from "../models/liveStreamSession.model.js";
import { getIo } from "../socket/ioSingleton.js";
import { IapReceipt } from "../models/iapReceipt.model.js";
import {
  computeReceiptHash,
  consumeGoogleProductServer,
  verifyAppleReceipt,
  verifyGooglePurchase,
  type VerifyReceiptResult,
} from "./iapVerify.service.js";

function httpError(message: string, statusCode: number) {
  const err = new Error(message);
  (err as Error & { statusCode?: number }).statusCode = statusCode;
  return err;
}

export function calcPlatformFee(coins: number): {
  feeCoins: number;
  netCoins: number;
} {
  const feeCoins = Math.floor((coins * PLATFORM_FEE_BPS) / 10_000);
  return { feeCoins, netCoins: Math.max(0, coins - feeCoins) };
}

export function coinsToWithdrawCents(coins: number) {
  return coins * COIN_WITHDRAW_VALUE_CENTS;
}

export function priceCustomCoins(coins: number) {
  if (coins < CUSTOM_COINS_MIN || coins > CUSTOM_COINS_MAX) {
    throw httpError(
      `Custom amount must be between ${CUSTOM_COINS_MIN} and ${CUSTOM_COINS_MAX} coins`,
      400
    );
  }
  const priceCents = Math.max(99, Math.round(coins * CUSTOM_COIN_UNIT_CENTS));
  return { coins, priceCents, label: `${coins} Custom Coins` };
}

export async function ensureUserWallet(userId: string) {
  await UserCoins.findOneAndUpdate(
    { user: userId },
    { $setOnInsert: { user: userId, balance: 0, totalPurchased: 0, totalSpent: 0 } },
    { upsert: true, new: true }
  );
  await EntityWallet.findOneAndUpdate(
    { ownerType: "user", ownerId: userId },
    {
      $setOnInsert: {
        ownerType: "user",
        ownerId: userId,
        balanceCoins: 0,
        pendingCoins: 0,
        totalEarnedCoins: 0,
        totalWithdrawnCoins: 0,
      },
    },
    { upsert: true, new: true }
  );
}

export async function ensureEntityWallet(
  ownerType: Exclude<WalletOwnerType, "user">,
  ownerId: string
) {
  return EntityWallet.findOneAndUpdate(
    { ownerType, ownerId },
    {
      $setOnInsert: {
        ownerType,
        ownerId,
        balanceCoins: 0,
        pendingCoins: 0,
        totalEarnedCoins: 0,
        totalWithdrawnCoins: 0,
      },
    },
    { upsert: true, new: true }
  );
}

export async function getUserWalletSummary(userId: string) {
  await ensureUserWallet(userId);
  const coins = await UserCoins.findOne({ user: userId }).lean();
  const user = await User.findById(userId).select("name").lean();
  return {
    ownerType: "user" as const,
    balanceCoins: coins?.balance ?? 0,
    totalPurchased: coins?.totalPurchased ?? 0,
    totalSpent: coins?.totalSpent ?? 0,
    withdrawable: false,
    displayName: user?.name ?? "You",
    platformFeeBps: PLATFORM_FEE_BPS,
  };
}

export async function getUserLedger(userId: string, limit = 40) {
  const docs = await WalletLedger.find({ actorUserId: userId })
    .sort({ createdAt: -1 })
    .limit(Math.min(100, Math.max(1, limit)))
    .lean();

  return docs.map((d) => ({
    id: d._id.toString(),
    kind: d.kind,
    coins: d.coins,
    feeCoins: d.feeCoins,
    netCoins: d.netCoins,
    message: d.message,
    createdAt: d.createdAt?.toISOString?.() ?? new Date().toISOString(),
    metadata: d.metadata ?? {},
  }));
}

async function assertEntityManager(
  scope: "group" | "church",
  entityId: string,
  userId: string
) {
  if (scope === "group") {
    const group = await Group.findById(entityId);
    if (!group) throw httpError("Group not found", 404);
    if (group.createdBy?.toString() === userId) return { name: group.name };
    const member = await GroupMember.findOne({
      group: entityId,
      user: userId,
      role: { $in: ["owner", "admin"] },
    });
    if (!member) throw httpError("Not allowed to manage this group wallet", 403);
    return { name: group.name };
  }

  const church = await Church.findById(entityId);
  if (!church) throw httpError("Church not found", 404);
  if (church.createdBy?.toString() === userId) return { name: church.name };
  const member = await ChurchMember.findOne({
    church: entityId,
    user: userId,
    role: { $in: ["owner", "admin"] },
  });
  if (!member) throw httpError("Not allowed to manage this church wallet", 403);
  return { name: church.name };
}

export async function getEntityWalletSummary(
  scope: "group" | "church",
  entityId: string,
  userId: string
) {
  const meta = await assertEntityManager(scope, entityId, userId);
  const wallet = await ensureEntityWallet(scope, entityId);
  const available = wallet.balanceCoins;
  const pending = wallet.pendingCoins;
  return {
    ownerType: scope,
    entityId,
    displayName: meta.name,
    balanceCoins: available,
    pendingCoins: pending,
    totalEarnedCoins: wallet.totalEarnedCoins,
    totalWithdrawnCoins: wallet.totalWithdrawnCoins,
    estimatedPayoutCents: coinsToWithdrawCents(available),
    estimatedPayoutDisplay: `$${(coinsToWithdrawCents(available) / 100).toFixed(2)}`,
    platformFeeBps: PLATFORM_FEE_BPS,
    withdrawable: true,
  };
}

export async function getEntityLedger(
  scope: "group" | "church",
  entityId: string,
  userId: string,
  limit = 40
) {
  await assertEntityManager(scope, entityId, userId);
  const docs = await WalletLedger.find({
    toOwnerType: scope,
    toOwnerId: entityId,
    kind: { $in: ["donation", "superchat", "withdrawal_request", "withdrawal_paid", "withdrawal_rejected"] },
  })
    .sort({ createdAt: -1 })
    .limit(Math.min(100, Math.max(1, limit)))
    .lean();

  return docs.map((d) => ({
    id: d._id.toString(),
    kind: d.kind,
    coins: d.coins,
    feeCoins: d.feeCoins,
    netCoins: d.netCoins,
    message: d.message,
    createdAt: d.createdAt?.toISOString?.() ?? new Date().toISOString(),
    metadata: d.metadata ?? {},
  }));
}

async function debitUserCoins(userId: string, coins: number) {
  const updated = await UserCoins.findOneAndUpdate(
    { user: userId, balance: { $gte: coins } },
    { $inc: { balance: -coins, totalSpent: coins } },
    { new: true }
  );
  if (!updated) throw httpError("Insufficient coin balance", 400);
  return updated;
}

async function creditEntity(
  scope: "group" | "church",
  entityId: string,
  netCoins: number
) {
  return EntityWallet.findOneAndUpdate(
    { ownerType: scope, ownerId: entityId },
    {
      $inc: {
        balanceCoins: netCoins,
        totalEarnedCoins: netCoins,
      },
      $setOnInsert: {
        ownerType: scope,
        ownerId: entityId,
        pendingCoins: 0,
        totalWithdrawnCoins: 0,
      },
    },
    { upsert: true, new: true }
  );
}

export async function spendCoinsToEntity(opts: {
  userId: string;
  scope: "group" | "church";
  entityId: string;
  coins: number;
  kind: "donation" | "superchat";
  message?: string;
  sessionId?: string;
}) {
  const { userId, scope, entityId, kind } = opts;
  const coins = Math.floor(opts.coins);
  if (!mongoose.isValidObjectId(entityId)) throw httpError("Invalid entity id", 400);
  if (!Number.isFinite(coins) || coins < 1) {
    throw httpError("coins must be at least 1", 400);
  }
  if (coins > 100_000) throw httpError("coins amount too large", 400);

  const message = (opts.message ?? "").trim().slice(0, 280);

  if (scope === "group") {
    const g = await Group.findById(entityId).select("_id name");
    if (!g) throw httpError("Group not found", 404);
  } else {
    const c = await Church.findById(entityId).select("_id name");
    if (!c) throw httpError("Church not found", 404);
  }

  let sessionId: string | undefined;
  if (kind === "superchat") {
    if (!opts.sessionId || !mongoose.isValidObjectId(opts.sessionId)) {
      throw httpError("sessionId is required for super chat", 400);
    }
    const session = await LiveStreamSession.findById(opts.sessionId)
      .select("status churchId groupId")
      .lean();
    if (!session || session.status !== "live") {
      throw httpError("Live stream is not active", 404);
    }
    const matches =
      scope === "church"
        ? session.churchId?.toString() === entityId
        : session.groupId?.toString() === entityId;
    if (!matches) throw httpError("Session does not match this page", 400);
    sessionId = opts.sessionId;
  }

  await ensureUserWallet(userId);
  await ensureEntityWallet(scope, entityId);

  const { feeCoins, netCoins } = calcPlatformFee(coins);
  await debitUserCoins(userId, coins);
  await creditEntity(scope, entityId, netCoins);

  const user = await User.findById(userId).select("name email avatar").lean();
  const recipient =
    scope === "group"
      ? await Group.findById(entityId).select("name").lean()
      : await Church.findById(entityId).select("name").lean();

  const ledger = await WalletLedger.create({
    kind,
    fromOwnerType: "user",
    fromOwnerId: userId,
    toOwnerType: scope,
    toOwnerId: entityId,
    coins,
    feeCoins,
    netCoins,
    message,
    sessionId: sessionId ?? null,
    actorUserId: userId,
    metadata: {
      donorName: user?.name ?? "User",
      recipientName: recipient?.name ?? "",
    },
  });

  await Donation.create({
    user: userId,
    donorName: user?.name ?? "User",
    donorEmail: user?.email ?? "",
    amountCents: coins, // coin units tracked; admin UI may display as coins
    type: "One-Time",
    donatedTo: scope === "church" ? "Church" : "Group",
    recipientName: recipient?.name ?? "",
    recipientRef: entityId,
    paymentMethod: "Coins",
    transactionId: ledger._id.toString(),
    status: "Completed",
    description:
      kind === "superchat"
        ? `Super Chat (${coins} coins)`
        : `Donation (${coins} coins)`,
  });

  await PlatformTransaction.create({
    user: userId,
    userName: user?.name ?? "",
    email: user?.email ?? "",
    avatar: user?.avatar ?? "",
    type: "Donation",
    amountCents: 0,
    coins,
    method: "Coins",
    transactionId: ledger._id.toString(),
    status: "Completed",
    description:
      kind === "superchat"
        ? `Super Chat to ${recipient?.name ?? scope}`
        : `Donation to ${recipient?.name ?? scope}`,
    metadata: { scope, entityId, feeCoins, netCoins, kind },
  });

  if (kind === "superchat" && sessionId) {
    const io = getIo();
    io?.to(`live:${sessionId}`).emit("live-superchat", {
      sessionId,
      id: ledger._id.toString(),
      userId,
      userName: user?.name ?? "User",
      avatar: user?.avatar ?? "",
      coins,
      message,
      createdAt: new Date().toISOString(),
    });
  }

  const balance = await UserCoins.findOne({ user: userId }).select("balance").lean();

  return {
    ok: true as const,
    kind,
    coins,
    feeCoins,
    netCoins,
    balanceCoins: balance?.balance ?? 0,
    ledgerId: ledger._id.toString(),
  };
}

export async function requestWithdrawal(opts: {
  userId: string;
  scope: "group" | "church";
  entityId: string;
  coins: number;
  method?: "Bank" | "PayPal" | "Stripe";
  account?: string;
}) {
  const { userId, scope, entityId } = opts;
  const coins = Math.floor(opts.coins);
  if (!Number.isFinite(coins) || coins < 10) {
    throw httpError("Minimum withdrawal is 10 coins", 400);
  }

  const meta = await assertEntityManager(scope, entityId, userId);
  const wallet = await ensureEntityWallet(scope, entityId);
  if (wallet.balanceCoins < coins) {
    throw httpError("Insufficient withdrawable balance", 400);
  }

  const user = await User.findById(userId).select("name email avatar").lean();
  const amountCents = coinsToWithdrawCents(coins);

  const updated = await EntityWallet.findOneAndUpdate(
    {
      ownerType: scope,
      ownerId: entityId,
      balanceCoins: { $gte: coins },
    },
    {
      $inc: {
        balanceCoins: -coins,
        pendingCoins: coins,
      },
    },
    { new: true }
  );
  if (!updated) throw httpError("Insufficient withdrawable balance", 400);

  const withdrawal = await Withdrawal.create({
    user: userId,
    name: user?.name ?? meta.name,
    email: user?.email ?? "",
    avatar: user?.avatar ?? "",
    role: scope === "church" ? "Church Owner" : "Group Admin",
    amountCents,
    method: opts.method ?? "Bank",
    account: (opts.account ?? "").trim().slice(0, 120),
    status: "Pending",
    ownerType: scope,
    ownerId: entityId,
    coins,
  });

  await WalletLedger.create({
    kind: "withdrawal_request",
    fromOwnerType: scope,
    fromOwnerId: entityId,
    coins,
    feeCoins: 0,
    netCoins: coins,
    message: "Withdrawal requested",
    actorUserId: userId,
    metadata: {
      withdrawalId: withdrawal._id.toString(),
      amountCents,
      method: withdrawal.method,
    },
  });

  return {
    id: withdrawal._id.toString(),
    coins,
    amountCents,
    amountDisplay: `$${(amountCents / 100).toFixed(2)}`,
    status: "Pending" as const,
    balanceCoins: updated.balanceCoins,
    pendingCoins: updated.pendingCoins,
  };
}

export async function listEntityWithdrawals(
  scope: "group" | "church",
  entityId: string,
  userId: string
) {
  await assertEntityManager(scope, entityId, userId);
  const docs = await Withdrawal.find({
    ownerType: scope,
    ownerId: entityId,
  })
    .sort({ requestedAt: -1 })
    .limit(50)
    .lean();

  return docs.map((w) => ({
    id: w._id.toString(),
    coins: (w as any).coins ?? Math.round(w.amountCents / COIN_WITHDRAW_VALUE_CENTS),
    amountCents: w.amountCents,
    amountDisplay: `$${(w.amountCents / 100).toFixed(2)}`,
    status: w.status === "Paid" ? "Completed" : w.status,
    method: w.method,
    requestedAt: w.requestedAt?.toISOString?.() ?? "",
    rejectReason: (w as any).rejectReason ?? "",
  }));
}

/** Called from admin approve/reject to sync entity wallet. */
export async function settleWithdrawalInWallet(
  withdrawalId: string,
  action: "approve" | "reject"
) {
  const w = await Withdrawal.findById(withdrawalId);
  if (!w) return;
  const ownerType = (w as any).ownerType as "group" | "church" | undefined;
  const ownerId = (w as any).ownerId?.toString?.();
  const coins =
    (w as any).coins ??
    Math.round(w.amountCents / COIN_WITHDRAW_VALUE_CENTS);
  if (!ownerType || !ownerId || !coins) return;

  if (action === "approve") {
    await EntityWallet.findOneAndUpdate(
      { ownerType, ownerId },
      {
        $inc: {
          pendingCoins: -coins,
          totalWithdrawnCoins: coins,
        },
      }
    );
    await WalletLedger.create({
      kind: "withdrawal_paid",
      fromOwnerType: ownerType,
      fromOwnerId: ownerId,
      coins,
      feeCoins: 0,
      netCoins: coins,
      message: "Withdrawal paid",
      actorUserId: w.user,
      metadata: { withdrawalId },
    });
  } else {
    await EntityWallet.findOneAndUpdate(
      { ownerType, ownerId },
      {
        $inc: {
          pendingCoins: -coins,
          balanceCoins: coins,
        },
      }
    );
    await WalletLedger.create({
      kind: "withdrawal_rejected",
      toOwnerType: ownerType,
      toOwnerId: ownerId,
      coins,
      feeCoins: 0,
      netCoins: coins,
      message: "Withdrawal rejected — coins returned",
      actorUserId: w.user,
      metadata: { withdrawalId },
    });
  }
}

export async function verifyAndProcessIapPurchase(opts: {
  userId: string;
  platform: "ios" | "android";
  productId: string;
  receipt?: string;
  purchaseToken?: string;
  transactionId?: string;
}) {
  const { userId, platform, productId } = opts;
  const receiptOrToken =
    platform === "ios"
      ? opts.receipt || opts.purchaseToken || ""
      : opts.purchaseToken || opts.receipt || "";

  if (!receiptOrToken.trim()) {
    throw httpError(`Receipt or purchaseToken is required for ${platform}`, 400);
  }
  if (!productId || !productId.trim()) {
    throw httpError("productId is required", 400);
  }

  const receiptHash = computeReceiptHash(receiptOrToken);

  // Check anti-replay / duplicate processing
  const existingReceipt = await IapReceipt.findOne({
    receiptOrTokenHash: receiptHash,
  });
  if (existingReceipt) {
    throw httpError("This purchase was already processed", 400);
  }

  const cleanSku = productId.trim();
  const matchedPkg = COINS_PACKAGES.find(
    (p) =>
      p.appStoreProductId === cleanSku ||
      p.googlePlayProductId === cleanSku ||
      cleanSku.endsWith(p.appStoreProductId) ||
      cleanSku.endsWith(p.googlePlayProductId) ||
      (cleanSku.endsWith("coins100") && p.coins === 100) ||
      (cleanSku.endsWith("coins500") && p.coins === 525) ||
      (cleanSku.endsWith("coins1000") && p.coins === 1100) ||
      (cleanSku.endsWith("coins2500") && p.coins === 2750) ||
      (cleanSku.endsWith("coins5000") && p.coins === 5750)
  );

  if (!matchedPkg) {
    throw httpError(`Invalid or unrecognized productId: ${cleanSku}`, 400);
  }

  // Perform live store receipt/token verification
  let verifyResult: VerifyReceiptResult;
  if (platform === "ios") {
    verifyResult = await verifyAppleReceipt(receiptOrToken, cleanSku);
  } else {
    verifyResult = await verifyGooglePurchase(cleanSku, receiptOrToken);
  }

  if (!verifyResult.valid) {
    throw httpError(
      `Purchase verification failed: ${verifyResult.reason || "Invalid receipt"}`,
      400
    );
  }

  // Record IAP receipt to prevent reuse
  await IapReceipt.create({
    user: new mongoose.Types.ObjectId(userId),
    platform,
    productId: cleanSku,
    receiptOrTokenHash: receiptHash,
    transactionId: opts.transactionId || verifyResult.transactionId || "",
    coins: matchedPkg.coins,
    priceCents: matchedPkg.priceCents,
    rawResponse: verifyResult.raw ?? null,
  });

  // Credit user wallet balance
  await ensureUserWallet(userId);
  const coinsDoc = await UserCoins.findOneAndUpdate(
    { user: userId },
    { $inc: { balance: matchedPkg.coins, totalPurchased: matchedPkg.coins } },
    { new: true, upsert: true }
  );

  const user = await User.findById(userId).select("name email avatar").lean();

  const ledger = await WalletLedger.create({
    kind: "purchase",
    toOwnerType: "user",
    toOwnerId: new mongoose.Types.ObjectId(userId),
    coins: matchedPkg.coins,
    feeCoins: 0,
    netCoins: matchedPkg.coins,
    message: `Purchased ${matchedPkg.label} via ${platform === "ios" ? "Apple App Store" : "Google Play Store"}`,
    actorUserId: new mongoose.Types.ObjectId(userId),
    metadata: {
      platform,
      productId: cleanSku,
      priceCents: matchedPkg.priceCents,
    },
  });

  const ledgerId = ledger._id ? ledger._id.toString() : new mongoose.Types.ObjectId().toString();

  await PlatformTransaction.create({
    user: new mongoose.Types.ObjectId(userId),
    userName: user?.name ?? "",
    email: user?.email ?? "",
    avatar: user?.avatar ?? "",
    type: "Coins Purchase",
    amountCents: matchedPkg.priceCents,
    coins: matchedPkg.coins,
    method: platform === "ios" ? "IAP (Apple)" : "IAP (Google)",
    transactionId: opts.transactionId || verifyResult.transactionId || ledgerId,
    status: "Completed",
    description: `IAP Purchase: ${matchedPkg.label}`,
    metadata: { platform, productId: cleanSku },
  });

  // Perform Android Play Store product consumption
  if (platform === "android") {
    void consumeGoogleProductServer(cleanSku, receiptOrToken);
  }

  return {
    ok: true as const,
    message: `Successfully credited ${matchedPkg.coins} coins`,
    coinsAdded: matchedPkg.coins,
    balanceCoins: coinsDoc?.balance ?? 0,
    transactionId: ledgerId,
  };
}