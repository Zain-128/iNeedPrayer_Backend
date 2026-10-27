import mongoose from "mongoose";
import { UserSubscription } from "../models/userSubscription.model.js";
import { SubscriptionPlan } from "../models/subscriptionPlan.model.js";
import { Church } from "../models/church.model.js";
import { Group } from "../models/group.model.js";
import * as stripeService from "./stripe.service.js";
export function normalizeTarget(raw) {
    const lower = String(raw ?? "").trim().toLowerCase();
    if (lower === "church" || lower === "churches")
        return "church";
    if (lower === "community" || lower === "communities" || lower === "group" || lower === "groups") {
        return "community";
    }
    return "individual";
}
const DEFAULT_PLANS = [
    // ── INDIVIDUAL PLANS ──
    {
        name: "Monthly Supporter",
        description: "Priority prayer requests, supporter badge, and ad-free experience for individuals.",
        target: "individual",
        tier: "starter",
        badge: "Popular",
        priceCents: 499,
        billingCycle: "Monthly",
        features: [
            "Ad-free prayer experience",
            "Priority prayer request placement",
            "Supporter badge on profile and comments",
            "Unlimited prayer bookmarks",
        ],
        limits: { maxPrayerRequests: 0, liveStreamEnabled: false, analyticsEnabled: false, prioritySupport: false },
        isActive: true,
        trialPeriodDays: 7,
        appStoreProductId: "com.ineedprayer.sub.individual.monthly",
        googlePlayProductId: "com.ineedprayer.sub.individual.monthly",
    },
    {
        name: "Yearly Patron",
        description: "Best annual value for individual supporters with 2 months free and VIP Patron icon.",
        target: "individual",
        tier: "standard",
        badge: "Best Value",
        priceCents: 4999,
        billingCycle: "Yearly",
        features: [
            "All Monthly Supporter features",
            "2 Months Free (Save 16%)",
            "Exclusive VIP Patron Gold Badge",
            "Direct church & community donation tools",
            "Early access to new features",
        ],
        limits: { maxPrayerRequests: 0, liveStreamEnabled: false, analyticsEnabled: false, prioritySupport: true },
        isActive: true,
        trialPeriodDays: 14,
        appStoreProductId: "com.ineedprayer.sub.individual.yearly",
        googlePlayProductId: "com.ineedprayer.sub.individual.yearly",
    },
    // ── COMMUNITY / GROUP PLANS ──
    {
        name: "Community Basic",
        description: "Essential tools to lead, grow, and manage your prayer group or fellowship community.",
        target: "community",
        tier: "starter",
        badge: "Starter",
        priceCents: 999,
        billingCycle: "Monthly",
        features: [
            "Up to 500 active community members",
            "Group prayer wall & praise reports",
            "Community media & audio sharing",
            "Group admin & moderation roles",
        ],
        limits: { maxMembers: 500, maxPrayerRequests: 0, liveStreamEnabled: false, analyticsEnabled: false, prioritySupport: false },
        isActive: true,
        trialPeriodDays: 7,
        appStoreProductId: "com.ineedprayer.sub.community.basic",
        googlePlayProductId: "com.ineedprayer.sub.community.basic",
    },
    {
        name: "Community Pro",
        description: "Empower growing ministries and large prayer groups with unlimited members and audio rooms.",
        target: "community",
        tier: "standard",
        badge: "Most Popular",
        priceCents: 1999,
        billingCycle: "Monthly",
        features: [
            "Unlimited community members",
            "Live audio prayer rooms & fellowship",
            "Pinned group announcements & banners",
            "Community engagement analytics",
            "Priority group support",
        ],
        limits: { maxMembers: 0, maxPrayerRequests: 0, liveStreamEnabled: true, analyticsEnabled: true, prioritySupport: true },
        isActive: true,
        trialPeriodDays: 14,
        appStoreProductId: "com.ineedprayer.sub.community.pro",
        googlePlayProductId: "com.ineedprayer.sub.community.pro",
    },
    {
        name: "Community Annual",
        description: "Full year of Community Pro with 2 months free and featured group placement in discover.",
        target: "community",
        tier: "premium",
        badge: "Save 16%",
        priceCents: 19999,
        billingCycle: "Yearly",
        features: [
            "All Community Pro features",
            "2 Months Free annual savings",
            "Featured placement in Community Search",
            "Custom community header & badges",
            "Dedicated ministry onboarding support",
        ],
        limits: { maxMembers: 0, maxPrayerRequests: 0, liveStreamEnabled: true, analyticsEnabled: true, prioritySupport: true },
        isActive: true,
        trialPeriodDays: 14,
        appStoreProductId: "com.ineedprayer.sub.community.annual",
        googlePlayProductId: "com.ineedprayer.sub.community.annual",
    },
    // ── CHURCH PLANS ──
    {
        name: "Church Starter",
        description: "Official presence, verified badge, and digital prayer wall for your church or parish.",
        target: "church",
        tier: "starter",
        badge: "Verified Church",
        priceCents: 2999,
        billingCycle: "Monthly",
        features: [
            "Official Verified Church Blue Badge",
            "Church member directory & staff roles",
            "Church prayer wall & sermon updates",
            "Digital tithes & donation button",
        ],
        limits: { maxMembers: 1000, maxPrayerRequests: 0, liveStreamEnabled: false, analyticsEnabled: true, prioritySupport: false },
        isActive: true,
        trialPeriodDays: 14,
        appStoreProductId: "com.ineedprayer.sub.church.starter",
        googlePlayProductId: "com.ineedprayer.sub.church.starter",
    },
    {
        name: "Church Growth & Live",
        description: "Complete church ministry suite with HD live streaming, unlimited congregation, and podcast feeds.",
        target: "church",
        tier: "standard",
        badge: "Most Popular",
        priceCents: 4999,
        billingCycle: "Monthly",
        features: [
            "All Church Starter features",
            "HD Sunday Live Stream via Agora",
            "Unlimited church congregation members",
            "Multi-pastor & ministry leader accounts",
            "Sermon podcast & video archives",
            "Congregation giving & tithing analytics",
        ],
        limits: { maxMembers: 0, maxPrayerRequests: 0, liveStreamEnabled: true, analyticsEnabled: true, prioritySupport: true },
        isActive: true,
        trialPeriodDays: 14,
        appStoreProductId: "com.ineedprayer.sub.church.growth",
        googlePlayProductId: "com.ineedprayer.sub.church.growth",
    },
    {
        name: "Church Sanctuary Annual",
        description: "Annual church plan for established ministries with maximum reach, savings, and VIP support.",
        target: "church",
        tier: "premium",
        badge: "Best Value",
        priceCents: 49999,
        billingCycle: "Yearly",
        features: [
            "All Church Growth & Live features",
            "2 Months Free (Save $100/year)",
            "Top featured placement in Church Finder",
            "Priority 24/7 dedicated church support",
            "Custom branded prayer cards for congregation",
            "Full financial audit reports & export",
        ],
        limits: { maxMembers: 0, maxPrayerRequests: 0, liveStreamEnabled: true, analyticsEnabled: true, prioritySupport: true },
        isActive: true,
        trialPeriodDays: 14,
        appStoreProductId: "com.ineedprayer.sub.church.sanctuary",
        googlePlayProductId: "com.ineedprayer.sub.church.sanctuary",
    },
];
export async function ensureSubscriptionPlansSeed() {
    const [indivCount, commCount, churchCount] = await Promise.all([
        SubscriptionPlan.countDocuments({ target: "individual" }),
        SubscriptionPlan.countDocuments({ target: "community" }),
        SubscriptionPlan.countDocuments({ target: "church" }),
    ]);
    const toInsert = [];
    if (indivCount === 0) {
        toInsert.push(...DEFAULT_PLANS.filter((p) => p.target === "individual"));
    }
    if (commCount === 0) {
        toInsert.push(...DEFAULT_PLANS.filter((p) => p.target === "community"));
    }
    if (churchCount === 0) {
        toInsert.push(...DEFAULT_PLANS.filter((p) => p.target === "church"));
    }
    if (toInsert.length > 0) {
        await SubscriptionPlan.insertMany(toInsert);
        console.log(`[subscription] Seeded ${toInsert.length} subscription plans (indiv: ${indivCount}, comm: ${commCount}, church: ${churchCount})`);
    }
}
export function formatPlan(p) {
    const target = p.target || "individual";
    return {
        id: p._id.toString(),
        _id: p._id.toString(),
        name: p.name,
        target,
        tier: p.tier || "starter",
        badge: p.badge || "",
        description: p.description || "",
        priceCents: p.priceCents,
        priceDisplay: `$${(p.priceCents / 100).toFixed(2)}`,
        billingCycle: p.billingCycle,
        features: p.features || [],
        limits: p.limits || {},
        isActive: p.isActive !== false,
        trialPeriodDays: p.trialPeriodDays ?? 0,
        subscribersCount: p.subscribersCount ?? 0,
        appStoreProductId: p.appStoreProductId ||
            `com.ineedprayer.sub.${target}.${String(p.billingCycle).toLowerCase()}`,
        googlePlayProductId: p.googlePlayProductId ||
            `com.ineedprayer.sub.${target}.${String(p.billingCycle).toLowerCase()}`,
    };
}
export async function getActiveSubscriptionPlans(rawTarget) {
    await ensureSubscriptionPlansSeed();
    const query = { isActive: true };
    if (rawTarget && rawTarget !== "all" && rawTarget !== "All") {
        query.target = normalizeTarget(rawTarget);
    }
    const allDocs = await SubscriptionPlan.find(query).sort({ priceCents: 1 }).lean();
    const formatted = allDocs.map(formatPlan);
    // Group by category so clients can consume either flat array or tabs
    const categorized = {
        individual: formatted.filter((p) => p.target === "individual"),
        community: formatted.filter((p) => p.target === "community"),
        church: formatted.filter((p) => p.target === "church"),
    };
    return {
        plans: formatted,
        categorized,
    };
}
export async function getSubscriptionStatus(userId, opts) {
    const target = opts?.target ? normalizeTarget(opts.target) : "individual";
    let filter = { status: "Active" };
    if (target === "church" && opts?.churchId) {
        filter.target = "church";
        filter.church = opts.churchId;
    }
    else if (target === "community" && opts?.communityId) {
        filter.target = "community";
        filter.community = opts.communityId;
    }
    else {
        filter.target = "individual";
        filter.user = userId;
    }
    const activeSub = await UserSubscription.findOne(filter)
        .populate("plan")
        .populate("church", "name image")
        .populate("community", "name image")
        .sort({ createdAt: -1 })
        .lean();
    if (activeSub) {
        const plan = activeSub.plan;
        return {
            active: true,
            target: activeSub.target || target,
            plan: plan?.name || activeSub.planName,
            planId: plan?._id?.toString() || null,
            tier: plan?.tier || "starter",
            badge: plan?.badge || "",
            billingCycle: activeSub.billing,
            amountCents: activeSub.amountCents,
            expiryDate: activeSub.expiryDate,
            autoRenew: activeSub.autoRenew,
            startDate: activeSub.startDate,
            church: activeSub.church
                ? { id: activeSub.church._id?.toString(), name: activeSub.church.name }
                : null,
            community: activeSub.community
                ? { id: activeSub.community._id?.toString(), name: activeSub.community.name }
                : null,
        };
    }
    // Fallback to Stripe check for individual subscription if enabled
    if (target === "individual") {
        try {
            const stripeSub = await stripeService.getUserSubscription(userId);
            if (stripeSub) {
                const plan = stripeSub.plan;
                return {
                    active: true,
                    target: "individual",
                    plan: plan?.name || stripeSub.planName,
                    planId: plan?._id?.toString() || null,
                    billingCycle: stripeSub.billing,
                    expiryDate: stripeSub.expiryDate,
                    autoRenew: stripeSub.autoRenew,
                    startDate: stripeSub.startDate,
                };
            }
        }
        catch {
            // Ignore stripe query failure
        }
    }
    return {
        active: false,
        target,
        plan: "none",
        planId: null,
        billingCycle: null,
        expiryDate: null,
        autoRenew: false,
    };
}
export async function createOrCheckoutSubscription(userId, opts) {
    const plan = await SubscriptionPlan.findById(opts.planId);
    if (!plan) {
        const err = new Error("Subscription plan not found");
        err.statusCode = 404;
        throw err;
    }
    const target = plan.target || normalizeTarget(opts.target);
    let churchDoc = null;
    let communityDoc = null;
    if (target === "church") {
        const churchId = opts.churchId;
        if (!churchId || !mongoose.isValidObjectId(churchId)) {
            const err = new Error("churchId is required for church subscription");
            err.statusCode = 400;
            throw err;
        }
        churchDoc = await Church.findById(churchId);
        if (!churchDoc) {
            const err = new Error("Church not found");
            err.statusCode = 404;
            throw err;
        }
    }
    else if (target === "community") {
        const communityId = opts.communityId;
        if (!communityId || !mongoose.isValidObjectId(communityId)) {
            const err = new Error("communityId is required for community subscription");
            err.statusCode = 400;
            throw err;
        }
        communityDoc = await Group.findById(communityId);
        if (!communityDoc) {
            const err = new Error("Community group not found");
            err.statusCode = 404;
            throw err;
        }
    }
    // If Stripe is configured and in production, create Stripe Checkout
    if (process.env.STRIPE_SECRET_KEY && process.env.STRIPE_SECRET_KEY.startsWith("sk_live")) {
        try {
            const checkout = await stripeService.createSubscriptionCheckout(userId, plan._id.toString());
            return checkout;
        }
        catch (e) {
            console.warn("[subscription] Stripe checkout error, falling back to direct grant:", e?.message);
        }
    }
    // Direct active subscription creation (dev/staging/testing & stub mode)
    const days = plan.billingCycle === "Yearly" ? 365 : plan.billingCycle === "Lifetime" ? 36500 : 30;
    const expiryDate = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
    const sub = await UserSubscription.create({
        user: userId,
        target,
        church: churchDoc?._id ?? null,
        community: communityDoc?._id ?? null,
        plan: plan._id,
        planName: plan.name,
        amountCents: plan.priceCents,
        billing: plan.billingCycle,
        startDate: new Date(),
        expiryDate,
        autoRenew: plan.billingCycle !== "Lifetime",
        paymentStatus: "Paid",
        status: "Active",
        transactionId: `SUB-${Date.now().toString(36).toUpperCase()}`,
    });
    plan.subscribersCount = (plan.subscribersCount ?? 0) + 1;
    await plan.save();
    return {
        success: true,
        active: true,
        message: `${plan.name} activated successfully for ${target}!`,
        subscription: {
            id: sub._id.toString(),
            target,
            planName: plan.name,
            billing: plan.billingCycle,
            startDate: sub.startDate,
            expiryDate: sub.expiryDate,
            autoRenew: sub.autoRenew,
            status: sub.status,
        },
    };
}
export async function cancelSubscription(userId, opts) {
    let filter = { status: "Active" };
    if (opts?.subscriptionId && mongoose.isValidObjectId(opts.subscriptionId)) {
        filter._id = opts.subscriptionId;
    }
    else if (opts?.target === "church" && opts?.churchId) {
        filter.target = "church";
        filter.church = opts.churchId;
    }
    else if (opts?.target === "community" && opts?.communityId) {
        filter.target = "community";
        filter.community = opts.communityId;
    }
    else {
        filter.user = userId;
        filter.target = "individual";
    }
    const sub = await UserSubscription.findOne(filter);
    if (!sub) {
        // Also try canceling in Stripe
        try {
            const stripeRes = await stripeService.cancelSubscription(userId);
            return stripeRes;
        }
        catch {
            const err = new Error("Active subscription not found to cancel");
            err.statusCode = 404;
            throw err;
        }
    }
    sub.status = "Cancelled";
    sub.autoRenew = false;
    sub.cancelAtPeriodEnd = true;
    await sub.save();
    if (sub.plan) {
        await SubscriptionPlan.findByIdAndUpdate(sub.plan, {
            $inc: { subscribersCount: -1 },
        });
    }
    return {
        success: true,
        active: false,
        message: "Subscription cancelled successfully",
        subscription: {
            id: sub._id.toString(),
            status: sub.status,
            cancelAtPeriodEnd: true,
        },
    };
}
