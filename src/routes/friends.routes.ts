import { Router } from "express";
import { protect } from "../middleware/auth.middleware.js";
import * as friendsController from "../controllers/friends.controller.js";

const router = Router();

router.post("/request", protect, friendsController.sendRequest);
router.post("/accept", protect, friendsController.acceptRequest);
router.post("/reject", protect, friendsController.rejectRequest);
router.get("/", protect, friendsController.listFriends);

export default router;
