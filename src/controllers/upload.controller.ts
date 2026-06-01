import type { Response } from "express";
import type { AuthRequest } from "../middleware/auth.middleware.js";
import { pickUploadedFile, saveUploadedImage } from "../utils/imageUpload.js";

export async function uploadImage(req: AuthRequest, res: Response): Promise<void> {
  const file = pickUploadedFile(
    req.files as Record<string, Express.Multer.File[]> | undefined
  );
  if (!file) {
    res
      .status(400)
      .json({ message: 'No image file (use multipart field "image" or "file")' });
    return;
  }

  const kind = String(
    req.query.kind ?? (req.body as { kind?: string })?.kind ?? "post"
  )
    .toLowerCase()
    .trim();

  try {
    const saved = await saveUploadedImage(file.buffer, kind || "post");
    res.status(201).json({
      kind: kind || "post",
      storage: saved.storage,
      url: saved.url,
      ...(saved.absoluteUrl ? { absoluteUrl: saved.absoluteUrl } : {}),
    });
  } catch (e) {
    console.error("uploadImage", e);
    res.status(500).json({ message: "Could not process image" });
  }
}
