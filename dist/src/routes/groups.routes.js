import { Router } from "express";
import { protect } from "../middleware/auth.middleware.js";
import { optionalAuth } from "../middleware/optionalAuth.middleware.js";
import * as groupsController from "../controllers/groups.controller.js";
const router = Router();
// Discovery & Lists
router.get("/discover", optionalAuth, groupsController.discoverGroups);
router.get("/mine", protect, groupsController.listMyGroups);
router.get("/", optionalAuth, groupsController.listGroups);
router.post("/", protect, groupsController.createGroup);
// Detail & Settings
router.get("/:id", optionalAuth, groupsController.getGroup);
router.get("/:id/conversation", protect, groupsController.getGroupConversation);
router.patch("/:id", protect, groupsController.updateGroup);
router.delete("/:id", protect, groupsController.deleteGroup);
// Privacy & Membership
router.patch("/:id/privacy", protect, groupsController.updatePrivacy);
router.post("/:id/join", protect, groupsController.joinGroup);
router.post("/:id/leave", protect, groupsController.leaveGroup);
router.post("/:id/report", protect, groupsController.reportGroup);
router.post("/:id/mute", protect, groupsController.muteGroup);
router.post("/:id/unmute", protect, groupsController.unmuteGroup);
// Posts
router.get("/:id/posts", optionalAuth, groupsController.listGroupPosts);
// Join Requests
router.get("/:id/pending-join-requests", protect, groupsController.listPendingJoinRequests);
router.patch("/:id/join-requests/:userId", protect, groupsController.manageJoinRequest);
router.post("/:id/join-requests/:userId/approve", protect, groupsController.approveJoinRequest);
router.post("/:id/join-requests/:userId/reject", protect, groupsController.rejectJoinRequest);
// Invitations (Friends Only)
router.get("/:id/invite-candidates", protect, groupsController.listInviteCandidates);
router.post("/:id/invite", protect, groupsController.inviteGroup);
router.post("/:id/invites", protect, groupsController.inviteGroup);
router.get("/:id/invites", protect, groupsController.listInvites);
router.delete("/:id/invites/:userId", protect, groupsController.cancelInvite);
router.post("/:id/invites/:userId/resend", protect, groupsController.resendInvite);
router.post("/:id/invites/accept", protect, groupsController.acceptMyInvite);
router.post("/:id/invites/:userId/accept", protect, groupsController.acceptInvite);
router.post("/:id/invites/decline", protect, groupsController.declineInvite);
router.post("/:id/invites/:userId/reject", protect, groupsController.rejectInvite);
router.post("/:id/invites/:userId/decline", protect, groupsController.declineInvite);
// Roles & Members
router.get("/:id/members", protect, groupsController.listMembers);
router.post("/:id/members", protect, groupsController.addMember);
router.get("/:id/admins", protect, groupsController.listAdmins);
router.post("/:id/members/:userId/make-admin", protect, groupsController.makeAdmin);
router.post("/:id/members/:userId/remove-admin", protect, groupsController.removeAdmin);
router.post("/:id/members/:userId/assign-editor", protect, groupsController.assignEditor);
router.post("/:id/members/:userId/remove-editor", protect, groupsController.removeEditor);
router.delete("/:id/members/:userId", protect, groupsController.removeMember);
router.patch("/:id/members/:userId", protect, groupsController.updateMemberRole);
// Notification Settings & Preferences
router.get("/:id/notification-settings", protect, groupsController.getNotificationSettings);
router.get("/:id/notifications/settings", protect, groupsController.getNotificationSettings);
router.patch("/:id/notification-settings", protect, groupsController.updateNotificationSettings);
router.patch("/:id/notifications/settings", protect, groupsController.updateNotificationSettings);
router.get("/:id/notification-preferences", protect, groupsController.getNotificationPreferences);
router.get("/:id/notifications/preferences", protect, groupsController.getNotificationPreferences);
router.patch("/:id/notification-preferences", protect, groupsController.updateNotificationPreferences);
router.patch("/:id/notifications/preferences", protect, groupsController.updateNotificationPreferences);
// Analytics
router.get("/:id/analytics", protect, groupsController.getAnalytics);
// Subscription & Permissions
router.get("/:id/subscription", protect, groupsController.getSubscription);
router.get("/:id/permissions", protect, groupsController.getPermissionsAndLimits);
router.get("/:id/role-limits", protect, groupsController.getRoleLimits);
export default router;
