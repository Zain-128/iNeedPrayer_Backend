import { Router } from "express";
import { protect } from "../middleware/auth.middleware.js";
import { optionalAuth } from "../middleware/optionalAuth.middleware.js";
import { placesRateLimiter } from "../middleware/placesRateLimit.middleware.js";
import { churchVerificationRateLimiter } from "../middleware/emailRateLimit.middleware.js";
import * as churchesController from "../controllers/churches.controller.js";
const router = Router();
// --- Google Places API (New) Church Finder Routes ---
// Supports both GET and POST with rate limiting & caching
router.get("/nearby", placesRateLimiter, optionalAuth, churchesController.getNearbyChurchesFromGoogle);
router.post("/nearby", placesRateLimiter, optionalAuth, churchesController.getNearbyChurchesFromGoogle);
router.get("/places/nearby", placesRateLimiter, optionalAuth, churchesController.getNearbyChurchesFromGoogle);
router.post("/places/nearby", placesRateLimiter, optionalAuth, churchesController.getNearbyChurchesFromGoogle);
// Google Places Photo Proxy (Keeps API key secure on backend)
router.get("/places/photo", optionalAuth, churchesController.getGooglePlacePhoto);
// Google Places Single Place Details
router.get("/places/:placeId", placesRateLimiter, optionalAuth, churchesController.getGooglePlaceDetails);
// --- Standard Churches Routes ---
router.get("/discover", optionalAuth, churchesController.discoverChurches);
router.get("/follow-invites/received", protect, churchesController.listReceivedFollowInvites);
router.get("/invites/received", protect, churchesController.listReceivedFollowInvites);
router.post("/follow-invites/:inviteId/accept", protect, churchesController.acceptFollowInvite);
router.post("/follow-invites/:inviteId/decline", protect, churchesController.declineFollowInvite);
router.delete("/follow-invites/:inviteId", protect, churchesController.cancelFollowInvite);
router.post("/follow-invites/:inviteId/resend", protect, churchesController.resendFollowInvite);
router.get("/", optionalAuth, churchesController.listChurches);
router.post("/", protect, churchesController.createChurch);
router.get("/:id", optionalAuth, churchesController.getChurch);
router.patch("/:id", protect, churchesController.updateChurch);
router.delete("/:id", protect, churchesController.deleteChurch);
// --- Church Follow & Follow Invitations ---
router.post("/:id/follow", protect, churchesController.followChurch);
router.post("/:id/unfollow", protect, churchesController.unfollowChurch);
router.delete("/:id/follow", protect, churchesController.unfollowChurch);
router.get("/:id/invite-candidates", protect, churchesController.listInviteCandidates);
router.get("/:id/follow-invites", protect, churchesController.listSentFollowInvites);
router.post("/:id/follow-invites/:inviteId/accept", protect, churchesController.acceptFollowInvite);
router.post("/:id/follow-invites/:inviteId/decline", protect, churchesController.declineFollowInvite);
router.delete("/:id/follow-invites/:inviteId", protect, churchesController.cancelFollowInvite);
router.post("/:id/follow-invites/:inviteId/resend", protect, churchesController.resendFollowInvite);
// Verification
router.post("/:id/verification/send", protect, churchVerificationRateLimiter, churchesController.sendVerification);
router.post("/:id/verify", optionalAuth, churchesController.verifyChurch);
// --- Church Invitations (Multiple userIds) ---
router.post("/:churchId/invite", protect, churchesController.inviteFollowers);
router.post("/:churchId/invites", protect, churchesController.inviteFollowers);
router.post("/:id/invite", protect, churchesController.inviteFollowers);
router.post("/:id/invites", protect, churchesController.inviteFollowers);
router.get("/:churchId/invites", protect, churchesController.listInvites);
router.get("/:id/invites", protect, churchesController.listInvites);
router.delete("/:churchId/invites/:userId", protect, churchesController.cancelInvite);
router.delete("/:id/invites/:userId", protect, churchesController.cancelInvite);
router.post("/:churchId/invites/accept", protect, churchesController.acceptInvite);
router.post("/:id/invites/accept", protect, churchesController.acceptInvite);
router.post("/:churchId/invites/decline", protect, churchesController.declineInvite);
router.post("/:id/invites/decline", protect, churchesController.declineInvite);
// --- Permissions, Staff & Role Limits ---
router.get("/:id/permissions", protect, churchesController.getPermissions);
router.get("/:id/role-limits", protect, churchesController.getRoleLimits);
router.get("/:id/staff", protect, churchesController.listStaff);
router.post("/:id/staff", protect, churchesController.addStaff);
router.patch("/:id/staff/:userId", protect, churchesController.updateStaffRole);
router.delete("/:id/staff/:userId", protect, churchesController.removeStaff);
// Members (Backward compatibility)
router.get("/:id/members", protect, churchesController.listMembers);
router.post("/:id/members", protect, churchesController.addMember);
router.delete("/:id/members/:userId", protect, churchesController.removeMember);
router.patch("/:id/members/:userId", protect, churchesController.updateMemberRole);
// --- Church Events ---
router.get("/:id/events", optionalAuth, churchesController.listEvents);
router.post("/:id/events", protect, churchesController.createEvent);
router.get("/:id/events/:eventId", optionalAuth, churchesController.getEvent);
router.patch("/:id/events/:eventId", protect, churchesController.updateEvent);
router.delete("/:id/events/:eventId", protect, churchesController.deleteEvent);
// --- Church Live Stream Settings ---
router.get("/:id/live-settings", protect, churchesController.getLiveSettings);
router.patch("/:id/live-settings", protect, churchesController.updateLiveSettings);
export default router;
