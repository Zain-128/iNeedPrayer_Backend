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
router.patch("/:id", protect, groupsController.updateGroup);
router.delete("/:id", protect, groupsController.deleteGroup);

router.post("/:id/join", protect, groupsController.joinGroup);
router.post("/:id/leave", protect, groupsController.leaveGroup);
router.post("/:id/invite", protect, groupsController.inviteGroup);

router.get("/:id/invite-candidates", protect, groupsController.listInviteCandidates);
router.get("/:id/members", protect, groupsController.listMembers);
router.post("/:id/members", protect, groupsController.addMember);
router.delete("/:id/members/:userId", protect, groupsController.removeMember);
router.patch("/:id/members/:userId", protect, groupsController.updateMemberRole);

export default router;
