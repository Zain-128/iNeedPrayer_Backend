import { randomBytes } from "crypto";
import { writeFile } from "fs/promises";
import path from "path";
import { isB2Configured, publicUrlForUpload, PUBLIC_BASE_URL, UPLOAD_ROOT } from "../contants.js";
import { uploadFileToB2 } from "./b2Storage.js";
import { compressImage } from "./imageCompress.js";
import { ensureUploadDir } from "./ensureUploadDir.js";

/** Thrown by the save helpers so the API can report which step failed. */
export class MediaUploadError extends Error {
    constructor(stage, storage, code, cause) {
        const msg = cause instanceof Error ? cause.message : String(cause);
        super(msg);
        this.stage = stage;
        this.storage = storage;
        this.code = code;
        this.name = "MediaUploadError";
    }
}

/** Short, non-sensitive error identifier (e.g. EACCES, InvalidAccessKeyId, NoSuchBucket). */
function errorCode(err) {
    const e = err;
    return String(e?.code || e?.Code || e?.name || "UnknownError");
}

/** Writes to B2 when configured, else local /uploads; wraps failures in MediaUploadError. */
async function storeFile(name, folder, kind, body, contentType) {
    if (isB2Configured()) {
        try {
            const objectKey = `${folder}/${kind}/${name}`;
            const url = await uploadFileToB2(objectKey, body, contentType);
            return { url, storage: "b2" };
        }
        catch (err) {
            console.error(`[upload] B2 upload failed:`, err);
            const code = err.Code || err.code || err.name || "S3_UPLOAD_ERROR";
            throw new MediaUploadError("storage", "b2", code, err);
        }
    }
    try {
        await ensureUploadDir();
        await writeFile(path.join(UPLOAD_ROOT, name), body);
    }
    catch (err) {
        console.error(`[upload] Local write to ${UPLOAD_ROOT} failed (${errorCode(err)}):`, err);
        throw new MediaUploadError("storage", "local", errorCode(err), err);
    }
    const urlPath = `/uploads/${name}`;
    const urls = publicUrlForUpload(urlPath);
    return {
        url: urlPath,
        absoluteUrl: urls.absoluteUrl ?? (PUBLIC_BASE_URL ? `${PUBLIC_BASE_URL}${urlPath}` : undefined),
        storage: "local",
    };
}

export async function saveUploadedImage(buffer, kind, mimeType = "image/jpeg") {
    let body = buffer;
    let ext = mimeType === "image/png" ? "png" : mimeType === "image/webp" ? "webp" : mimeType === "image/gif" ? "gif" : "jpg";
    let contentType = mimeType;
    try {
        const compressed = await compressImage(buffer, kind);
        body = compressed.buffer;
        ext = compressed.ext;
        contentType = ext === "png" ? "image/png" : ext === "webp" ? "image/webp" : "image/jpeg";
    }
    catch (err) {
        console.error(`[upload] Image compression failed (${errorCode(err)}); storing original:`, err);
    }
    const name = `${Date.now()}-${randomBytes(8).toString("hex")}.${ext}`;
    return storeFile(name, "images", kind, body, contentType);
}

export async function saveUploadedVideo(buffer, kind, mimeType) {
    const extMap = {
        "video/mp4": "mp4",
        "video/quicktime": "mov",
        "video/webm": "webm",
        "video/3gpp": "3gp",
        "video/x-msvideo": "avi",
        "video/avi": "avi",
        "video/mkv": "mkv",
        "video/mpeg": "mpeg",
    };
    const ext = extMap[(mimeType || "").toLowerCase()] ?? "mp4";
    const name = `${Date.now()}-${randomBytes(8).toString("hex")}.${ext}`;
    return storeFile(name, "videos", kind, buffer, mimeType || "video/mp4");
}

export function pickUploadedFile(files) {
    return (files?.file?.[0] ??
        files?.image?.[0] ??
        files?.video?.[0] ??
        files?.media?.[0] ??
        files?.files?.[0]);
}
