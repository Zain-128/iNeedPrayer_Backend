import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import {
  B2_APPLICATION_KEY,
  B2_BUCKET,
  B2_KEY_ID,
  B2_PUBLIC_URL_BASE,
  B2_REGION,
  B2_S3_ENDPOINT,
} from "../contants.js";

let client: S3Client | null = null;

function getClient(): S3Client {
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

function contentTypeForExt(ext: string): string {
  if (ext === "png") return "image/png";
  return "image/jpeg";
}

/**
 * Uploads bytes to Backblaze B2 via S3-compatible API. Returns the public HTTPS URL.
 */
export async function uploadImageToB2(
  objectKey: string,
  body: Buffer,
  ext: string
): Promise<string> {
  const c = getClient();
  await c.send(
    new PutObjectCommand({
      Bucket: B2_BUCKET,
      Key: objectKey,
      Body: body,
      ContentType: contentTypeForExt(ext),
      CacheControl: "public, max-age=31536000, immutable",
    })
  );
  return `${B2_PUBLIC_URL_BASE}/${objectKey}`;
}
