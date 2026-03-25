import { Router } from "express";
import { protect } from "../middleware/auth.middleware.js";
import { optionalAuth } from "../middleware/optionalAuth.middleware.js";
import * as usersController from "../controllers/users.controller.js";

const router = Router();

router.get("/me", protect, usersController.getMeProfile);
router.patch("/me", protect, usersController.patchMe);
router.get("/me/blocked", protect, usersController.listBlocked);
router.post("/me/blocks", protect, usersController.blockUser);
router.delete(
  "/me/blocks/:blockedUserId",
  protect,
  usersController.unblockUser
);
router.get("/search", protect, usersController.searchUsers);
router.get("/:userId", optionalAuth, usersController.getUserProfile);
router.post("/:userId/follow", protect, usersController.followUser);

export default router;
