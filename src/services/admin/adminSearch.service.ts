import mongoose from "mongoose";
import { User } from "../../models/user.model.js";
import { Church } from "../../models/church.model.js";
import { Group } from "../../models/group.model.js";
import { Post } from "../../models/post.model.js";
import { LiveStreamSession } from "../../models/liveStreamSession.model.js";
import { Donation } from "../../models/donation.model.js";
import { Withdrawal } from "../../models/withdrawal.model.js";
import { PlatformTransaction } from "../../models/platformTransaction.model.js";
import { Report } from "../../models/report.model.js";
import { UserSubscription } from "../../models/userSubscription.model.js";
import { escapeRegex, formatDisplayDate, formatMoney } from "./admin.helpers.js";

export type GlobalSearchResultItem = {
  id: string;
  module:
    | "users"
    | "churches"
    | "groups"
    | "content"
    | "liveStreams"
    | "donations"
    | "withdrawals"
    | "transactions"
    | "reports"
    | "subscriptions";
  title: string;
  subtitle: string;
  avatar?: string;
  image?: string;
  status?: string;
  date?: string;
  meta?: Record<string, unknown>;
};

export async function globalSearch(
  query: string,
  limitPerCategory = 5
) {
  const q = (query || "").trim();
  if (!q) {
    return {
      query: "",
      counts: {
        users: 0,
        churches: 0,
        groups: 0,
        content: 0,
        liveStreams: 0,
        donations: 0,
        withdrawals: 0,
        transactions: 0,
        reports: 0,
        subscriptions: 0,
        total: 0,
      },
      results: {
        users: [],
        churches: [],
        groups: [],
        content: [],
        liveStreams: [],
        donations: [],
        withdrawals: [],
        transactions: [],
        reports: [],
        subscriptions: [],
      },
      allItems: [],
    };
  }

  const limit = Math.min(20, Math.max(1, limitPerCategory));
  const rx = new RegExp(escapeRegex(q), "i");
  const isValidId = mongoose.isValidObjectId(q);
  const idFilter = isValidId ? { _id: new mongoose.Types.ObjectId(q) } : null;

  // 1. Users condition
  const userCond: Record<string, unknown>[] = [
    { name: rx },
    { email: rx },
    { city: rx },
    { state: rx },
    { country: rx },
    { phone: rx },
  ];
  if (idFilter) userCond.push(idFilter);

  // 2. Churches condition
  const churchCond: Record<string, unknown>[] = [
    { name: rx },
    { city: rx },
    { state: rx },
    { country: rx },
    { email: rx },
    { denomination: rx },
  ];
  if (idFilter) churchCond.push(idFilter);

  // 3. Groups condition
  const groupCond: Record<string, unknown>[] = [
    { name: rx },
    { description: rx },
  ];
  if (idFilter) groupCond.push(idFilter);

  // Match users to find related author/host/reporter references
  const matchedUsers = await User.find({
    $or: userCond,
  })
    .select("_id name email avatar")
    .limit(limit * 3)
    .lean();

  const matchedUserIds = matchedUsers.map((u) => u._id);

  // 4. Posts / Content
  const postCond: Record<string, unknown>[] = [{ text: rx }];
  if (matchedUserIds.length) postCond.push({ author: { $in: matchedUserIds } });
  if (idFilter) postCond.push(idFilter);

  // 5. Live Streams
  const streamCond: Record<string, unknown>[] = [
    { title: rx },
    { agoraChannelName: rx },
  ];
  if (matchedUserIds.length) streamCond.push({ hostUserId: { $in: matchedUserIds } });
  if (idFilter) streamCond.push(idFilter);

  // 6. Donations
  const donationCond: Record<string, unknown>[] = [
    { donorName: rx },
    { donorEmail: rx },
    { recipientName: rx },
    { transactionId: rx },
    { description: rx },
  ];
  if (matchedUserIds.length) donationCond.push({ user: { $in: matchedUserIds } });
  if (idFilter) donationCond.push(idFilter);

  // 7. Withdrawals
  const withdrawalCond: Record<string, unknown>[] = [
    { name: rx },
    { email: rx },
    { account: rx },
    { transactionId: rx },
  ];
  if (matchedUserIds.length) withdrawalCond.push({ user: { $in: matchedUserIds } });
  if (idFilter) withdrawalCond.push(idFilter);

  // 8. Transactions
  const txnCond: Record<string, unknown>[] = [
    { userName: rx },
    { email: rx },
    { transactionId: rx },
    { description: rx },
    { type: rx },
  ];
  if (matchedUserIds.length) txnCond.push({ user: { $in: matchedUserIds } });
  if (idFilter) txnCond.push(idFilter);

  // 9. Reports
  const reportCond: Record<string, unknown>[] = [
    { reasonKey: rx },
    { reason: rx },
    { otherText: rx },
    { targetType: rx },
    { status: rx },
  ];
  if (matchedUserIds.length) {
    reportCond.push({ reporter: { $in: matchedUserIds } });
    reportCond.push({ reportedUser: { $in: matchedUserIds } });
  }
  if (idFilter) reportCond.push(idFilter);

  // 10. Subscriptions
  const subCond: Record<string, unknown>[] = [
    { planName: rx },
    { transactionId: rx },
    { status: rx },
    { paymentStatus: rx },
  ];
  if (matchedUserIds.length) subCond.push({ user: { $in: matchedUserIds } });
  if (idFilter) subCond.push(idFilter);

  // Run searches concurrently across all 10 modules
  const [
    [usersCount, userDocs],
    [churchesCount, churchDocs],
    [groupsCount, groupDocs],
    [postsCount, postDocs],
    [streamsCount, streamDocs],
    [donationsCount, donationDocs],
    [withdrawalsCount, withdrawalDocs],
    [txnsCount, txnDocs],
    [reportsCount, reportDocs],
    [subsCount, subDocs],
  ] = await Promise.all([
    Promise.all([
      User.countDocuments({ $or: userCond }),
      User.find({ $or: userCond }).sort({ createdAt: -1 }).limit(limit).lean(),
    ]),
    Promise.all([
      Church.countDocuments({ $or: churchCond }),
      Church.find({ $or: churchCond }).sort({ createdAt: -1 }).limit(limit).lean(),
    ]),
    Promise.all([
      Group.countDocuments({ $or: groupCond }),
      Group.find({ $or: groupCond }).sort({ createdAt: -1 }).limit(limit).lean(),
    ]),
    Promise.all([
      Post.countDocuments({ $or: postCond }),
      Post.find({ $or: postCond })
        .populate("author", "name email avatar")
        .sort({ createdAt: -1 })
        .limit(limit)
        .lean(),
    ]),
    Promise.all([
      LiveStreamSession.countDocuments({ $or: streamCond }),
      LiveStreamSession.find({ $or: streamCond })
        .populate("hostUserId", "name email avatar")
        .sort({ createdAt: -1 })
        .limit(limit)
        .lean(),
    ]),
    Promise.all([
      Donation.countDocuments({ $or: donationCond }),
      Donation.find({ $or: donationCond })
        .populate("user", "name email avatar")
        .sort({ donatedAt: -1 })
        .limit(limit)
        .lean(),
    ]),
    Promise.all([
      Withdrawal.countDocuments({ $or: withdrawalCond }),
      Withdrawal.find({ $or: withdrawalCond })
        .sort({ requestedAt: -1 })
        .limit(limit)
        .lean(),
    ]),
    Promise.all([
      PlatformTransaction.countDocuments({ $or: txnCond }),
      PlatformTransaction.find({ $or: txnCond })
        .sort({ occurredAt: -1 })
        .limit(limit)
        .lean(),
    ]),
    Promise.all([
      Report.countDocuments({ $or: reportCond }),
      Report.find({ $or: reportCond })
        .populate("reporter", "name email avatar")
        .sort({ createdAt: -1 })
        .limit(limit)
        .lean(),
    ]),
    Promise.all([
      UserSubscription.countDocuments({ $or: subCond }),
      UserSubscription.find({ $or: subCond })
        .populate("user", "name email avatar")
        .sort({ createdAt: -1 })
        .limit(limit)
        .lean(),
    ]),
  ]);

  // Format responses for each module
  const users = userDocs.map((u) => ({
    id: u._id.toString(),
    name: u.name,
    email: u.email,
    avatar: u.avatar || "",
    role: u.role || "user",
    status: u.status || "active",
    joinedAt: formatDisplayDate(u.createdAt),
  }));

  const churches = churchDocs.map((c) => ({
    id: c._id.toString(),
    name: c.name,
    image: c.image || "",
    city: c.city || "",
    state: c.state || "",
    country: c.country || "",
    location: [c.city, c.state, c.country].filter(Boolean).join(", "),
    status: c.status || "Approved",
    createdAt: formatDisplayDate(c.createdAt),
  }));

  const groups = groupDocs.map((g) => ({
    id: g._id.toString(),
    name: g.name,
    description: g.description || "",
    image: g.image || "",
    privacy: g.privacy || "public",
    status: g.status || "Active",
    createdAt: formatDisplayDate(g.createdAt),
  }));

  const content = postDocs.map((p) => {
    const author = p.author as { name?: string; email?: string; avatar?: string } | null;
    return {
      id: p._id.toString(),
      authorName: author?.name || "",
      authorEmail: author?.email || "",
      avatar: author?.avatar || "",
      mode: p.mode || "prayer",
      type: p.mode === "praise" ? "Praise" : "Prayer Request",
      text: p.text || "",
      moderationStatus: p.moderationStatus || "Published",
      createdAt: formatDisplayDate(p.createdAt),
    };
  });

  const liveStreams = streamDocs.map((s) => {
    const host = s.hostUserId as { name?: string; email?: string; avatar?: string } | null;
    return {
      id: s._id.toString(),
      title: s.title,
      hostName: host?.name || "",
      hostEmail: host?.email || "",
      avatar: host?.avatar || "",
      status: s.status === "live" ? "Live" : "Ended",
      viewers: s.viewerCount || 0,
      startedAt: formatDisplayDate(s.startedAt),
    };
  });

  const donations = donationDocs.map((d) => ({
    id: d._id.toString(),
    donorName: d.donorName,
    donorEmail: d.donorEmail || "",
    amount: formatMoney(d.amountCents),
    amountCents: d.amountCents,
    type: d.type || "One-Time",
    donatedTo: d.donatedTo || "App",
    recipientName: d.recipientName || "",
    paymentMethod: d.paymentMethod || "Card",
    transactionId: d.transactionId || "",
    status: d.status || "Completed",
    donatedAt: formatDisplayDate(d.donatedAt),
  }));

  const withdrawals = withdrawalDocs.map((w) => ({
    id: w._id.toString(),
    name: w.name,
    email: w.email || "",
    avatar: w.avatar || "",
    role: w.role || "User",
    amount: formatMoney(w.amountCents),
    amountCents: w.amountCents,
    method: w.method || "Bank",
    account: w.account || "",
    status: w.status || "Pending",
    transactionId: w.transactionId || "",
    requestedAt: formatDisplayDate(w.requestedAt),
  }));

  const transactions = txnDocs.map((t) => ({
    id: t._id.toString(),
    userName: t.userName || "",
    email: t.email || "",
    avatar: t.avatar || "",
    type: t.type,
    amount: formatMoney(t.amountCents),
    amountCents: t.amountCents,
    paymentMethod: t.method || "Card",
    status: t.status || "Completed",
    description: t.description || "",
    transactionId: t.transactionId || "",
    occurredAt: formatDisplayDate(t.occurredAt),
  }));

  const reports = reportDocs.map((r) => {
    const reporter = r.reporter as { name?: string; email?: string } | null;
    return {
      id: r._id.toString(),
      reportId: `RPT-${r._id.toString().slice(-4).toUpperCase()}`,
      targetType: r.targetType,
      reason: r.reasonKey || r.reason || "",
      otherText: r.otherText || "",
      reportedBy: reporter?.name || "",
      reporterEmail: reporter?.email || "",
      status: r.status || "Pending",
      createdAt: formatDisplayDate(r.createdAt),
    };
  });

  const subscriptions = subDocs.map((s) => {
    const user = s.user as { name?: string; email?: string; avatar?: string } | null;
    return {
      id: s._id.toString(),
      userName: user?.name || "",
      userEmail: user?.email || "",
      avatar: user?.avatar || "",
      plan: s.planName || "Monthly",
      amount: formatMoney(s.amountCents ?? 0),
      amountCents: s.amountCents ?? 0,
      paymentStatus: s.paymentStatus || "Paid",
      status: s.status || "Active",
      transactionId: s.transactionId || "",
      purchasedAt: formatDisplayDate(s.createdAt),
    };
  });

  // Flat aggregated search result items array
  const allItems: GlobalSearchResultItem[] = [
    ...users.map((u) => ({
      id: u.id,
      module: "users" as const,
      title: u.name,
      subtitle: u.email,
      avatar: u.avatar,
      status: u.status,
      date: u.joinedAt,
      meta: { role: u.role },
    })),
    ...churches.map((c) => ({
      id: c.id,
      module: "churches" as const,
      title: c.name,
      subtitle: c.location || "Church",
      image: c.image,
      status: c.status,
      date: c.createdAt,
    })),
    ...groups.map((g) => ({
      id: g.id,
      module: "groups" as const,
      title: g.name,
      subtitle: `${g.privacy} group`,
      image: g.image,
      status: g.status,
      date: g.createdAt,
    })),
    ...content.map((c) => ({
      id: c.id,
      module: "content" as const,
      title: `${c.type}: ${c.text.slice(0, 50)}${c.text.length > 50 ? "..." : ""}`,
      subtitle: `By ${c.authorName || c.authorEmail}`,
      avatar: c.avatar,
      status: c.moderationStatus,
      date: c.createdAt,
    })),
    ...liveStreams.map((s) => ({
      id: s.id,
      module: "liveStreams" as const,
      title: s.title,
      subtitle: `Host: ${s.hostName}`,
      avatar: s.avatar,
      status: s.status,
      date: s.startedAt,
    })),
    ...donations.map((d) => ({
      id: d.id,
      module: "donations" as const,
      title: `${d.amount} donation by ${d.donorName}`,
      subtitle: `To: ${d.recipientName || d.donatedTo} | Txn: ${d.transactionId}`,
      status: d.status,
      date: d.donatedAt,
    })),
    ...withdrawals.map((w) => ({
      id: w.id,
      module: "withdrawals" as const,
      title: `${w.amount} withdrawal request by ${w.name}`,
      subtitle: `${w.method} account: ${w.account} | Txn: ${w.transactionId}`,
      avatar: w.avatar,
      status: w.status,
      date: w.requestedAt,
    })),
    ...transactions.map((t) => ({
      id: t.id,
      module: "transactions" as const,
      title: `${t.type}: ${t.amount} (${t.userName || t.email})`,
      subtitle: t.description || `Txn ID: ${t.transactionId}`,
      avatar: t.avatar,
      status: t.status,
      date: t.occurredAt,
    })),
    ...reports.map((r) => ({
      id: r.id,
      module: "reports" as const,
      title: `${r.reportId}: Reported ${r.targetType} (${r.reason})`,
      subtitle: `Reported by ${r.reportedBy}`,
      status: r.status,
      date: r.createdAt,
    })),
    ...subscriptions.map((s) => ({
      id: s.id,
      module: "subscriptions" as const,
      title: `${s.plan} Subscription (${s.amount})`,
      subtitle: `User: ${s.userName || s.userEmail} | Txn: ${s.transactionId}`,
      avatar: s.avatar,
      status: s.status,
      date: s.purchasedAt,
    })),
  ];

  const total =
    usersCount +
    churchesCount +
    groupsCount +
    postsCount +
    streamsCount +
    donationsCount +
    withdrawalsCount +
    txnsCount +
    reportsCount +
    subsCount;

  return {
    query: q,
    counts: {
      users: usersCount,
      churches: churchesCount,
      groups: groupsCount,
      content: postsCount,
      liveStreams: streamsCount,
      donations: donationsCount,
      withdrawals: withdrawalsCount,
      transactions: txnsCount,
      reports: reportsCount,
      subscriptions: subsCount,
      total,
    },
    results: {
      users,
      churches,
      groups,
      content,
      liveStreams,
      donations,
      withdrawals,
      transactions,
      reports,
      subscriptions,
    },
    allItems,
  };
}
