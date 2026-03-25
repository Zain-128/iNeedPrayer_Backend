import { Router } from "express";
import { protect } from "../middleware/auth.middleware.js";
import { optionalAuth } from "../middleware/optionalAuth.middleware.js";
import * as groupsController from "../controllers/groups.controller.js";

const router = Router();

router.get("/discover", optionalAuth, groupsController.discoverGroups);
router.get("/mine", protect, groupsController.listMyGroups);
router.get("/", optionalAuth, groupsController.listGroups);
router.post("/", protect, groupsController.createGroup);
router.get("/:id", optionalAuth, groupsController.getGroup);
router.post("/:id/join", protect, groupsController.joinGroup);
router.post("/:id/leave", protect, groupsController.leaveGroup);
router.post("/:id/invite", protect, groupsController.inviteGroup);

export default router;
