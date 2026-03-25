import { Router } from "express";
import { protect } from "../middleware/auth.middleware.js";
import * as paymentController from "../controllers/payment.controller.js";

const router = Router();

router.get("/", protect, paymentController.listMethods);
router.post("/", protect, paymentController.addMethod);
router.delete("/:id", protect, paymentController.removeMethod);

export default router;
