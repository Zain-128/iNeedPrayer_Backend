import mongoose from "mongoose";
import { SubscriptionPlan } from "../../models/subscriptionPlan.model.js";
import type { SubscriptionBillingCycle } from "../../models/subscriptionPlan.model.js";
import { UserSubscription } from "../../models/userSubscription.model.js";
import type {
  SubscriptionPaymentStatus,
  SubscriptionStatus,
} from "../../models/userSubscription.model.js";
import { Donation } from "../../models/donation.model.js";
import type {
  DonationRecipientType,
  DonationStatus,
  DonationType,
} from "../../models/donation.model.js";
import { PlatformTransaction } from "../../models/platformTransaction.model.js";
import { Withdrawal } from "../../models/withdrawal.model.js";
import type { WithdrawalMethod, WithdrawalRole } from "../../models/withdrawal.model.js";
import { User } from "../../models/user.model.js";
import {
  escapeRegex,
  formatDisplayDate,
  formatMoney,
  httpError,
  listMeta,
  parseMoneyToCents,
  parsePageLimit,
} from "./admin.helpers.js";

function genTxnId(prefix: string) {
  const stamp = Date.now().toString(36).toUpperCase();
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `${prefix}-${stamp}-${rand}`;
}

async function resolveUserFields(userId?: string) {
  if (!userId || !mongoose.isValidObjectId(userId)) {
    return { userName: "", email: "", avatar: "" };
  }
  const u = await User.findById(userId).select("name email avatar").lean();
  return {
    userName: u?.name ?? "",
    email: u?.email ?? "",
    avatar: u?.avatar ?? "",
  };
}

// ── Subscription plans ───────────────────────────────

export async function listSubscriptionPlans(query: Record<string, unknown>) {
  const { page, limit, skip } = parsePageLimit(query);
  const filter: Record<string, unknown> = {};

  if (query.isActive === "true") filter.isActive = true;
  if (query.isActive === "false") filter.isActive = false;

  if (typeof query.search === "string" && query.search.trim()) {
    const rx = new RegExp(escapeRegex(query.search.trim()), "i");
    filter.$or = [{ name: rx }, { description: rx }];
  }

  const [total, docs, activeCount] = await Promise.all([
    SubscriptionPlan.countDocuments(filter),
    SubscriptionPlan.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    SubscriptionPlan.countDocuments({ isActive: true }),
  ]);

  return {
    data: docs.map((p) => ({
      id: p._id.toString(),
      name: p.name,
      description: p.description ?? "",
      price: p.priceCents / 100,
      priceFormatted: formatMoney(p.priceCents),
      billingCycle: p.billingCycle,
      features: p.features ?? [],
      isActive: p.isActive,
      trialPeriod: p.trialPeriodDays ?? 0,
      subscribers: p.subscribersCount ?? 0,
      createdAt: formatDisplayDate(p.createdAt),
    })),
    meta: listMeta(page, limit, total),
    stats: {
      totalPlans: total,
      activePlans: activeCount,
    },
  };
}

export async function createSubscriptionPlan(body: Record<string, unknown>) {
  const name = String(body.name ?? "").trim();
  if (!name) throw httpError("name is required", 400);

  const priceCents =
    body.priceCents !== undefined
      ? Number(body.priceCents)
      : parseMoneyToCents(body.price);

  const plan = await SubscriptionPlan.create({
    name,
    description: String(body.description ?? "").trim(),
    priceCents: Math.max(0, priceCents),
    billingCycle: (body.billingCycle as SubscriptionBillingCycle) ?? "Monthly",
    features: Array.isArray(body.features) ? body.features.map(String) : [],
    isActive: body.isActive !== false,
    trialPeriodDays: Math.max(0, Number(body.trialPeriod) || 0),
  });

  return {
    id: plan._id.toString(),
    name: plan.name,
    description: plan.description,
    price: plan.priceCents / 100,
    billingCycle: plan.billingCycle,
    features: plan.features,
    isActive: plan.isActive,
    trialPeriod: plan.trialPeriodDays,
    subscribers: plan.subscribersCount,
    createdAt: formatDisplayDate(plan.createdAt),
  };
}

export async function updateSubscriptionPlan(
  id: string,
  body: Record<string, unknown>
) {
  if (!mongoose.isValidObjectId(id)) throw httpError("Invalid id", 400);
  const plan = await SubscriptionPlan.findById(id);
  if (!plan) throw httpError("Plan not found", 404);

  if (body.name !== undefined) plan.name = String(body.name).trim();
  if (body.description !== undefined) {
    plan.description = String(body.description).trim();
  }
  if (body.price !== undefined || body.priceCents !== undefined) {
    plan.priceCents =
      body.priceCents !== undefined
        ? Math.max(0, Number(body.priceCents))
        : parseMoneyToCents(body.price);
  }
  if (body.billingCycle !== undefined) {
    plan.billingCycle = body.billingCycle as SubscriptionBillingCycle;
  }
  if (Array.isArray(body.features)) plan.features = body.features.map(String);
  if (body.isActive !== undefined) plan.isActive = Boolean(body.isActive);
  if (body.trialPeriod !== undefined) {
    plan.trialPeriodDays = Math.max(0, Number(body.trialPeriod) || 0);
  }

  await plan.save();
  return {
    id: plan._id.toString(),
    name: plan.name,
    description: plan.description,
    price: plan.priceCents / 100,
    billingCycle: plan.billingCycle,
    features: plan.features,
    isActive: plan.isActive,
    trialPeriod: plan.trialPeriodDays,
    subscribers: plan.subscribersCount,
    createdAt: formatDisplayDate(plan.createdAt),
  };
}

export async function deleteSubscriptionPlan(id: string) {
  if (!mongoose.isValidObjectId(id)) throw httpError("Invalid id", 400);
  const active = await UserSubscription.countDocuments({
    plan: id,
    status: "Active",
  });
  if (active > 0) {
    throw httpError("Cannot delete plan with active subscriptions", 409);
  }
  const result = await SubscriptionPlan.deleteOne({ _id: id });
  if (!result.deletedCount) throw httpError("Plan not found", 404);
  return { message: "Deleted", id };
}

// ── Subscriptions ────────────────────────────────────

function mapSubscription(
  s: {
    _id: { toString(): string };
    planName?: string;
    amountCents?: number;
    billing?: string;
    startDate?: Date;
    expiryDate?: Date | null;
    autoRenew?: boolean;
    paymentStatus?: string;
    status?: string;
    transactionId?: string;
    createdAt?: Date;
  },
  user?: { name?: string; email?: string; avatar?: string } | null
) {
  return {
    id: s._id.toString(),
    name: user?.name ?? "",
    email: user?.email ?? "",
    avatar: user?.avatar ?? "",
    plan: s.planName ?? "Monthly",
    amount: formatMoney(s.amountCents ?? 0),
    amountCents: s.amountCents ?? 0,
    billing: s.billing ?? "Monthly",
    startDate: formatDisplayDate(s.startDate),
    expiryDate: formatDisplayDate(s.expiryDate),
    autoRenew: Boolean(s.autoRenew),
    paymentStatus: s.paymentStatus ?? "Paid",
    status: s.status ?? "Active",
    transactionId: s.transactionId ?? "",
    createdAt: formatDisplayDate(s.createdAt),
  };
}

export async function listSubscriptions(query: Record<string, unknown>) {
  const { page, limit, skip } = parsePageLimit(query);
  const filter: Record<string, unknown> = {};

  if (typeof query.status === "string" && query.status !== "All") {
    filter.status = query.status;
  }
  if (typeof query.plan === "string" && query.plan !== "All") {
    filter.planName = query.plan;
  }
  if (typeof query.paymentStatus === "string" && query.paymentStatus !== "All") {
    filter.paymentStatus = query.paymentStatus;
  }
  if (typeof query.search === "string" && query.search.trim()) {
    const rx = new RegExp(escapeRegex(query.search.trim()), "i");
    const users = await User.find({
      $or: [{ name: rx }, { email: rx }],
      role: { $ne: "admin" },
    })
      .select("_id")
      .lean();
    filter.user = { $in: users.map((u) => u._id) };
  }

  const [total, docs, statsRows] = await Promise.all([
    UserSubscription.countDocuments(filter),
    UserSubscription.find(filter)
      .populate("user", "name email avatar")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    UserSubscription.aggregate([
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
          revenue: { $sum: "$amountCents" },
        },
      },
    ]),
  ]);

  let active = 0;
  let expired = 0;
  let cancelled = 0;
  let revenueCents = 0;
  for (const row of statsRows) {
    revenueCents += row.revenue ?? 0;
    if (row._id === "Active") active = row.count;
    if (row._id === "Expired") expired = row.count;
    if (row._id === "Cancelled") cancelled = row.count;
  }

  return {
    data: docs.map((s) =>
      mapSubscription(
        s,
        s.user as { name?: string; email?: string; avatar?: string } | null
      )
    ),
    meta: listMeta(page, limit, total),
    stats: {
      totalSubscriptions: total,
      activeSubscriptions: active,
      expiredSubscriptions: expired,
      cancelledSubscriptions: cancelled,
      totalRevenue: formatMoney(revenueCents),
      totalRevenueCents: revenueCents,
    },
  };
}

export async function getSubscription(id: string) {
  if (!mongoose.isValidObjectId(id)) throw httpError("Invalid id", 400);
  const s = await UserSubscription.findById(id)
    .populate("user", "name email avatar")
    .lean();
  if (!s) throw httpError("Subscription not found", 404);
  return mapSubscription(
    s,
    s.user as { name?: string; email?: string; avatar?: string } | null
  );
}

export async function createSubscription(body: Record<string, unknown>) {
  const userId = String(body.userId ?? body.user ?? "").trim();
  if (!mongoose.isValidObjectId(userId)) {
    throw httpError("userId is required", 400);
  }
  const user = await User.findById(userId);
  if (!user || user.role === "admin") throw httpError("User not found", 404);

  let planName = String(body.plan ?? body.planName ?? "Monthly");
  let amountCents = parseMoneyToCents(body.amount);
  let billing = String(body.billing ?? planName);
  let planId = null;

  if (body.planId && mongoose.isValidObjectId(String(body.planId))) {
    const plan = await SubscriptionPlan.findById(String(body.planId));
    if (plan) {
      planId = plan._id;
      planName = plan.name;
      amountCents = plan.priceCents;
      billing = plan.billingCycle;
      plan.subscribersCount += 1;
      await plan.save();
    }
  }

  const txnId = String(body.transactionId ?? genTxnId("SUB"));
  const sub = await UserSubscription.create({
    user: userId,
    plan: planId,
    planName,
    amountCents,
    billing,
    startDate: body.startDate ? new Date(String(body.startDate)) : new Date(),
    expiryDate: body.expiryDate ? new Date(String(body.expiryDate)) : null,
    autoRenew: body.autoRenew !== false,
    paymentStatus: (body.paymentStatus as SubscriptionPaymentStatus) ?? "Paid",
    status: (body.status as SubscriptionStatus) ?? "Active",
    transactionId: txnId,
  });

  await PlatformTransaction.create({
    user: userId,
    userName: user.name,
    email: user.email,
    avatar: user.avatar ?? "",
    type: "Subscription",
    amountCents,
    method: String(body.paymentMethod ?? "Card"),
    transactionId: txnId,
    status: sub.paymentStatus === "Paid" ? "Completed" : "Pending",
    description: `${planName} subscription`,
    metadata: { plan: planName, duration: billing },
    occurredAt: sub.startDate,
  });

  return getSubscription(sub._id.toString());
}

export async function updateSubscription(
  id: string,
  body: Record<string, unknown>
) {
  if (!mongoose.isValidObjectId(id)) throw httpError("Invalid id", 400);
  const sub = await UserSubscription.findById(id);
  if (!sub) throw httpError("Subscription not found", 404);

  if (body.plan !== undefined || body.planName !== undefined) {
    sub.planName = String(body.plan ?? body.planName);
  }
  if (body.amount !== undefined) {
    sub.amountCents = parseMoneyToCents(body.amount);
  }
  if (body.billing !== undefined) sub.billing = String(body.billing);
  if (body.autoRenew !== undefined) sub.autoRenew = Boolean(body.autoRenew);
  if (body.paymentStatus !== undefined) {
    sub.paymentStatus = body.paymentStatus as SubscriptionPaymentStatus;
  }
  if (body.status !== undefined) sub.status = body.status as SubscriptionStatus;
  if (body.expiryDate !== undefined) {
    sub.expiryDate = body.expiryDate ? new Date(String(body.expiryDate)) : null;
  }

  await sub.save();
  return getSubscription(id);
}

export async function deleteSubscription(id: string) {
  if (!mongoose.isValidObjectId(id)) throw httpError("Invalid id", 400);
  const sub = await UserSubscription.findById(id);
  if (!sub) throw httpError("Subscription not found", 404);
  if (sub.plan) {
    await SubscriptionPlan.updateOne(
      { _id: sub.plan, subscribersCount: { $gt: 0 } },
      { $inc: { subscribersCount: -1 } }
    );
  }
  await sub.deleteOne();
  return { message: "Deleted", id };
}

// ── Donations ────────────────────────────────────────

function mapDonation(d: {
  _id: { toString(): string };
  donorName: string;
  donorEmail?: string;
  amountCents: number;
  type?: string;
  donatedTo?: string;
  recipientName?: string;
  paymentMethod?: string;
  transactionId?: string;
  status?: string;
  description?: string;
  receiptUrl?: string;
  donatedAt?: Date;
  user?: { avatar?: string } | mongoose.Types.ObjectId | null;
}) {
  return {
    id: d._id.toString(),
    donorName: d.donorName,
    donorEmail: d.donorEmail ?? "",
    avatar:
      d.user &&
      typeof d.user === "object" &&
      "avatar" in d.user
        ? String((d.user as { avatar?: string }).avatar ?? "")
        : "",
    amount: formatMoney(d.amountCents),
    amountCents: d.amountCents,
    type: d.type ?? "One-Time",
    donatedTo: d.donatedTo ?? "App",
    recipientName: d.recipientName ?? "",
    paymentMethod: d.paymentMethod ?? "Card",
    transactionId: d.transactionId ?? "",
    status: d.status ?? "Completed",
    donatedAt: formatDisplayDate(d.donatedAt),
    description: d.description ?? "",
    receiptUrl: d.receiptUrl ?? "",
  };
}

export async function listDonations(query: Record<string, unknown>) {
  const { page, limit, skip } = parsePageLimit(query);
  const filter: Record<string, unknown> = {};

  if (typeof query.status === "string" && query.status !== "All") {
    filter.status = query.status;
  }
  if (typeof query.type === "string" && query.type !== "All") {
    filter.type = query.type;
  }
  if (typeof query.donatedTo === "string" && query.donatedTo !== "All") {
    filter.donatedTo = query.donatedTo;
  }
  if (typeof query.search === "string" && query.search.trim()) {
    const rx = new RegExp(escapeRegex(query.search.trim()), "i");
    filter.$or = [
      { donorName: rx },
      { donorEmail: rx },
      { recipientName: rx },
      { transactionId: rx },
    ];
  }

  const [total, docs, agg] = await Promise.all([
    Donation.countDocuments(filter),
    Donation.find(filter)
      .populate("user", "avatar")
      .sort({ donatedAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Donation.aggregate([
      { $match: filter },
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
          total: { $sum: "$amountCents" },
        },
      },
    ]),
  ]);

  let completedTotal = 0;
  let pendingCount = 0;
  for (const row of agg) {
    if (row._id === "Completed") completedTotal = row.total ?? 0;
    if (row._id === "Pending") pendingCount = row.count ?? 0;
  }

  return {
    data: docs.map((d) => mapDonation(d)),
    meta: listMeta(page, limit, total),
    stats: {
      totalDonations: total,
      totalRaised: formatMoney(completedTotal),
      totalRaisedCents: completedTotal,
      pendingDonations: pendingCount,
    },
  };
}

export async function getDonation(id: string) {
  if (!mongoose.isValidObjectId(id)) throw httpError("Invalid id", 400);
  const d = await Donation.findById(id).populate("user", "avatar").lean();
  if (!d) throw httpError("Donation not found", 404);
  return mapDonation(d);
}

export async function createDonation(body: Record<string, unknown>) {
  const donorName = String(body.donorName ?? body.name ?? "").trim();
  if (!donorName) throw httpError("donorName is required", 400);

  const amountCents = parseMoneyToCents(body.amount);
  if (amountCents <= 0) throw httpError("amount must be greater than 0", 400);

  const userId = body.userId ? String(body.userId) : "";
  let avatar = "";
  if (userId && mongoose.isValidObjectId(userId)) {
    const u = await User.findById(userId).select("avatar name email").lean();
    avatar = u?.avatar ?? "";
  }

  const txnId = String(body.transactionId ?? genTxnId("DON"));
  const donation = await Donation.create({
    user: userId && mongoose.isValidObjectId(userId) ? userId : null,
    donorName,
    donorEmail: String(body.donorEmail ?? body.email ?? "").trim(),
    amountCents,
    type: (body.type as DonationType) ?? "One-Time",
    donatedTo: (body.donatedTo as DonationRecipientType) ?? "App",
    recipientName: String(body.recipientName ?? "").trim(),
    recipientRef: String(body.recipientRef ?? "").trim(),
    paymentMethod: String(body.paymentMethod ?? "Card"),
    transactionId: txnId,
    status: (body.status as DonationStatus) ?? "Completed",
    description: String(body.description ?? "").trim(),
    receiptUrl: String(body.receiptUrl ?? "").trim(),
    donatedAt: body.donatedAt ? new Date(String(body.donatedAt)) : new Date(),
  });

  await PlatformTransaction.create({
    user: donation.user,
    userName: donorName,
    email: donation.donorEmail,
    avatar,
    type: "Donation",
    amountCents,
    method: donation.paymentMethod,
    transactionId: txnId,
    status: donation.status === "Completed" ? "Completed" : "Pending",
    description: donation.description || `Donation to ${donation.recipientName || donation.donatedTo}`,
    metadata: { donatedTo: donation.donatedTo, recipientName: donation.recipientName },
    occurredAt: donation.donatedAt,
  });

  return getDonation(donation._id.toString());
}

// ── Wallet ───────────────────────────────────────────

function mapWalletTransaction(t: {
  _id: { toString(): string };
  userName?: string;
  email?: string;
  avatar?: string;
  coins?: number;
  amountCents: number;
  type: string;
  method?: string;
  status?: string;
  description?: string;
  transactionId?: string;
  metadata?: Record<string, unknown>;
  occurredAt?: Date;
}) {
  return {
    id: t._id.toString(),
    userName: t.userName ?? "",
    email: t.email ?? "",
    avatar: t.avatar ?? "",
    coins: t.coins ?? 0,
    amount: formatMoney(Math.abs(t.amountCents)),
    amountCents: t.amountCents,
    type: t.type,
    paymentMethod: t.method ?? "Card",
    status: t.status ?? "Completed",
    date: formatDisplayDate(t.occurredAt),
    description: t.description ?? "",
    transactionId: t.transactionId ?? "",
    metadata: t.metadata ?? {},
  };
}

export async function getWalletSummary() {
  const [completedAgg, pendingCount, coinAgg] = await Promise.all([
    PlatformTransaction.aggregate([
      { $match: { status: "Completed" } },
      { $group: { _id: null, total: { $sum: "$amountCents" } } },
    ]),
    PlatformTransaction.countDocuments({ status: "Pending" }),
    PlatformTransaction.aggregate([
      { $match: { status: "Completed" } },
      { $group: { _id: null, coins: { $sum: "$coins" } } },
    ]),
  ]);

  const totalRevenueCents = completedAgg[0]?.total ?? 0;
  const totalCoins = coinAgg[0]?.coins ?? 0;

  return {
    totalBalance: formatMoney(totalRevenueCents),
    totalBalanceCents: totalRevenueCents,
    totalCoins,
    pendingTransactions: pendingCount,
    completedTransactions: await PlatformTransaction.countDocuments({
      status: "Completed",
    }),
  };
}

export async function listWalletTransactions(query: Record<string, unknown>) {
  const { page, limit, skip } = parsePageLimit(query);
  const filter: Record<string, unknown> = {};

  if (typeof query.type === "string" && query.type !== "All") {
    filter.type = query.type;
  }
  if (typeof query.status === "string" && query.status !== "All") {
    filter.status = query.status;
  }
  if (typeof query.search === "string" && query.search.trim()) {
    const rx = new RegExp(escapeRegex(query.search.trim()), "i");
    filter.$or = [
      { userName: rx },
      { email: rx },
      { transactionId: rx },
      { description: rx },
    ];
  }

  const [total, docs] = await Promise.all([
    PlatformTransaction.countDocuments(filter),
    PlatformTransaction.find(filter)
      .sort({ occurredAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
  ]);

  return {
    data: docs.map((t) => mapWalletTransaction(t)),
    meta: listMeta(page, limit, total),
  };
}

// ── Withdrawals ────────────────────────────────────────

function mapWithdrawal(w: {
  _id: { toString(): string };
  name: string;
  email?: string;
  avatar?: string;
  role?: string;
  amountCents: number;
  method?: string;
  account?: string;
  status?: string;
  transactionId?: string;
  requestedAt?: Date;
  processedAt?: Date | null;
}) {
  return {
    id: w._id.toString(),
    name: w.name,
    email: w.email ?? "",
    avatar: w.avatar ?? "",
    role: w.role ?? "User",
    amount: formatMoney(w.amountCents),
    amountCents: w.amountCents,
    method: w.method ?? "Bank",
    account: w.account ?? "",
    status: w.status ?? "Pending",
    transactionId: w.transactionId ?? "",
    requestedAt: w.requestedAt?.toISOString() ?? "",
    processedAt: w.processedAt?.toISOString() ?? "",
  };
}

export async function listWithdrawals(query: Record<string, unknown>) {
  const { page, limit, skip } = parsePageLimit(query);
  const filter: Record<string, unknown> = {};

  if (typeof query.status === "string" && query.status !== "All") {
    filter.status = query.status;
  }
  if (typeof query.role === "string" && query.role !== "All") {
    filter.role = query.role;
  }
  if (typeof query.method === "string" && query.method !== "All") {
    filter.method = query.method;
  }
  if (typeof query.search === "string" && query.search.trim()) {
    const rx = new RegExp(escapeRegex(query.search.trim()), "i");
    filter.$or = [{ name: rx }, { email: rx }, { transactionId: rx }];
  }

  const [total, docs, agg] = await Promise.all([
    Withdrawal.countDocuments(filter),
    Withdrawal.find(filter).sort({ requestedAt: -1 }).skip(skip).limit(limit).lean(),
    Withdrawal.aggregate([
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
          total: { $sum: "$amountCents" },
        },
      },
    ]),
  ]);

  let pending = 0;
  let paidAmount = 0;
  let rejected = 0;
  for (const row of agg) {
    if (row._id === "Pending") pending = row.count;
    if (row._id === "Paid") paidAmount = row.total ?? 0;
    if (row._id === "Rejected") rejected = row.count;
  }

  return {
    data: docs.map((w) => mapWithdrawal(w)),
    meta: listMeta(page, limit, total),
    stats: {
      pendingRequests: pending,
      paidAmount: formatMoney(paidAmount),
      paidAmountCents: paidAmount,
      rejectedRequests: rejected,
    },
  };
}

export async function getWithdrawal(id: string) {
  if (!mongoose.isValidObjectId(id)) throw httpError("Invalid id", 400);
  const w = await Withdrawal.findById(id).lean();
  if (!w) throw httpError("Withdrawal not found", 404);
  return mapWithdrawal(w);
}

export async function createWithdrawal(body: Record<string, unknown>) {
  const name = String(body.name ?? "").trim();
  if (!name) throw httpError("name is required", 400);
  const amountCents = parseMoneyToCents(body.amount);
  if (amountCents <= 0) throw httpError("amount must be greater than 0", 400);

  const userId = body.userId ? String(body.userId) : "";
  const profile =
    userId && mongoose.isValidObjectId(userId)
      ? await resolveUserFields(userId)
      : { userName: name, email: String(body.email ?? ""), avatar: "" };

  const txnId = String(body.transactionId ?? genTxnId("WD"));
  const withdrawal = await Withdrawal.create({
    user: userId && mongoose.isValidObjectId(userId) ? userId : null,
    name,
    email: profile.email || String(body.email ?? ""),
    avatar: profile.avatar || String(body.avatar ?? ""),
    role: (body.role as WithdrawalRole) ?? "User",
    amountCents,
    method: (body.method as WithdrawalMethod) ?? "Bank",
    account: String(body.account ?? ""),
    status: "Pending",
    transactionId: txnId,
    requestedAt: new Date(),
  });

  const { recordAdminActivity } = await import("./adminActivity.service.js");
  void recordAdminActivity({
    type: "withdrawal_created",
    title: "Withdrawal request created",
    message: `${name} requested ${formatMoney(amountCents)}`,
    refType: "withdrawal",
    refId: withdrawal._id.toString(),
    actorId: userId || undefined,
    meta: { amountCents, method: withdrawal.method },
  });
  void recordAdminActivity({
    type: "moderation_required",
    title: "Moderation action required",
    message: `Withdrawal pending review: ${name}`,
    refType: "withdrawal",
    refId: withdrawal._id.toString(),
    actorId: userId || undefined,
  });

  return mapWithdrawal(withdrawal);
}

export async function approveWithdrawal(id: string, adminUserId?: string) {
  if (!mongoose.isValidObjectId(id)) throw httpError("Invalid id", 400);
  const w = await Withdrawal.findById(id);
  if (!w) throw httpError("Withdrawal not found", 404);
  if (w.status !== "Pending") {
    throw httpError("Only pending withdrawals can be approved", 409);
  }

  w.status = "Paid";
  w.processedAt = new Date();
  if (adminUserId && mongoose.isValidObjectId(adminUserId)) {
    w.processedBy = new mongoose.Types.ObjectId(adminUserId);
  }
  await w.save();

  await PlatformTransaction.create({
    user: w.user,
    userName: w.name,
    email: w.email,
    avatar: w.avatar,
    type: "Withdrawal",
    amountCents: w.amountCents,
    method: w.method,
    transactionId: w.transactionId,
    status: "Completed",
    description: `Withdrawal via ${w.method}`,
    metadata: { account: w.account, role: w.role },
    occurredAt: w.processedAt,
  });

  return mapWithdrawal(w);
}

export async function rejectWithdrawal(
  id: string,
  body: Record<string, unknown>,
  adminUserId?: string
) {
  if (!mongoose.isValidObjectId(id)) throw httpError("Invalid id", 400);
  const w = await Withdrawal.findById(id);
  if (!w) throw httpError("Withdrawal not found", 404);
  if (w.status !== "Pending") {
    throw httpError("Only pending withdrawals can be rejected", 409);
  }

  w.status = "Rejected";
  w.rejectReason = String(body.reason ?? "").trim();
  w.processedAt = new Date();
  if (adminUserId && mongoose.isValidObjectId(adminUserId)) {
    w.processedBy = new mongoose.Types.ObjectId(adminUserId);
  }
  await w.save();
  return mapWithdrawal(w);
}

// ── Transactions (ledger) ────────────────────────────

function mapTransaction(t: {
  _id: { toString(): string };
  userName?: string;
  email?: string;
  avatar?: string;
  type: string;
  amountCents: number;
  method?: string;
  transactionId?: string;
  status?: string;
  description?: string;
  metadata?: Record<string, unknown>;
  occurredAt?: Date;
}) {
  return {
    id: t._id.toString(),
    userName: t.userName ?? "",
    email: t.email ?? "",
    avatar: t.avatar ?? "",
    type: t.type,
    amount: formatMoney(Math.abs(t.amountCents)),
    amountCents: t.amountCents,
    method: t.method ?? "Card",
    transactionId: t.transactionId ?? "",
    status: t.status ?? "Completed",
    date: formatDisplayDate(t.occurredAt),
    description: t.description ?? "",
    metadata: t.metadata ?? {},
  };
}

export async function listTransactions(query: Record<string, unknown>) {
  const { page, limit, skip } = parsePageLimit(query);
  const filter: Record<string, unknown> = {};

  if (typeof query.type === "string" && query.type !== "All") {
    filter.type = query.type;
  }
  if (typeof query.status === "string" && query.status !== "All") {
    filter.status = query.status;
  }
  if (typeof query.search === "string" && query.search.trim()) {
    const rx = new RegExp(escapeRegex(query.search.trim()), "i");
    filter.$or = [
      { userName: rx },
      { email: rx },
      { transactionId: rx },
      { description: rx },
    ];
  }

  const [total, docs, agg] = await Promise.all([
    PlatformTransaction.countDocuments(filter),
    PlatformTransaction.find(filter)
      .sort({ occurredAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    PlatformTransaction.aggregate([
      { $match: filter },
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
          total: { $sum: "$amountCents" },
        },
      },
    ]),
  ]);

  let completedTotal = 0;
  let pendingCount = 0;
  let failedCount = 0;
  for (const row of agg) {
    if (row._id === "Completed") completedTotal = row.total ?? 0;
    if (row._id === "Pending") pendingCount = row.count ?? 0;
    if (row._id === "Failed") failedCount = row.count ?? 0;
  }

  return {
    data: docs.map((t) => mapTransaction(t)),
    meta: listMeta(page, limit, total),
    stats: {
      totalTransactions: total,
      completedVolume: formatMoney(completedTotal),
      completedVolumeCents: completedTotal,
      pendingTransactions: pendingCount,
      failedTransactions: failedCount,
    },
  };
}

export async function getTransaction(id: string) {
  if (!mongoose.isValidObjectId(id)) throw httpError("Invalid id", 400);
  const t = await PlatformTransaction.findById(id).lean();
  if (!t) throw httpError("Transaction not found", 404);
  return mapTransaction(t);
}
