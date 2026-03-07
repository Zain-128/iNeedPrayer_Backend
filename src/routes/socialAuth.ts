import { Router } from "express";
import * as socialAuthController from "../controllers/socialAuth.controller.js";

const router = Router();

router.post("/social-login", socialAuthController.socialLogin);

export default router;

