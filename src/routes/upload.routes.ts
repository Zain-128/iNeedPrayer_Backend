import { Router } from "express";
import { protect } from "../middleware/auth.middleware.js";
import { uploadImageFields } from "../middleware/upload.middleware.js";
import * as uploadController from "../controllers/upload.controller.js";

const router = Router();

router.post("/image", protect, uploadImageFields, uploadController.uploadImage);

export default router;
