import { randomBytes } from "crypto";
import { writeFile } from "fs/promises";
import path from "path";
import { isB2Configured, publicUrlForUpload, PUBLIC_BASE_URL, UPLOAD_ROOT } from "../contants.js";
import { uploadFileToB2 } from "./b2Storage.js";
import { compressImage } from "./imageCompress.js";
import { ensureUploadDir } from "./ensureUploadDir.js";

export class MediaUploadError extends Error {
  constructor(
    public stage: "storage" | "compression",
    public storage: "b2" | "local",
    public code: string,
    message: string,
    public cause?: unknown
  ) {
    super(message);
    this.name = "MediaUploadError";
  }
}

export type SavedImage = {
  url: string;
  absoluteUrl?: string;
  storage: "b2" | "local";
};

async function storeFile(
  name: string,
  folder: "images" | "videos",
  kind: string,
  body: Buffer,
  contentType: string
): Promise<SavedImage> {
  if (isB2Configured()) {
    try {
      const objectKey = `${folder}/${kind}/${name}`;
      const url = await uploadFileToB2(objectKey, body, contentType);
      return { url, storage: "b2" };
    } catch (err: any) {
      console.error(`[upload] B2 upload failed:`, err);
      const code = err.Code || err.code || err.name || "S3_UPLOAD_ERROR";
      throw new MediaUploadError("storage", "b2", code, err.message || "Failed to upload to cloud bucket", err);
    }
  }

  try {
    await ensureUploadDir();
    const absPath = path.join(UPLOAD_ROOT, name);
    await writeFile(absPath, body);
  } catch (err: any) {
    console.error(`[upload] Local write to ${UPLOAD_ROOT} failed:`, err);
    throw new MediaUploadError(
      "storage",
      "local",
      err.code || "LOCAL_STORAGE_ERROR",
      `Failed to write to local uploads directory: ${err.message}`,
      err
    );
  }

  const urlPath = `/uploads/${name}`;
  const urls = publicUrlForUpload(urlPath);
  return {
    url: urlPath,
    absoluteUrl: urls.absoluteUrl ?? (PUBLIC_BASE_URL ? `${PUBLIC_BASE_URL}${urlPath}` : undefined),
    storage: "local",
  };
}

export async function saveUploadedImage(
  buffer: Buffer,
  kind: string,
  mimeType = "image/jpeg"
): Promise<SavedImage> {
  let body = buffer;
  let ext =
    mimeType === "image/png"
      ? "png"
      : mimeType === "image/webp"
      ? "webp"
      : mimeType === "image/gif"
      ? "gif"
      : "jpg";
  let contentType = mimeType;

  try {
    const compressed = await compressImage(buffer, kind);
    body = compressed.buffer;
    ext = compressed.ext;
    contentType = ext === "png" ? "image/png" : ext === "webp" ? "image/webp" : "image/jpeg";
  } catch (err) {
    console.warn(`[upload] Image compression failed, storing original buffer:`, err);
  }

  const name = `${Date.now()}-${randomBytes(8).toString("hex")}.${ext}`;
  return storeFile(name, "images", kind, body, contentType);
}

export async function saveUploadedVideo(
  buffer: Buffer,
  kind: string,
  mimeType: string
): Promise<SavedImage> {
  const extMap: Record<string, string> = {
    "video/mp4": "mp4",
    "video/quicktime": "mov",
    "video/webm": "webm",
    "video/3gpp": "3gp",
    "video/x-msvideo": "avi",
    "video/avi": "avi",
    "video/mkv": "mkv",
    "video/mpeg": "mpeg",
  };
  const ext = extMap[mimeType.toLowerCase()] ?? "mp4";
  const name = `${Date.now()}-${randomBytes(8).toString("hex")}.${ext}`;
  return storeFile(name, "videos", kind, buffer, mimeType || "video/mp4");
}

export function pickUploadedFile(
  files: Record<string, Express.Multer.File[]> | undefined
): Express.Multer.File | undefined {
  return (
    files?.file?.[0] ??
    files?.image?.[0] ??
    files?.video?.[0] ??
    files?.media?.[0] ??
    files?.files?.[0]
  );
}
