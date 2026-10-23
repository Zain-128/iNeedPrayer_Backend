import type { Request, Response } from "express";
import type { AuthRequest } from "../middleware/auth.middleware.js";
import {
  MediaUploadError,
  pickUploadedFile,
  saveUploadedImage,
  saveUploadedVideo,
} from "../utils/imageUpload.js";
import {
  isB2Configured,
  getB2MissingKeys,
  B2_BUCKET,
  B2_REGION,
  B2_S3_ENDPOINT,
  B2_PUBLIC_URL_BASE,
} from "../contants.js";
import { verifyB2Connection } from "../utils/b2Storage.js";

const UPLOAD_KINDS = new Set([
  "avatar",
  "post",
  "group",
  "group_banner",
  "message",
  "banner",
  "cover",
  "church_banner",
  "logo",
  "church_logo",
]);

function parseKind(req: AuthRequest): string {
  const requested = String(
    req.query.kind ?? (req.body as { kind?: string })?.kind ?? "post"
  )
    .toLowerCase()
    .trim();
  return UPLOAD_KINDS.has(requested) ? requested : "post";
}

function formatUploadError(e: any) {
  const configured = isB2Configured();
  const code =
    e instanceof MediaUploadError
      ? e.code
      : e.Code || e.code || e.name || "UPLOAD_ERROR";
  const message = e.message || "Failed to process uploaded file";
  const stage = e instanceof MediaUploadError ? e.stage : "storage";
  const storage = e instanceof MediaUploadError ? e.storage : (configured ? "b2" : "local");

  return {
    success: false,
    message,
    error: code,
    code,
    stage,
    storage,
    ...(!configured ? { missingBucketKeys: getB2MissingKeys() } : {}),
  };
}

export async function uploadImage(req: AuthRequest, res: Response): Promise<void> {
  const file = pickUploadedFile(
    req.files as Record<string, Express.Multer.File[]> | undefined
  );
  if (!file) {
    res.status(400).json({
      success: false,
      message: 'No image file provided (use multipart form-data field "image" or "file")',
      error: "NO_FILE_PROVIDED",
    });
    return;
  }

  const kind = parseKind(req);

  try {
    const saved = await saveUploadedImage(file.buffer, kind, file.mimetype);
    res.status(201).json({
      success: true,
      kind,
      mediaType: "image",
      storage: saved.storage,
      url: saved.url,
      imageUrl: saved.url,
      secure_url: saved.url,
      ...(saved.absoluteUrl ? { absoluteUrl: saved.absoluteUrl } : {}),
    });
  } catch (e: any) {
    console.error("[uploadImage] Error:", e);
    res.status(400).json(formatUploadError(e));
  }
}

export async function uploadVideo(req: AuthRequest, res: Response): Promise<void> {
  const file = pickUploadedFile(
    req.files as Record<string, Express.Multer.File[]> | undefined
  );
  if (!file) {
    res.status(400).json({
      success: false,
      message: 'No video file provided (use multipart form-data field "video" or "file")',
      error: "NO_FILE_PROVIDED",
    });
    return;
  }

  const kind = parseKind(req);

  try {
    const saved = await saveUploadedVideo(file.buffer, kind, file.mimetype || "video/mp4");
    res.status(201).json({
      success: true,
      kind,
      mediaType: "video",
      storage: saved.storage,
      url: saved.url,
      ...(saved.absoluteUrl ? { absoluteUrl: saved.absoluteUrl } : {}),
    });
  } catch (e: any) {
    console.error("[uploadVideo] Error:", e);
    res.status(400).json(formatUploadError(e));
  }
}

export async function uploadMedia(req: AuthRequest, res: Response): Promise<void> {
  const file = pickUploadedFile(
    req.files as Record<string, Express.Multer.File[]> | undefined
  );
  if (!file) {
    res.status(400).json({
      success: false,
      message: 'No media file provided (use multipart form-data field "file", "image", or "video")',
      error: "NO_FILE_PROVIDED",
    });
    return;
  }

  const kind = parseKind(req);
  const mime = (file.mimetype || "").toLowerCase();
  const isVideo = mime.startsWith("video/");

  try {
    const saved = isVideo
      ? await saveUploadedVideo(file.buffer, kind, mime || "video/mp4")
      : await saveUploadedImage(file.buffer, kind, mime || "image/jpeg");

    res.status(201).json({
      success: true,
      kind,
      mediaType: isVideo ? "video" : "image",
      storage: saved.storage,
      url: saved.url,
      ...(saved.absoluteUrl ? { absoluteUrl: saved.absoluteUrl } : {}),
    });
  } catch (e: any) {
    console.error("[uploadMedia] Error:", e);
    res.status(400).json(formatUploadError(e));
  }
}

/**
 * Checks storage configuration and verifies connection to the S3 / B2 bucket
 * Accessible at GET /api/upload/status
 */
export async function getUploadStatus(_req: Request, res: Response): Promise<void> {
  const configured = isB2Configured();
  const missingKeys = getB2MissingKeys();

  if (!configured) {
    res.json({
      success: false,
      configured: false,
      connected: false,
      storage: "local",
      message:
        "Bucket is NOT configured. Images are currently saved locally to disk (/uploads). Add the missing keys to your .env to enable cloud bucket uploads.",
      missingKeys,
      requiredKeys: [
        "B2_S3_ENDPOINT",
        "B2_REGION",
        "B2_KEY_ID",
        "B2_APPLICATION_KEY",
        "B2_BUCKET",
        "B2_PUBLIC_URL_BASE",
      ],
    });
    return;
  }

  const connection = await verifyB2Connection();
  res.json({
    success: connection.ok,
    configured: true,
    connected: connection.ok,
    storage: "b2",
    bucket: B2_BUCKET,
    region: B2_REGION,
    endpoint: B2_S3_ENDPOINT,
    publicUrlBase: B2_PUBLIC_URL_BASE,
    message: connection.ok
      ? `Bucket "${B2_BUCKET}" is configured and connection succeeded!`
      : `Bucket is configured, but S3 connection failed: ${connection.error}`,
    ...(connection.code ? { errorCode: connection.code } : {}),
    ...(connection.httpStatus ? { httpStatus: connection.httpStatus } : {}),
    ...(connection.error ? { connectionError: connection.error } : {}),
  });
}
