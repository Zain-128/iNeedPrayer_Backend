import { Router } from "express";
import { protect } from "../middleware/auth.middleware.js";
import { optionalAuth } from "../middleware/optionalAuth.middleware.js";
import { placesRateLimiter } from "../middleware/placesRateLimit.middleware.js";
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
router.get("/", optionalAuth, churchesController.listChurches);
router.post("/", protect, churchesController.createChurch);
router.get("/:id", optionalAuth, churchesController.getChurch);
router.patch("/:id", protect, churchesController.updateChurch);
router.delete("/:id", protect, churchesController.deleteChurch);
router.post("/:id/follow", protect, churchesController.followChurch);
router.post("/:id/verification/send", protect, churchesController.sendVerification);
router.post("/:id/verify", optionalAuth, churchesController.verifyChurch);
router.get("/:id/members", protect, churchesController.listMembers);
router.post("/:id/members", protect, churchesController.addMember);
router.delete("/:id/members/:userId", protect, churchesController.removeMember);
router.patch("/:id/members/:userId", protect, churchesController.updateMemberRole);
export default router;
