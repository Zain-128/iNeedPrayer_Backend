import Stripe from "stripe";
import {
  STRIPE_SECRET_KEY,
  STRIPE_WEBHOOK_SECRET,
  COINS_PACKAGES,
  PUBLIC_BASE_URL,
} from "../contants.js";
import { User } from "../models/user.model.js";
import { UserCoins, CoinPurchase } from "../models/coins.model.js";
import { UserSubscription } from "../models/userSubscription.model.js";
import { SubscriptionPlan } from "../models/subscriptionPlan.model.js";
import { PlatformTransaction } from "../models/platformTransaction.model.js";

let _stripe: Stripe | null = null;

export function getStripe(): Stripe {
  if (!STRIPE_SECRET_KEY) {
    throw new Error("STRIPE_SECRET_KEY is not configured");
  }
  if (!_stripe) {
    _stripe = new Stripe(STRIPE_SECRET_KEY, {
      apiVersion: "2025-07-30.basil" as Stripe.LatestApiVersion,
    });
  }
  return _stripe;
}

export function constructWebhookEvent(body: Buffer, sig: string): Stripe.Event {
  if (!STRIPE_WEBHOOK_SECRET) {
    throw new Error("STRIPE_WEBHOOK_SECRET is not configured");
  }
  return getStripe().webhooks.constructEvent(body, sig, STRIPE_WEBHOOK_SECRET);
}

/* ─── Subscription Checkout ─── */

export async function createSubscriptionCheckout(userId: string, planId: string) {
  const user = await User.findById(userId);
  if (!user) {
    const err = new Error("User not found");
    (err as any).statusCode = 404;
    throw err;
  }

  const plan = await SubscriptionPlan.findById(planId);
  if (!plan || !plan.isActive) {
    const err = new Error("Plan not found or inactive");
    (err as any).statusCode = 404;
    throw err;
  }

  const stripe = getStripe();
  const baseUrl = PUBLIC_BASE_URL || "http://localhost:3004";

  // Find or create Stripe customer
  let customerId = (user as any).stripeCustomerId;
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: user.email,
      name: user.name,
      metadata: { userId: user._id.toString() },
    });
    customerId = customer.id;
    await User.findByIdAndUpdate(userId, { stripeCustomerId: customerId });
  }

  // Determine Stripe Price ID from plan
  const priceAmount = plan.priceCents;
  const interval: Stripe.SubscriptionCreateParams.Item.PriceData.Recurring.Interval =
    plan.billingCycle === "Yearly" ? "year" : "month";

  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: "subscription",
    payment_method_types: ["card"],
    line_items: [
      {
        price_data: {
          currency: "usd",
          product_data: {
            name: plan.name,
            description: plan.description || `${plan.name} subscription`,
            metadata: { planId: plan._id.toString() },
          },
          unit_amount: priceAmount,
          recurring: { interval },
        },
        quantity: 1,
      },
    ],
    success_url: `${baseUrl}/subscription/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${baseUrl}/subscription/cancel`,
    metadata: {
      userId: userId,
      planId: plan._id.toString(),
      planName: plan.name,
      billingCycle: plan.billingCycle,
    },
  });

  return { sessionId: session.id, url: session.url };
}

/* ─── Coins Checkout ─── */

export async function createCoinsCheckout(userId: string, packageIndex: number) {
  const pkg = COINS_PACKAGES[packageIndex];
  if (!pkg) {
    const err = new Error("Invalid coins package");
    (err as any).statusCode = 400;
    throw err;
  }

  const user = await User.findById(userId);
  if (!user) {
    const err = new Error("User not found");
    (err as any).statusCode = 404;
    throw err;
  }

  const stripe = getStripe();
  const baseUrl = PUBLIC_BASE_URL || "http://localhost:3004";

  let customerId = (user as any).stripeCustomerId;
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: user.email,
      name: user.name,
      metadata: { userId: user._id.toString() },
    });
    customerId = customer.id;
    await User.findByIdAndUpdate(userId, { stripeCustomerId: customerId });
  }

  // Create pending purchase
  const purchase = await CoinPurchase.create({
    user: userId,
    coins: pkg.coins,
    amountCents: pkg.priceCents,
    packageLabel: pkg.label,
    status: "Pending",
  });

  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: "payment",
    payment_method_types: ["card"],
    line_items: [
      {
        price_data: {
          currency: "usd",
          product_data: {
            name: pkg.label,
            description: `Purchase ${pkg.coins} coins`,
          },
          unit_amount: pkg.priceCents,
        },
        quantity: 1,
      },
    ],
    success_url: `${baseUrl}/coins/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${baseUrl}/coins/cancel`,
    metadata: {
      userId: userId,
      coins: pkg.coins.toString(),
      purchaseId: purchase._id.toString(),
      packageLabel: pkg.label,
    },
  });

  await CoinPurchase.findByIdAndUpdate(purchase._id, {
    stripeSessionId: session.id,
  });

  return { sessionId: session.id, url: session.url };
}

/* ─── Webhook Handlers ─── */

export async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  const metadata = session.metadata;
  if (!metadata) return;

  // Subscription checkout
  if (metadata.planId && metadata.userId) {
    const existing = await UserSubscription.findOne({
      user: metadata.userId,
      status: "Active",
    });
    if (existing) return; // already active

    const expiryDate = new Date();
    if (metadata.billingCycle === "Yearly") {
      expiryDate.setFullYear(expiryDate.getFullYear() + 1);
    } else {
      expiryDate.setMonth(expiryDate.getMonth() + 1);
    }

    await UserSubscription.create({
      user: metadata.userId,
      plan: metadata.planId,
      planName: metadata.planName,
      amountCents: session.amount_total ?? 0,
      billing: metadata.billingCycle,
      startDate: new Date(),
      expiryDate,
      autoRenew: true,
      paymentStatus: "Paid",
      status: "Active",
      transactionId: session.payment_intent as string,
    });

    // Update subscribers count
    await SubscriptionPlan.findByIdAndUpdate(metadata.planId, {
      $inc: { subscribersCount: 1 },
    });

    // Record transaction
    const user = await User.findById(metadata.userId).lean();
    await PlatformTransaction.create({
      user: metadata.userId,
      userName: user?.name ?? "",
      email: user?.email ?? "",
      type: "Subscription",
      amountCents: session.amount_total ?? 0,
      transactionId: session.payment_intent as string,
      status: "Completed",
      description: `${metadata.planName} subscription`,
    });
  }

  // Coins purchase
  if (metadata.coins && metadata.userId && metadata.purchaseId) {
    const coins = parseInt(metadata.coins, 10);
    if (isNaN(coins) || coins <= 0) return;

    const purchase = await CoinPurchase.findById(metadata.purchaseId);
    if (!purchase || purchase.status === "Completed") return;

    await CoinPurchase.findByIdAndUpdate(metadata.purchaseId, {
      status: "Completed",
      stripePaymentIntentId: session.payment_intent as string,
    });

    // Credit coins
    await UserCoins.findOneAndUpdate(
      { user: metadata.userId },
      {
        $inc: { balance: coins, totalPurchased: coins },
        $setOnInsert: { user: metadata.userId },
      },
      { upsert: true }
    );

    const { WalletLedger } = await import("../models/walletLedger.model.js");
    await WalletLedger.create({
      kind: "purchase",
      toOwnerType: "user",
      toOwnerId: metadata.userId,
      coins,
      feeCoins: 0,
      netCoins: coins,
      message: metadata.packageLabel || `${coins} coins purchased`,
      actorUserId: metadata.userId,
      metadata: { purchaseId: metadata.purchaseId },
    });

    // Record transaction
    const user = await User.findById(metadata.userId).lean();
    await PlatformTransaction.create({
      user: metadata.userId,
      userName: user?.name ?? "",
      email: user?.email ?? "",
      type: "Coins Purchase",
      amountCents: session.amount_total ?? 0,
      coins,
      transactionId: session.payment_intent as string,
      status: "Completed",
      description: metadata.packageLabel || `${coins} coins`,
    });
  }
}

export async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  const subId = subscription.id;
  const userSub = await UserSubscription.findOne({ transactionId: subId });
  if (userSub && userSub.status === "Active") {
    userSub.status = "Cancelled";
    userSub.autoRenew = false;
    await userSub.save();
  }
}

/* ─── User Queries ─── */

export async function getUserSubscription(userId: string) {
  const sub = await UserSubscription.findOne({ user: userId, status: "Active" })
    .populate("plan")
    .sort({ createdAt: -1 })
    .lean();

  return sub || null;
}

export async function getUserCoins(userId: string) {
  const coins = await UserCoins.findOne({ user: userId }).lean();
  return { balance: coins?.balance ?? 0, totalPurchased: coins?.totalPurchased ?? 0 };
}

export async function createCustomCoinsCheckout(userId: string, coinsRaw: number) {
  const { priceCustomCoins } = await import("./wallet.service.js");
  const pkg = priceCustomCoins(Math.floor(coinsRaw));

  const user = await User.findById(userId);
  if (!user) {
    const err = new Error("User not found");
    (err as any).statusCode = 404;
    throw err;
  }

  const stripe = getStripe();
  const baseUrl = PUBLIC_BASE_URL || "http://localhost:3004";

  let customerId = (user as any).stripeCustomerId;
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: user.email,
      name: user.name,
      metadata: { userId: user._id.toString() },
    });
    customerId = customer.id;
    await User.findByIdAndUpdate(userId, { stripeCustomerId: customerId });
  }

  const purchase = await CoinPurchase.create({
    user: userId,
    coins: pkg.coins,
    amountCents: pkg.priceCents,
    packageLabel: pkg.label,
    status: "Pending",
  });

  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: "payment",
    payment_method_types: ["card"],
    line_items: [
      {
        price_data: {
          currency: "usd",
          product_data: {
            name: pkg.label,
            description: `Purchase ${pkg.coins} coins`,
          },
          unit_amount: pkg.priceCents,
        },
        quantity: 1,
      },
    ],
    success_url: `${baseUrl}/coins/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${baseUrl}/coins/cancel`,
    metadata: {
      userId: userId,
      coins: pkg.coins.toString(),
      purchaseId: purchase._id.toString(),
      packageLabel: pkg.label,
    },
  });

  await CoinPurchase.findByIdAndUpdate(purchase._id, {
    stripeSessionId: session.id,
  });

  return { sessionId: session.id, url: session.url };
}

export async function getCoinsPackages() {
  return COINS_PACKAGES.map((p, i) => ({
    index: i,
    name: (p as any).name ?? p.label,
    coins: p.coins,
    priceCents: p.priceCents,
    label: p.label,
    tag: (p as { tag?: string }).tag ?? "",
    positioning: (p as any).positioning ?? "",
    bonusText: (p as any).bonusText ?? "",
    priceDisplay: `$${(p.priceCents / 100).toFixed(2)}`,
    appStoreProductId: p.appStoreProductId,
    googlePlayProductId: p.googlePlayProductId,
  }));
}

export async function cancelSubscription(userId: string) {
  const sub = await UserSubscription.findOne({ user: userId, status: "Active" });
  if (!sub) {
    const err = new Error("No active subscription found");
    (err as any).statusCode = 404;
    throw err;
  }

  const stripe = getStripe();

  // Cancel at Stripe if we have a subscription ID
  if (sub.transactionId) {
    try {
      await stripe.subscriptions.cancel(sub.transactionId);
    } catch {
      // subscription may already be cancelled
    }
  }

  sub.status = "Cancelled";
  sub.autoRenew = false;
  await sub.save();

  return { message: "Subscription cancelled" };
}
