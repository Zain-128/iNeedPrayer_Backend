import { Response } from "express";
import { AuthRequest } from "../middleware/auth.middleware.js";
import * as adminAuth from "../services/admin/adminAuth.service.js";
import * as adminDashboard from "../services/admin/adminDashboard.service.js";
import * as adminUsers from "../services/admin/adminUsers.service.js";
import * as adminChurches from "../services/admin/adminChurches.service.js";
import * as adminGroups from "../services/admin/adminGroups.service.js";
import * as adminContent from "../services/admin/adminContent.service.js";
import * as adminReports from "../services/admin/adminReports.service.js";
import * as adminNotifications from "../services/admin/adminNotifications.service.js";
import * as adminMonetization from "../services/admin/adminMonetization.service.js";
import * as adminEmailCampaigns from "../services/admin/adminEmailCampaigns.service.js";
import * as adminAnnouncements from "../services/admin/adminAnnouncements.service.js";
import { paramStr } from "../utils/routeParams.js";

function handle(res: Response, err: unknown) {
  const e = err as Error & { statusCode?: number };
  return res.status(e.statusCode ?? 500).json({ message: e.message });
}

function q(req: AuthRequest) {
  return req.query as Record<string, unknown>;
}

// ── Auth ──────────────────────────────────────────────
export const login = async (req: AuthRequest, res: Response) => {
  try {
    const { email, password } = req.body ?? {};
    if (!email || !password) {
      return res.status(400).json({ message: "email and password required" });
    }
    const result = await adminAuth.adminLogin(String(email), String(password));
    return res.json(result);
  } catch (err) {
    return handle(res, err);
  }
};

export const me = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.userId) return res.status(401).json({ message: "Unauthorized" });
    const admin = await adminAuth.getAdminMe(req.userId);
    return res.json({ admin });
  } catch (err) {
    return handle(res, err);
  }
};

export const promote = async (req: AuthRequest, res: Response) => {
  try {
    const secret = process.env.ADMIN_PROMOTE_SECRET;
    if (!secret || req.headers["x-admin-secret"] !== secret) {
      return res.status(403).json({ message: "Forbidden" });
    }
    const { email } = req.body ?? {};
    if (!email) return res.status(400).json({ message: "email required" });
    const admin = await adminAuth.promoteToAdmin(String(email));
    return res.json({ admin });
  } catch (err) {
    return handle(res, err);
  }
};

export const createAdmin = async (req: AuthRequest, res: Response) => {
  try {
    const secret = process.env.ADMIN_PROMOTE_SECRET;
    if (!secret || req.headers["x-admin-secret"] !== secret) {
      return res.status(403).json({ message: "Forbidden" });
    }
    const { email, password, name, role } = req.body ?? {};
    if (!email || !password || !name || !role) {
      return res
        .status(400)
        .json({ message: "email, password, name, and role are required" });
    }
    const result = await adminAuth.createAdmin({
      email: String(email),
      password: String(password),
      name: String(name),
      role: String(role),
    });
    return res.status(result.created ? 201 : 200).json(result);
  } catch (err) {
    return handle(res, err);
  }
};

export const logout = async (_req: AuthRequest, res: Response) => {
  try {
    return res.json(await adminAuth.adminLogout());
  } catch (err) {
    return handle(res, err);
  }
};

export const forgotPassword = async (req: AuthRequest, res: Response) => {
  try {
    const { email } = req.body ?? {};
    if (!email || typeof email !== "string") {
      return res.status(400).json({ message: "email is required" });
    }
    return res.json(await adminAuth.adminForgotPassword(email));
  } catch (err) {
    return handle(res, err);
  }
};

export const resetPassword = async (req: AuthRequest, res: Response) => {
  try {
    const { email, code, password } = req.body ?? {};
    if (!email || code === undefined || code === null || !password) {
      return res
        .status(400)
        .json({ message: "email, code, and password are required" });
    }
    return res.json(
      await adminAuth.adminResetPassword(
        String(email),
        String(code),
        String(password)
      )
    );
  } catch (err) {
    return handle(res, err);
  }
};

// ── Dashboard ─────────────────────────────────────────
export const metrics = async (_req: AuthRequest, res: Response) => {
  try {
    return res.json(await adminDashboard.getDashboardMetrics());
  } catch (err) {
    return handle(res, err);
  }
};

export const prayerActivity = async (req: AuthRequest, res: Response) => {
  try {
    const year = req.query.year ? Number(req.query.year) : undefined;
    return res.json(await adminDashboard.getPrayerActivity(year));
  } catch (err) {
    return handle(res, err);
  }
};

export const demographics = async (_req: AuthRequest, res: Response) => {
  try {
    return res.json(await adminDashboard.getDemographics());
  } catch (err) {
    return handle(res, err);
  }
};

export const revenueTarget = async (_req: AuthRequest, res: Response) => {
  try {
    return res.json(await adminDashboard.getRevenueTarget());
  } catch (err) {
    return handle(res, err);
  }
};

export const statistics = async (req: AuthRequest, res: Response) => {
  try {
    const year = req.query.year ? Number(req.query.year) : undefined;
    return res.json(await adminDashboard.getStatistics(year));
  } catch (err) {
    return handle(res, err);
  }
};

export const recentSubscriptions = async (req: AuthRequest, res: Response) => {
  try {
    return res.json(
      await adminDashboard.getRecentSubscriptions({
        status: typeof req.query.status === "string" ? req.query.status : undefined,
        plan: typeof req.query.plan === "string" ? req.query.plan : undefined,
        limit: req.query.limit ? Number(req.query.limit) : undefined,
      })
    );
  } catch (err) {
    return handle(res, err);
  }
};

export const home = async (req: AuthRequest, res: Response) => {
  try {
    const year = req.query.year ? Number(req.query.year) : undefined;
    return res.json(await adminDashboard.getHomeDashboard(year));
  } catch (err) {
    return handle(res, err);
  }
};

export const recentActivity = async (req: AuthRequest, res: Response) => {
  try {
    const limit = req.query.limit ? Number(req.query.limit) : 10;
    return res.json(await adminDashboard.getRecentActivity(limit));
  } catch (err) {
    return handle(res, err);
  }
};

export const analytics = async (req: AuthRequest, res: Response) => {
  try {
    const range = req.query.range === "week" ? "week" : "month";
    return res.json(await adminDashboard.getAnalyticsOverview(range));
  } catch (err) {
    return handle(res, err);
  }
};

// ── Users ─────────────────────────────────────────────
export const listUsers = async (req: AuthRequest, res: Response) => {
  try {
    return res.json(await adminUsers.listUsers(q(req)));
  } catch (err) {
    return handle(res, err);
  }
};

export const searchUsers = async (req: AuthRequest, res: Response) => {
  try {
    const search = typeof req.query.q === "string" ? req.query.q : "";
    if (!search.trim()) return res.json({ users: [] });
    return res.json({ users: await adminUsers.searchUsers(search) });
  } catch (err) {
    return handle(res, err);
  }
};

export const getUser = async (req: AuthRequest, res: Response) => {
  try {
    return res.json({ user: await adminUsers.getUser(paramStr(req.params.id)) });
  } catch (err) {
    return handle(res, err);
  }
};

export const updateUser = async (req: AuthRequest, res: Response) => {
  try {
    const user = await adminUsers.updateUser(paramStr(req.params.id), req.body ?? {});
    return res.json({ user });
  } catch (err) {
    return handle(res, err);
  }
};

export const deleteUser = async (req: AuthRequest, res: Response) => {
  try {
    return res.json(await adminUsers.deleteUser(paramStr(req.params.id)));
  } catch (err) {
    return handle(res, err);
  }
};

export const blockUser = async (req: AuthRequest, res: Response) => {
  try {
    return res.json(
      await adminUsers.blockUser(paramStr(req.params.id), req.body?.reason)
    );
  } catch (err) {
    return handle(res, err);
  }
};

export const unblockUser = async (req: AuthRequest, res: Response) => {
  try {
    return res.json(await adminUsers.unblockUser(paramStr(req.params.id)));
  } catch (err) {
    return handle(res, err);
  }
};

export const listBlockedUsers = async (req: AuthRequest, res: Response) => {
  try {
    return res.json(await adminUsers.listBlockedUsers(q(req)));
  } catch (err) {
    return handle(res, err);
  }
};

// ── Churches ──────────────────────────────────────────
export const listChurches = async (req: AuthRequest, res: Response) => {
  try {
    return res.json(await adminChurches.listChurches(q(req)));
  } catch (err) {
    return handle(res, err);
  }
};

export const getChurch = async (req: AuthRequest, res: Response) => {
  try {
    return res.json({
      church: await adminChurches.getChurch(paramStr(req.params.id)),
    });
  } catch (err) {
    return handle(res, err);
  }
};

export const createChurch = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.userId) return res.status(401).json({ message: "Unauthorized" });
    const church = await adminChurches.createChurch(req.body ?? {}, req.userId);
    return res.status(201).json({ church });
  } catch (err) {
    return handle(res, err);
  }
};

export const updateChurch = async (req: AuthRequest, res: Response) => {
  try {
    const church = await adminChurches.updateChurch(
      paramStr(req.params.id),
      req.body ?? {}
    );
    return res.json({ church });
  } catch (err) {
    return handle(res, err);
  }
};

export const deleteChurch = async (req: AuthRequest, res: Response) => {
  try {
    return res.json(await adminChurches.deleteChurch(paramStr(req.params.id)));
  } catch (err) {
    return handle(res, err);
  }
};

export const approveChurch = async (req: AuthRequest, res: Response) => {
  try {
    return res.json(
      await adminChurches.setChurchStatus(paramStr(req.params.id), "Approved")
    );
  } catch (err) {
    return handle(res, err);
  }
};

export const suspendChurch = async (req: AuthRequest, res: Response) => {
  try {
    return res.json(
      await adminChurches.setChurchStatus(paramStr(req.params.id), "Suspended")
    );
  } catch (err) {
    return handle(res, err);
  }
};

export const unsuspendChurch = async (req: AuthRequest, res: Response) => {
  try {
    return res.json(
      await adminChurches.setChurchStatus(paramStr(req.params.id), "Approved")
    );
  } catch (err) {
    return handle(res, err);
  }
};

// ── Groups ────────────────────────────────────────────
export const listGroups = async (req: AuthRequest, res: Response) => {
  try {
    return res.json(await adminGroups.listGroups(q(req)));
  } catch (err) {
    return handle(res, err);
  }
};

export const getGroup = async (req: AuthRequest, res: Response) => {
  try {
    return res.json({ group: await adminGroups.getGroup(paramStr(req.params.id)) });
  } catch (err) {
    return handle(res, err);
  }
};

export const createGroup = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.userId) return res.status(401).json({ message: "Unauthorized" });
    const group = await adminGroups.createGroup(req.body ?? {}, req.userId);
    return res.status(201).json({ group });
  } catch (err) {
    return handle(res, err);
  }
};

export const updateGroup = async (req: AuthRequest, res: Response) => {
  try {
    const group = await adminGroups.updateGroup(
      paramStr(req.params.id),
      req.body ?? {}
    );
    return res.json({ group });
  } catch (err) {
    return handle(res, err);
  }
};

export const deleteGroup = async (req: AuthRequest, res: Response) => {
  try {
    return res.json(await adminGroups.deleteGroup(paramStr(req.params.id)));
  } catch (err) {
    return handle(res, err);
  }
};

export const suspendGroup = async (req: AuthRequest, res: Response) => {
  try {
    return res.json(
      await adminGroups.setGroupStatus(paramStr(req.params.id), "Suspended")
    );
  } catch (err) {
    return handle(res, err);
  }
};

export const unsuspendGroup = async (req: AuthRequest, res: Response) => {
  try {
    return res.json(
      await adminGroups.setGroupStatus(paramStr(req.params.id), "Active")
    );
  } catch (err) {
    return handle(res, err);
  }
};

// ── Content ───────────────────────────────────────────
export const listContent = async (req: AuthRequest, res: Response) => {
  try {
    return res.json(await adminContent.listContent(q(req)));
  } catch (err) {
    return handle(res, err);
  }
};

export const getContent = async (req: AuthRequest, res: Response) => {
  try {
    return res.json({
      content: await adminContent.getContent(paramStr(req.params.id)),
    });
  } catch (err) {
    return handle(res, err);
  }
};

export const updateContent = async (req: AuthRequest, res: Response) => {
  try {
    const status = req.body?.status;
    if (status !== "Published" && status !== "Reported" && status !== "Hidden") {
      return res.status(400).json({ message: "Invalid status" });
    }
    return res.json(
      await adminContent.updateContentStatus(paramStr(req.params.id), status)
    );
  } catch (err) {
    return handle(res, err);
  }
};

export const deleteContent = async (req: AuthRequest, res: Response) => {
  try {
    return res.json(await adminContent.deleteContent(paramStr(req.params.id)));
  } catch (err) {
    return handle(res, err);
  }
};

export const listPrayerRequests = async (req: AuthRequest, res: Response) => {
  try {
    return res.json(await adminContent.listPrayerRequests(q(req)));
  } catch (err) {
    return handle(res, err);
  }
};

export const listPraises = async (req: AuthRequest, res: Response) => {
  try {
    return res.json(await adminContent.listPraises(q(req)));
  } catch (err) {
    return handle(res, err);
  }
};

export const listLiveStreams = async (req: AuthRequest, res: Response) => {
  try {
    return res.json(await adminContent.listLiveStreams(q(req)));
  } catch (err) {
    return handle(res, err);
  }
};

export const getLiveStream = async (req: AuthRequest, res: Response) => {
  try {
    return res.json({
      stream: await adminContent.getLiveStream(paramStr(req.params.id)),
    });
  } catch (err) {
    return handle(res, err);
  }
};

export const endLiveStream = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.userId) return res.status(401).json({ message: "Unauthorized" });
    return res.json(
      await adminContent.endLiveStream(paramStr(req.params.id), req.userId)
    );
  } catch (err) {
    return handle(res, err);
  }
};

// ── Reports ───────────────────────────────────────────
export const listReports = async (req: AuthRequest, res: Response) => {
  try {
    return res.json(await adminReports.listReports(q(req)));
  } catch (err) {
    return handle(res, err);
  }
};

export const getReport = async (req: AuthRequest, res: Response) => {
  try {
    return res.json({
      report: await adminReports.getReport(paramStr(req.params.id)),
    });
  } catch (err) {
    return handle(res, err);
  }
};

export const resolveReport = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.userId) return res.status(401).json({ message: "Unauthorized" });
    return res.json({
      report: await adminReports.resolveReport(
        paramStr(req.params.id),
        req.userId,
        req.body?.note
      ),
    });
  } catch (err) {
    return handle(res, err);
  }
};

export const dismissReport = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.userId) return res.status(401).json({ message: "Unauthorized" });
    return res.json({
      report: await adminReports.dismissReport(
        paramStr(req.params.id),
        req.userId,
        req.body?.note
      ),
    });
  } catch (err) {
    return handle(res, err);
  }
};

export const suspendReportContent = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.userId) return res.status(401).json({ message: "Unauthorized" });
    return res.json({
      report: await adminReports.suspendReportedContent(
        paramStr(req.params.id),
        req.userId,
        req.body?.note
      ),
    });
  } catch (err) {
    return handle(res, err);
  }
};

// ── Notifications ─────────────────────────────────────
export const listNotifications = async (req: AuthRequest, res: Response) => {
  try {
    return res.json(await adminNotifications.listAdminNotifications(q(req)));
  } catch (err) {
    return handle(res, err);
  }
};

export const broadcastNotification = async (req: AuthRequest, res: Response) => {
  try {
    return res.status(201).json(
      await adminNotifications.broadcastNotification(
        req.body ?? {},
        req.userId
      )
    );
  } catch (err) {
    return handle(res, err);
  }
};

export const deleteNotification = async (req: AuthRequest, res: Response) => {
  try {
    return res.json(
      await adminNotifications.deleteAdminNotification(paramStr(req.params.id))
    );
  } catch (err) {
    return handle(res, err);
  }
};

export const listActivityNotifications = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    if (!req.userId) return res.status(401).json({ message: "Unauthorized" });
    return res.json(
      await adminNotifications.listActivityNotifications(q(req), req.userId)
    );
  } catch (err) {
    return handle(res, err);
  }
};

export const markActivityRead = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.userId) return res.status(401).json({ message: "Unauthorized" });
    return res.json(
      await adminNotifications.markActivityRead(
        paramStr(req.params.id),
        req.userId
      )
    );
  } catch (err) {
    return handle(res, err);
  }
};

export const markAllActivitiesRead = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    if (!req.userId) return res.status(401).json({ message: "Unauthorized" });
    return res.json(
      await adminNotifications.markAllActivitiesRead(req.userId)
    );
  } catch (err) {
    return handle(res, err);
  }
};

// ── Monetization ──────────────────────────────────────
export const listSubscriptions = async (req: AuthRequest, res: Response) => {
  try {
    return res.json(await adminMonetization.listSubscriptions(q(req)));
  } catch (err) {
    return handle(res, err);
  }
};

export const getSubscription = async (req: AuthRequest, res: Response) => {
  try {
    return res.json(await adminMonetization.getSubscription(paramStr(req.params.id)));
  } catch (err) {
    return handle(res, err);
  }
};

export const createSubscription = async (req: AuthRequest, res: Response) => {
  try {
    const sub = await adminMonetization.createSubscription(req.body ?? {});
    return res.status(201).json(sub);
  } catch (err) {
    return handle(res, err);
  }
};

export const updateSubscription = async (req: AuthRequest, res: Response) => {
  try {
    return res.json(
      await adminMonetization.updateSubscription(
        paramStr(req.params.id),
        req.body ?? {}
      )
    );
  } catch (err) {
    return handle(res, err);
  }
};

export const deleteSubscription = async (req: AuthRequest, res: Response) => {
  try {
    return res.json(
      await adminMonetization.deleteSubscription(paramStr(req.params.id))
    );
  } catch (err) {
    return handle(res, err);
  }
};

export const listSubscriptionPlans = async (req: AuthRequest, res: Response) => {
  try {
    return res.json(await adminMonetization.listSubscriptionPlans(q(req)));
  } catch (err) {
    return handle(res, err);
  }
};

export const createSubscriptionPlan = async (req: AuthRequest, res: Response) => {
  try {
    const plan = await adminMonetization.createSubscriptionPlan(req.body ?? {});
    return res.status(201).json(plan);
  } catch (err) {
    return handle(res, err);
  }
};

export const updateSubscriptionPlan = async (req: AuthRequest, res: Response) => {
  try {
    return res.json(
      await adminMonetization.updateSubscriptionPlan(
        paramStr(req.params.id),
        req.body ?? {}
      )
    );
  } catch (err) {
    return handle(res, err);
  }
};

export const deleteSubscriptionPlan = async (req: AuthRequest, res: Response) => {
  try {
    return res.json(
      await adminMonetization.deleteSubscriptionPlan(paramStr(req.params.id))
    );
  } catch (err) {
    return handle(res, err);
  }
};

export const listDonations = async (req: AuthRequest, res: Response) => {
  try {
    return res.json(await adminMonetization.listDonations(q(req)));
  } catch (err) {
    return handle(res, err);
  }
};

export const getDonation = async (req: AuthRequest, res: Response) => {
  try {
    return res.json(await adminMonetization.getDonation(paramStr(req.params.id)));
  } catch (err) {
    return handle(res, err);
  }
};

export const createDonation = async (req: AuthRequest, res: Response) => {
  try {
    const donation = await adminMonetization.createDonation(req.body ?? {});
    return res.status(201).json(donation);
  } catch (err) {
    return handle(res, err);
  }
};

export const getWalletSummary = async (_req: AuthRequest, res: Response) => {
  try {
    return res.json(await adminMonetization.getWalletSummary());
  } catch (err) {
    return handle(res, err);
  }
};

export const listWalletTransactions = async (req: AuthRequest, res: Response) => {
  try {
    return res.json(await adminMonetization.listWalletTransactions(q(req)));
  } catch (err) {
    return handle(res, err);
  }
};

export const listWithdrawals = async (req: AuthRequest, res: Response) => {
  try {
    return res.json(await adminMonetization.listWithdrawals(q(req)));
  } catch (err) {
    return handle(res, err);
  }
};

export const getWithdrawal = async (req: AuthRequest, res: Response) => {
  try {
    return res.json(await adminMonetization.getWithdrawal(paramStr(req.params.id)));
  } catch (err) {
    return handle(res, err);
  }
};

export const createWithdrawal = async (req: AuthRequest, res: Response) => {
  try {
    const withdrawal = await adminMonetization.createWithdrawal(req.body ?? {});
    return res.status(201).json(withdrawal);
  } catch (err) {
    return handle(res, err);
  }
};

export const approveWithdrawal = async (req: AuthRequest, res: Response) => {
  try {
    return res.json(
      await adminMonetization.approveWithdrawal(
        paramStr(req.params.id),
        req.userId
      )
    );
  } catch (err) {
    return handle(res, err);
  }
};

export const rejectWithdrawal = async (req: AuthRequest, res: Response) => {
  try {
    return res.json(
      await adminMonetization.rejectWithdrawal(
        paramStr(req.params.id),
        req.body ?? {},
        req.userId
      )
    );
  } catch (err) {
    return handle(res, err);
  }
};

export const listTransactions = async (req: AuthRequest, res: Response) => {
  try {
    return res.json(await adminMonetization.listTransactions(q(req)));
  } catch (err) {
    return handle(res, err);
  }
};

export const getTransaction = async (req: AuthRequest, res: Response) => {
  try {
    return res.json(await adminMonetization.getTransaction(paramStr(req.params.id)));
  } catch (err) {
    return handle(res, err);
  }
};

// ── Email campaigns ───────────────────────────────────
export const listEmailCampaigns = async (req: AuthRequest, res: Response) => {
  try {
    return res.json(await adminEmailCampaigns.listEmailCampaigns(q(req)));
  } catch (err) {
    return handle(res, err);
  }
};

export const getEmailCampaign = async (req: AuthRequest, res: Response) => {
  try {
    return res.json(
      await adminEmailCampaigns.getEmailCampaign(paramStr(req.params.id))
    );
  } catch (err) {
    return handle(res, err);
  }
};

export const createEmailCampaign = async (req: AuthRequest, res: Response) => {
  try {
    const campaign = await adminEmailCampaigns.createEmailCampaign(
      req.body ?? {},
      req.userId
    );
    return res.status(201).json(campaign);
  } catch (err) {
    return handle(res, err);
  }
};

export const updateEmailCampaign = async (req: AuthRequest, res: Response) => {
  try {
    return res.json(
      await adminEmailCampaigns.updateEmailCampaign(
        paramStr(req.params.id),
        req.body ?? {}
      )
    );
  } catch (err) {
    return handle(res, err);
  }
};

export const deleteEmailCampaign = async (req: AuthRequest, res: Response) => {
  try {
    return res.json(
      await adminEmailCampaigns.deleteEmailCampaign(paramStr(req.params.id))
    );
  } catch (err) {
    return handle(res, err);
  }
};

export const sendEmailCampaign = async (req: AuthRequest, res: Response) => {
  try {
    return res.json(
      await adminEmailCampaigns.sendEmailCampaign(paramStr(req.params.id))
    );
  } catch (err) {
    return handle(res, err);
  }
};

// ── Announcements ─────────────────────────────────────
export const listAnnouncements = async (req: AuthRequest, res: Response) => {
  try {
    return res.json(await adminAnnouncements.listAnnouncements(q(req)));
  } catch (err) {
    return handle(res, err);
  }
};

export const getAnnouncement = async (req: AuthRequest, res: Response) => {
  try {
    return res.json(
      await adminAnnouncements.getAnnouncement(paramStr(req.params.id))
    );
  } catch (err) {
    return handle(res, err);
  }
};

export const createAnnouncement = async (req: AuthRequest, res: Response) => {
  try {
    const announcement = await adminAnnouncements.createAnnouncement(
      req.body ?? {},
      req.userId
    );
    return res.status(201).json(announcement);
  } catch (err) {
    return handle(res, err);
  }
};

export const updateAnnouncement = async (req: AuthRequest, res: Response) => {
  try {
    return res.json(
      await adminAnnouncements.updateAnnouncement(
        paramStr(req.params.id),
        req.body ?? {}
      )
    );
  } catch (err) {
    return handle(res, err);
  }
};

export const deleteAnnouncement = async (req: AuthRequest, res: Response) => {
  try {
    return res.json(
      await adminAnnouncements.deleteAnnouncement(paramStr(req.params.id))
    );
  } catch (err) {
    return handle(res, err);
  }
};

export const publishAnnouncement = async (req: AuthRequest, res: Response) => {
  try {
    return res.json(
      await adminAnnouncements.publishAnnouncement(paramStr(req.params.id))
    );
  } catch (err) {
    return handle(res, err);
  }
};

export const archiveAnnouncement = async (req: AuthRequest, res: Response) => {
  try {
    return res.json(
      await adminAnnouncements.archiveAnnouncement(paramStr(req.params.id))
    );
  } catch (err) {
    return handle(res, err);
  }
};
