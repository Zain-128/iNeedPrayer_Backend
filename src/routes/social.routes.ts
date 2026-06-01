import { Router } from "express";
import { protect } from "../middleware/auth.middleware.js";
import * as socialController from "../controllers/social.controller.js";

const router = Router();

router.post("/follow", protect, socialController.follow);
router.post("/unfollow", protect, socialController.unfollow);
router.get("/followers", protect, socialController.followers);
router.get("/following", protect, socialController.following);
router.post("/block", protect, socialController.block);
router.post("/unblock", protect, socialController.unblock);

export default router;
