import { Router } from "express";
import { protect } from "../middleware/auth.middleware.js";
import { optionalAuth } from "../middleware/optionalAuth.middleware.js";
import * as churchesController from "../controllers/churches.controller.js";

const router = Router();

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
