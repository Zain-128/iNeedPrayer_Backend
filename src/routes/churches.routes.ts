import { Router } from "express";
import { protect } from "../middleware/auth.middleware.js";
import { optionalAuth } from "../middleware/optionalAuth.middleware.js";
import * as churchesController from "../controllers/churches.controller.js";

const router = Router();

router.get("/", optionalAuth, churchesController.listChurches);
router.post("/", protect, churchesController.createChurch);
router.get("/:id", optionalAuth, churchesController.getChurch);
router.patch("/:id", protect, churchesController.updateChurch);
router.post("/:id/follow", protect, churchesController.followChurch);
router.post("/:id/verify", optionalAuth, churchesController.verifyChurch);

export default router;
