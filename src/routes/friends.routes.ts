import { Router } from "express";
import { protect } from "../middleware/auth.middleware.js";
import * as friendsController from "../controllers/friends.controller.js";

const router = Router();

router.get("/requests/incoming", protect, friendsController.listIncomingRequests);
router.get("/requests/outgoing", protect, friendsController.listOutgoingRequests);
router.delete("/request/:userId", protect, friendsController.cancelRequest);
router.delete("/:userId", protect, friendsController.removeFriend);

router.post("/request", protect, friendsController.sendRequest);
router.post("/accept", protect, friendsController.acceptRequest);
router.post("/reject", protect, friendsController.rejectRequest);
router.get("/", protect, friendsController.listFriends);

export default router;
