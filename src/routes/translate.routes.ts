import { Router } from "express";
import { protect } from "../middleware/auth.middleware.js";
import { optionalAuth } from "../middleware/optionalAuth.middleware.js";
import { translateRateLimiter } from "../middleware/translateRateLimit.middleware.js";
import * as translateController from "../controllers/translate.controller.js";

const router = Router();

// Dynamic content translation (on-demand for posts, comments, replies, descriptions)
router.post("/", optionalAuth, translateRateLimiter, translateController.translateText);

// Language preference synchronization for registered users
router.get("/preference", protect, translateController.getLanguagePreference);
router.post("/preference", protect, translateController.updateLanguagePreference);
router.patch("/preference", protect, translateController.updateLanguagePreference);
router.put("/preference", protect, translateController.updateLanguagePreference);

export default router;
