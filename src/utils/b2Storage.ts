import { HeadBucketCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import {
  B2_APPLICATION_KEY,
  B2_BUCKET,
  B2_KEY_ID,
  B2_PUBLIC_URL_BASE,
  B2_REGION,
  B2_S3_ENDPOINT,
} from "../contants.js";

let client: S3Client | null = null;

export function resetB2Client(): void {
  client = null;
}

export function getClient(): S3Client {
  if (!client) {
    client = new S3Client({
      endpoint: B2_S3_ENDPOINT,
      region: B2_REGION,
      credentials: {
        accessKeyId: B2_KEY_ID,
        secretAccessKey: B2_APPLICATION_KEY,
      },
      forcePathStyle: true,
    });
  }
  return client;
}

export function contentTypeForExt(ext: string): string {
  const e = ext.toLowerCase().replace(/^\./, "");
  if (e === "png") return "image/png";
  if (e === "webp") return "image/webp";
  if (e === "gif") return "image/gif";
  if (e === "mp4") return "video/mp4";
  if (e === "mov") return "video/quicktime";
  if (e === "webm") return "video/webm";
  if (e === "3gp") return "video/3gpp";
  if (e === "avi") return "video/x-msvideo";
  if (e === "mkv") return "video/mkv";
  return "image/jpeg";
}

/**
 * Uploads arbitrary bytes (image, video, etc.) to Backblaze B2 / AWS S3.
 * Returns the public HTTPS URL.
 */
export async function uploadFileToB2(
  objectKey: string,
  body: Buffer,
  contentType: string
): Promise<string> {
  const c = getClient();
  try {
    await c.send(
      new PutObjectCommand({
        Bucket: B2_BUCKET,
        Key: objectKey,
        Body: body,
        ContentType: contentType,
        CacheControl: "public, max-age=31536000, immutable",
      })
    );
  } catch (err: any) {
    const code = err.Code || err.code || err.name || "S3_UPLOAD_ERROR";
    const msg = err.message || "Failed to upload object to S3/B2 bucket";
    console.error(`[B2Storage] Upload error (${code}):`, err);
    throw new Error(`Bucket upload failed [${code}]: ${msg}`);
  }

  const cleanBase = B2_PUBLIC_URL_BASE.replace(/\/$/, "");
  const cleanKey = objectKey.replace(/^\//, "");
  return `${cleanBase}/${cleanKey}`;
}

/**
 * Uploads an image to Backblaze B2 / AWS S3. Returns the public HTTPS URL.
 */
export async function uploadImageToB2(
  objectKey: string,
  body: Buffer,
  ext: string
): Promise<string> {
  return uploadFileToB2(objectKey, body, contentTypeForExt(ext));
}

/**
 * Verifies connection and credentials to the B2 / S3 bucket
 */
export async function verifyB2Connection(): Promise<{
  ok: boolean;
  error?: string;
  code?: string;
  httpStatus?: number;
}> {
  try {
    const c = getClient();
    await c.send(new HeadBucketCommand({ Bucket: B2_BUCKET }));
    return { ok: true };
  } catch (err: any) {
    const code = err.Code || err.code || err.name || "S3_ERROR";
    const message = err.message || String(err);
    const httpStatus = err.$metadata?.httpStatusCode;
    return {
      ok: false,
      code,
      httpStatus,
      error: `[${code}] ${message}`,
    };
  }
}
