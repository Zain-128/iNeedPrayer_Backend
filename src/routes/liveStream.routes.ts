import { Router } from "express";
import { protect } from "../middleware/auth.middleware.js";
import { optionalAuth } from "../middleware/optionalAuth.middleware.js";
import * as liveStreamController from "../controllers/liveStream.controller.js";

const router = Router();

router.get(
  "/:scope/:entityId/status",
  optionalAuth,
  liveStreamController.getLiveStatus
);

router.post(
  "/:scope/:entityId/start",
  protect,
  liveStreamController.startLiveStream
);

router.post(
  "/:scope/:entityId/stop",
  protect,
  liveStreamController.stopLiveStream
);

router.post(
  "/:scope/:entityId/join",
  protect,
  liveStreamController.joinLiveStream
);

router.post(
  "/:scope/:entityId/refresh-token",
  protect,
  liveStreamController.refreshLiveToken
);

router.post(
  "/:scope/:entityId/heartbeat",
  protect,
  liveStreamController.hostHeartbeat
);

router.get("/sessions/:sessionId", optionalAuth, liveStreamController.getSession);

export default router;
