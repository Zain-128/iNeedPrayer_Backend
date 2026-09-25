import { Router } from "express";
import { protectAdmin } from "../middleware/admin.middleware.js";
import * as admin from "../controllers/admin.controller.js";

const router = Router();

// Public admin auth
router.post("/auth/login", admin.login);
router.post("/auth/forgot-password", admin.forgotPassword);
router.post("/auth/reset-password", admin.resetPassword);
router.post("/auth/promote", admin.promote);
router.post("/auth/create", admin.createAdmin);

// All routes below require admin
router.use(protectAdmin);

router.get("/auth/me", admin.me);
router.post("/auth/logout", admin.logout);

// Dashboard (Home page)
router.get("/dashboard/home", admin.home);
router.get("/dashboard/metrics", admin.metrics);
router.get("/dashboard/prayer-activity", admin.prayerActivity);
router.get("/dashboard/revenue-target", admin.revenueTarget);
router.get("/dashboard/statistics", admin.statistics);
router.get("/dashboard/demographics", admin.demographics);
router.get("/dashboard/recent-subscriptions", admin.recentSubscriptions);
router.get("/dashboard/recent-activity", admin.recentActivity);
router.get("/analytics/overview", admin.analytics);

// Users
router.get("/users/search", admin.searchUsers);
router.get("/users", admin.listUsers);
router.get("/users/:id", admin.getUser);
router.patch("/users/:id", admin.updateUser);
router.delete("/users/:id", admin.deleteUser);
router.post("/users/:id/block", admin.blockUser);
router.post("/users/:id/unblock", admin.unblockUser);
router.get("/blocked-users", admin.listBlockedUsers);

// Churches
router.get("/churches", admin.listChurches);
router.post("/churches", admin.createChurch);
router.get("/churches/:id", admin.getChurch);
router.patch("/churches/:id", admin.updateChurch);
router.delete("/churches/:id", admin.deleteChurch);
router.post("/churches/:id/approve", admin.approveChurch);
router.post("/churches/:id/suspend", admin.suspendChurch);
router.post("/churches/:id/unsuspend", admin.unsuspendChurch);

// Groups
router.get("/groups", admin.listGroups);
router.post("/groups", admin.createGroup);
router.get("/groups/:id", admin.getGroup);
router.patch("/groups/:id", admin.updateGroup);
router.delete("/groups/:id", admin.deleteGroup);
router.post("/groups/:id/suspend", admin.suspendGroup);
router.post("/groups/:id/unsuspend", admin.unsuspendGroup);

// Content
router.get("/content", admin.listContent);
router.get("/content/:id", admin.getContent);
router.patch("/content/:id", admin.updateContent);
router.delete("/content/:id", admin.deleteContent);
router.get("/prayer-requests", admin.listPrayerRequests);
router.get("/praises", admin.listPraises);
router.get("/live-streams", admin.listLiveStreams);
router.get("/live-streams/:id", admin.getLiveStream);
router.post("/live-streams/:id/end", admin.endLiveStream);

// Reports
router.get("/reports", admin.listReports);
router.get("/reports/:id", admin.getReport);
router.post("/reports/:id/resolve", admin.resolveReport);
router.post("/reports/:id/dismiss", admin.dismissReport);
router.post("/reports/:id/suspend-content", admin.suspendReportContent);

// Notifications (admin broadcasts only)
router.get("/notifications", admin.listNotifications);
router.post("/notifications", admin.broadcastNotification);
router.delete("/notifications/:id", admin.deleteNotification);

// Top-bar activity feed
router.get("/activity-notifications", admin.listActivityNotifications);
router.post(
  "/activity-notifications/read-all",
  admin.markAllActivitiesRead
);
router.post(
  "/activity-notifications/:id/read",
  admin.markActivityRead
);

// Monetization
router.get("/subscriptions", admin.listSubscriptions);
router.post("/subscriptions", admin.createSubscription);
router.get("/subscriptions/:id", admin.getSubscription);
router.patch("/subscriptions/:id", admin.updateSubscription);
router.delete("/subscriptions/:id", admin.deleteSubscription);

router.get("/subscription-plans", admin.listSubscriptionPlans);
router.post("/subscription-plans", admin.createSubscriptionPlan);
router.get("/subscription-plans/:id", admin.getSubscriptionPlan);
router.patch("/subscription-plans/:id", admin.updateSubscriptionPlan);
router.delete("/subscription-plans/:id", admin.deleteSubscriptionPlan);

router.get("/donations", admin.listDonations);
router.post("/donations", admin.createDonation);
router.get("/donations/:id", admin.getDonation);

router.get("/wallet/summary", admin.getWalletSummary);
router.get("/wallet/transactions", admin.listWalletTransactions);

router.get("/withdrawals", admin.listWithdrawals);
router.post("/withdrawals", admin.createWithdrawal);
router.get("/withdrawals/:id", admin.getWithdrawal);
router.post("/withdrawals/:id/approve", admin.approveWithdrawal);
router.post("/withdrawals/:id/reject", admin.rejectWithdrawal);

router.get("/transactions", admin.listTransactions);
router.get("/transactions/:id", admin.getTransaction);

// Email campaigns
router.get("/email-campaigns", admin.listEmailCampaigns);
router.post("/email-campaigns", admin.createEmailCampaign);
router.get("/email-campaigns/:id", admin.getEmailCampaign);
router.patch("/email-campaigns/:id", admin.updateEmailCampaign);
router.delete("/email-campaigns/:id", admin.deleteEmailCampaign);
router.post("/email-campaigns/:id/send", admin.sendEmailCampaign);

// Announcements
router.get("/announcements", admin.listAnnouncements);
router.post("/announcements", admin.createAnnouncement);
router.get("/announcements/:id", admin.getAnnouncement);
router.patch("/announcements/:id", admin.updateAnnouncement);
router.delete("/announcements/:id", admin.deleteAnnouncement);
router.post("/announcements/:id/publish", admin.publishAnnouncement);
router.post("/announcements/:id/archive", admin.archiveAnnouncement);

// Events
router.get("/events", admin.listEvents);
router.post("/events", admin.createEvent);
router.get("/events/:id", admin.getEvent);
router.patch("/events/:id", admin.updateEvent);
router.delete("/events/:id", admin.deleteEvent);
router.post("/events/:id/cancel", admin.cancelEvent);

// Push Notifications
router.get("/push-notifications", admin.listPushNotifications);
router.post("/push-notifications", admin.createPushNotification);
router.get("/push-notifications/:id", admin.getPushNotification);
router.patch("/push-notifications/:id", admin.updatePushNotification);
router.delete("/push-notifications/:id", admin.deletePushNotification);
router.post("/push-notifications/:id/send", admin.sendPushNotification);

// Settings
router.get("/settings", admin.getSettings);
router.patch("/settings", admin.updateSettings);
router.get("/settings/notifications", admin.getNotificationSettings);
router.patch("/settings/notifications", admin.updateNotificationSettings);

export default router;
