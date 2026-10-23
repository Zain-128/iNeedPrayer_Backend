import { Router } from "express";
import { protectAdmin } from "../middleware/admin.middleware.js";
import * as admin from "../controllers/admin.controller.js";

const router = Router();

// Public admin auth
router.post("/auth/login", admin.login);
router.post("/auth/forgot-password", admin.forgotPassword);
router.post("/auth/reset-password", admin.resetPassword);
router.post("/auth/promote", admin.promote);

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

// Notifications
router.get("/notifications", admin.listNotifications);
router.post("/notifications", admin.broadcastNotification);
router.delete("/notifications/:id", admin.deleteNotification);

// Monetization stubs (dashboard pages exist; billing TBD)
router.get("/subscriptions", admin.monetizationStub);
router.get("/subscription-plans", admin.monetizationStub);
router.get("/donations", admin.monetizationStub);
router.get("/wallet/transactions", admin.monetizationStub);
router.get("/wallet/summary", admin.monetizationStub);
router.get("/withdrawals", admin.monetizationStub);
router.get("/transactions", admin.monetizationStub);

export default router;
