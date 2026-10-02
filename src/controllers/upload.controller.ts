import type { Response } from "express";
import type { AuthRequest } from "../middleware/auth.middleware.js";
import { pickUploadedFile, saveUploadedImage, saveUploadedVideo } from "../utils/imageUpload.js";

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
      mediaType: "image",
      storage: saved.storage,
      url: saved.url,
      ...(saved.absoluteUrl ? { absoluteUrl: saved.absoluteUrl } : {}),
    });
  } catch (e) {
    console.error("uploadImage", e);
    res.status(500).json({ message: "Could not process image" });
  }
}

export async function uploadVideo(req: AuthRequest, res: Response): Promise<void> {
  const file = pickUploadedFile(
    req.files as Record<string, Express.Multer.File[]> | undefined
  );
  if (!file) {
    res
      .status(400)
      .json({ message: 'No video file (use multipart field "video" or "file")' });
    return;
  }

  const kind = String(
    req.query.kind ?? (req.body as { kind?: string })?.kind ?? "post"
  )
    .toLowerCase()
    .trim();

  try {
    const saved = await saveUploadedVideo(file.buffer, kind || "post", file.mimetype);
    res.status(201).json({
      kind: kind || "post",
      mediaType: "video",
      storage: saved.storage,
      url: saved.url,
      ...(saved.absoluteUrl ? { absoluteUrl: saved.absoluteUrl } : {}),
    });
  } catch (e) {
    console.error("uploadVideo", e);
    res.status(500).json({ message: "Could not process video" });
  }
}

export async function uploadMedia(req: AuthRequest, res: Response): Promise<void> {
  const file = pickUploadedFile(
    req.files as Record<string, Express.Multer.File[]> | undefined
  );
  if (!file) {
    res
      .status(400)
      .json({ message: 'No media file (use multipart field "file", "video", or "image")' });
    return;
  }

  const kind = String(
    req.query.kind ?? (req.body as { kind?: string })?.kind ?? "post"
  )
    .toLowerCase()
    .trim();

  const isVideo = file.mimetype.toLowerCase().startsWith("video/");

  try {
    const saved = isVideo
      ? await saveUploadedVideo(file.buffer, kind || "post", file.mimetype)
      : await saveUploadedImage(file.buffer, kind || "post");

    res.status(201).json({
      kind: kind || "post",
      mediaType: isVideo ? "video" : "image",
      storage: saved.storage,
      url: saved.url,
      ...(saved.absoluteUrl ? { absoluteUrl: saved.absoluteUrl } : {}),
    });
  } catch (e) {
    console.error("uploadMedia", e);
    res.status(500).json({ message: "Could not process media" });
  }
}
