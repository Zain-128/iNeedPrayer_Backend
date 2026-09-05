import mongoose from "mongoose";
import { User } from "../../models/user.model.js";
import { Church } from "../../models/church.model.js";
import { Group } from "../../models/group.model.js";
import { Post } from "../../models/post.model.js";
import { Report } from "../../models/report.model.js";
import { LiveStreamSession } from "../../models/liveStreamSession.model.js";
import { UserSubscription } from "../../models/userSubscription.model.js";
import { Donation } from "../../models/donation.model.js";
import { PlatformTransaction } from "../../models/platformTransaction.model.js";
import { formatDisplayDate, formatMoney } from "./admin.helpers.js";

function pctChange(current: number, previous: number) {
  if (previous === 0) return current > 0 ? 100 : 0;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

function metric(value: number, previous: number) {
  const change = pctChange(value, previous);
  return {
    value,
    change: `${change >= 0 ? "+" : ""}${change}%`,
    changePercent: change,
    trend: change >= 0 ? ("up" as const) : ("down" as const),
  };
}

export async function getDashboardMetrics() {
  const now = new Date();
  const startThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const endLastMonth = startThisMonth;

  const [
    totalUsers,
    usersThisMonth,
    usersLastMonth,
    totalChurches,
    churchesThisMonth,
    churchesLastMonth,
    prayerRequests,
    prayersThisMonth,
    prayersLastMonth,
    activeSubs,
    activeSubsThisMonth,
    activeSubsLastMonth,
  ] = await Promise.all([
    User.countDocuments({ role: { $ne: "admin" } }),
    User.countDocuments({
      role: { $ne: "admin" },
      createdAt: { $gte: startThisMonth },
    }),
    User.countDocuments({
      role: { $ne: "admin" },
      createdAt: { $gte: startLastMonth, $lt: endLastMonth },
    }),
    Church.countDocuments(),
    Church.countDocuments({ createdAt: { $gte: startThisMonth } }),
    Church.countDocuments({
      createdAt: { $gte: startLastMonth, $lt: endLastMonth },
    }),
    Post.countDocuments({ mode: "prayer" }),
    Post.countDocuments({
      mode: "prayer",
      createdAt: { $gte: startThisMonth },
    }),
    Post.countDocuments({
      mode: "prayer",
      createdAt: { $gte: startLastMonth, $lt: endLastMonth },
    }),
    UserSubscription.countDocuments({ status: "Active" }),
    UserSubscription.countDocuments({
      status: "Active",
      createdAt: { $gte: startThisMonth },
    }),
    UserSubscription.countDocuments({
      status: "Active",
      createdAt: { $gte: startLastMonth, $lt: endLastMonth },
    }),
  ]);

  return {
    totalUsers: metric(totalUsers, totalUsers - usersThisMonth + usersLastMonth),
    totalChurches: metric(
      totalChurches,
      totalChurches - churchesThisMonth + churchesLastMonth
    ),
    prayerRequests: metric(
      prayerRequests,
      prayerRequests - prayersThisMonth + prayersLastMonth
    ),
    activeSubscriptions: metric(
      activeSubs,
      activeSubs - activeSubsThisMonth + activeSubsLastMonth
    ),
  };
}

export async function getPrayerActivity(year?: number) {
  const y = year ?? new Date().getFullYear();
  const start = new Date(y, 0, 1);
  const end = new Date(y + 1, 0, 1);

  const rows = await Post.aggregate([
    { $match: { createdAt: { $gte: start, $lt: end } } },
    {
      $group: {
        _id: { month: { $month: "$createdAt" }, mode: "$mode" },
        count: { $sum: 1 },
      },
    },
  ]);

  const prayerRequests = Array(12).fill(0);
  const praises = Array(12).fill(0);
  for (const r of rows) {
    const idx = r._id.month - 1;
    if (r._id.mode === "praise") praises[idx] = r.count;
    else prayerRequests[idx] = r.count;
  }

  return {
    categories: [
      "Jan",
      "Feb",
      "Mar",
      "Apr",
      "May",
      "Jun",
      "Jul",
      "Aug",
      "Sep",
      "Oct",
      "Nov",
      "Dec",
    ],
    prayerRequests,
    praises,
  };
}

export async function getDemographics() {
  const rows = await User.aggregate([
    { $match: { role: { $ne: "admin" }, country: { $ne: "" } } },
    { $group: { _id: "$country", users: { $sum: 1 } } },
    { $sort: { users: -1 } },
    { $limit: 10 },
  ]);
  const total = rows.reduce((s, r) => s + r.users, 0) || 1;
  return {
    countries: rows.map((r) => ({
      country: r._id || "Unknown",
      users: r.users,
      percentage: Math.round((r.users / total) * 100),
    })),
  };
}

export async function getRevenueTarget() {
  const target = Number(process.env.ADMIN_MONTHLY_REVENUE_TARGET || 20000);
  const now = new Date();
  const startThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const [monthAgg, todayAgg] = await Promise.all([
    PlatformTransaction.aggregate([
      {
        $match: {
          status: "Completed",
          occurredAt: { $gte: startThisMonth },
        },
      },
      { $group: { _id: null, total: { $sum: "$amountCents" } } },
    ]),
    PlatformTransaction.aggregate([
      {
        $match: {
          status: "Completed",
          occurredAt: { $gte: startToday },
        },
      },
      { $group: { _id: null, total: { $sum: "$amountCents" } } },
    ]),
  ]);

  const revenueCents = monthAgg[0]?.total ?? 0;
  const todayCents = todayAgg[0]?.total ?? 0;
  const revenue = revenueCents / 100;
  const today = todayCents / 100;
  const progressPercent =
    target > 0 ? Math.min(100, Math.round((revenue / target) * 10000) / 100) : 0;

  return {
    progressPercent,
    change: "+0%",
    changePercent: 0,
    target: `$${(target / 1000).toFixed(target % 1000 === 0 ? 0 : 1)}K`,
    targetRaw: target,
    revenue: `$${(revenue / 1000).toFixed(1)}K`,
    revenueRaw: revenue,
    today: `$${today.toFixed(0)}`,
    todayRaw: today,
    message:
      revenue > 0
        ? "Revenue from completed subscriptions, donations, and transactions."
        : "Revenue tracking will populate once subscriptions/donations are recorded.",
  };
}

/** Statistics chart — new users + new posts per month (Sales / Revenue placeholders). */
export async function getStatistics(year?: number) {
  const y = year ?? new Date().getFullYear();
  const start = new Date(y, 0, 1);
  const end = new Date(y + 1, 0, 1);

  const [userRows, postRows] = await Promise.all([
    User.aggregate([
      {
        $match: {
          role: { $ne: "admin" },
          createdAt: { $gte: start, $lt: end },
        },
      },
      {
        $group: {
          _id: { month: { $month: "$createdAt" } },
          count: { $sum: 1 },
        },
      },
    ]),
    Post.aggregate([
      { $match: { createdAt: { $gte: start, $lt: end } } },
      {
        $group: {
          _id: { month: { $month: "$createdAt" } },
          count: { $sum: 1 },
        },
      },
    ]),
  ]);

  const users = Array(12).fill(0);
  const posts = Array(12).fill(0);
  for (const r of userRows) users[r._id.month - 1] = r.count;
  for (const r of postRows) posts[r._id.month - 1] = r.count;

  return {
    categories: [
      "Jan",
      "Feb",
      "Mar",
      "Apr",
      "May",
      "Jun",
      "Jul",
      "Aug",
      "Sep",
      "Oct",
      "Nov",
      "Dec",
    ],
    // UI chart labels: Sales / Revenue — mapped to users / posts until billing exists
    sales: users,
    revenue: posts,
    series: [
      { name: "Sales", data: users },
      { name: "Revenue", data: posts },
    ],
  };
}

export async function getRecentSubscriptions(opts: {
  status?: string;
  plan?: string;
  limit?: number;
}) {
  const limit = Math.min(50, Math.max(1, opts.limit ?? 10));
  const filter: Record<string, unknown> = {};
  if (opts.status && opts.status !== "All") filter.status = opts.status;
  if (opts.plan && opts.plan !== "All") filter.planName = opts.plan;

  const [total, docs] = await Promise.all([
    UserSubscription.countDocuments(filter),
    UserSubscription.find(filter)
      .populate("user", "name email avatar")
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean(),
  ]);

  return {
    data: docs.map((s) => ({
      id: s._id.toString(),
      userName: (s.user as { name?: string })?.name ?? "",
      userEmail: (s.user as { email?: string })?.email ?? "",
      plan: (s.planName ?? "Monthly") as "Monthly" | "Yearly" | "Lifetime",
      amount: formatMoney(s.amountCents ?? 0),
      status: (s.status === "Active"
        ? "Active"
        : s.paymentStatus === "Failed"
          ? "Failed"
          : "Pending") as "Active" | "Pending" | "Failed",
      avatar: (s.user as { avatar?: string })?.avatar ?? "",
      purchasedAt: formatDisplayDate(s.createdAt),
    })),
    meta: { total, limit },
    message: total ? undefined : "No subscriptions yet.",
  };
}

/** Single payload for dashboard home page (all widgets). */
export async function getHomeDashboard(year?: number) {
  const [metrics, prayerActivity, revenueTarget, statistics, demographics, recentSubscriptions] =
    await Promise.all([
      getDashboardMetrics(),
      getPrayerActivity(year),
      getRevenueTarget(),
      getStatistics(year),
      getDemographics(),
      getRecentSubscriptions({ limit: 10 }),
    ]);

  return {
    metrics,
    prayerActivity,
    revenueTarget,
    statistics,
    demographics,
    recentSubscriptions,
  };
}

export async function getRecentActivity(limit = 10) {
  const [users, posts, reports, streams] = await Promise.all([
    User.find({ role: { $ne: "admin" } })
      .sort({ createdAt: -1 })
      .limit(limit)
      .select("name email avatar createdAt")
      .lean(),
    Post.find()
      .sort({ createdAt: -1 })
      .limit(limit)
      .populate("author", "name email avatar")
      .lean(),
    Report.find()
      .sort({ createdAt: -1 })
      .limit(limit)
      .populate("reporter", "name email")
      .lean(),
    LiveStreamSession.find()
      .sort({ createdAt: -1 })
      .limit(5)
      .populate("hostUserId", "name email avatar")
      .lean(),
  ]);

  return {
    recentUsers: users.map((u) => ({
      id: u._id.toString(),
      name: u.name,
      email: u.email,
      avatar: u.avatar ?? "",
      joinedAt: formatDisplayDate(u.createdAt),
    })),
    recentPosts: posts.map((p) => ({
      id: p._id.toString(),
      authorName: (p.author as { name?: string })?.name ?? "",
      authorEmail: (p.author as { email?: string })?.email ?? "",
      avatar: (p.author as { avatar?: string })?.avatar ?? "",
      type: p.mode === "praise" ? "Praise" : "Prayer Request",
      content: p.text?.slice(0, 120) ?? "",
      createdAt: formatDisplayDate(p.createdAt),
    })),
    recentReports: reports.map((r) => ({
      id: r._id.toString(),
      reportId: `RPT-${r._id.toString().slice(-4).toUpperCase()}`,
      type: r.targetType,
      reason: (r as { reasonKey?: string; reason?: string }).reasonKey ||
        (r as { reason?: string }).reason ||
        "",
      reportedBy: (r.reporter as { name?: string })?.name ?? "",
      status: r.status,
      createdAt: formatDisplayDate(r.createdAt),
    })),
    recentStreams: streams.map((s) => ({
      id: s._id.toString(),
      title: s.title,
      hostName: (s.hostUserId as { name?: string })?.name ?? "",
      status: s.status === "live" ? "Live" : "Ended",
      viewers: s.viewerCount ?? 0,
      scheduledAt: formatDisplayDate(s.startedAt),
    })),
  };
}

export async function getAnalyticsOverview(range: "week" | "month" = "month") {
  const now = new Date();
  const days = range === "week" ? 7 : 30;
  const start = new Date(now);
  start.setDate(start.getDate() - days);

  const [totalUsers, totalPrayerRequests, totalChurches, activeChurches, newUsers, donationAgg] =
    await Promise.all([
      User.countDocuments({ role: { $ne: "admin" } }),
      Post.countDocuments({ mode: "prayer" }),
      Church.countDocuments(),
      Church.countDocuments({ status: "Approved" }),
      User.countDocuments({
        role: { $ne: "admin" },
        createdAt: { $gte: start },
      }),
      Donation.aggregate([
        { $match: { status: "Completed", donatedAt: { $gte: start } } },
        { $group: { _id: null, total: { $sum: "$amountCents" } } },
      ]),
    ]);

  const totalDonationsCents = donationAgg[0]?.total ?? 0;

  const daily = await Post.aggregate([
    { $match: { createdAt: { $gte: start } } },
    {
      $group: {
        _id: {
          d: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
          mode: "$mode",
        },
        count: { $sum: 1 },
      },
    },
    { $sort: { "_id.d": 1 } },
  ]);

  const byDay = new Map<string, { prayers: number; praises: number }>();
  for (const row of daily) {
    const key = row._id.d as string;
    const cur = byDay.get(key) ?? { prayers: 0, praises: 0 };
    if (row._id.mode === "praise") cur.praises = row.count;
    else cur.prayers = row.count;
    byDay.set(key, cur);
  }

  const series = [...byDay.entries()].map(([date, v]) => ({
    name: date,
    prayers: v.prayers,
    praises: v.praises,
    users: 0,
    donations: 0,
  }));

  return {
    stats: {
      totalUsers,
      totalPrayerRequests,
      totalDonations: totalDonationsCents / 100,
      activeChurches,
      newUsersInRange: newUsers,
      totalChurches,
    },
    series,
  };
}
