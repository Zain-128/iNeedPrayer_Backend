import { randomBytes } from "crypto";
import { writeFile } from "fs/promises";
import path from "path";
import { isB2Configured, publicUrlForUpload, PUBLIC_BASE_URL, UPLOAD_ROOT } from "../contants.js";
import { uploadFileToB2, uploadImageToB2 } from "./b2Storage.js";
import { compressImage } from "./imageCompress.js";
import { ensureUploadDir } from "./ensureUploadDir.js";

export type SavedImage = {
  url: string;
  absoluteUrl?: string;
  storage: "b2" | "local";
};

export async function saveUploadedImage(
  buffer: Buffer,
  kind: string
): Promise<SavedImage> {
  const { buffer: compressed, ext } = await compressImage(buffer, kind);
  const name = `${Date.now()}-${randomBytes(8).toString("hex")}.${ext}`;

  if (isB2Configured()) {
    const objectKey = `images/${kind}/${name}`;
    const url = await uploadImageToB2(objectKey, compressed, ext);
    return { url, storage: "b2" };
  }

  await ensureUploadDir();
  const absPath = path.join(UPLOAD_ROOT, name);
  await writeFile(absPath, compressed);
  const urlPath = `/uploads/${name}`;
  const urls = publicUrlForUpload(urlPath);
  // Prefer relative path in DB so clients can resolve against current API host.
  // absoluteUrl is still returned for clients that want a full URL immediately.
  return {
    url: urlPath,
    absoluteUrl: urls.absoluteUrl ?? (PUBLIC_BASE_URL ? `${PUBLIC_BASE_URL}${urlPath}` : undefined),
    storage: "local",
  };
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

  if (isB2Configured()) {
    const objectKey = `videos/${kind}/${name}`;
    const url = await uploadFileToB2(objectKey, buffer, mimeType || "video/mp4");
    return { url, storage: "b2" };
  }

  await ensureUploadDir();
  const absPath = path.join(UPLOAD_ROOT, name);
  await writeFile(absPath, buffer);
  const urlPath = `/uploads/${name}`;
  const urls = publicUrlForUpload(urlPath);
  return {
    url: urlPath,
    absoluteUrl: urls.absoluteUrl ?? (PUBLIC_BASE_URL ? `${PUBLIC_BASE_URL}${urlPath}` : undefined),
    storage: "local",
  };
}

export function pickUploadedFile(
  files: Record<string, Express.Multer.File[]> | undefined
): Express.Multer.File | undefined {
  return (
    files?.video?.[0] ??
    files?.file?.[0] ??
    files?.image?.[0] ??
    files?.media?.[0] ??
    files?.files?.[0]
  );
}
