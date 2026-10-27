import { timeAgo, formatCountLabel } from "./timeAgo.js";
import { pickTranslatedText } from "../services/translate.service.js";
import { PUBLIC_BASE_URL } from "../contants.js";
/** Prefer relative /uploads paths; rewrite legacy Hostinger absolute upload URLs. */
export function normalizeMediaUrl(url) {
    if (!url)
        return "";
    const trimmed = url.trim();
    if (!trimmed)
        return "";
    const uploadsMatch = trimmed.match(/\/uploads\/[^?#]+/i);
    if (uploadsMatch) {
        const pathOnly = uploadsMatch[0];
        if (PUBLIC_BASE_URL)
            return `${PUBLIC_BASE_URL}${pathOnly}`;
        return pathOnly;
    }
    return trimmed;
}
export function mapAuthor(u) {
    const location = [u.city, u.state, u.country].filter(Boolean).join(", ") || undefined;
    return {
        id: u._id.toString(),
        name: u.name,
        avatar: normalizeMediaUrl(u.avatar ?? ""),
        ...(location ? { location } : {}),
    };
}
export function mapPost(post, opts) {
    const translations = post.translations instanceof Map
        ? Object.fromEntries(post.translations.entries())
        : post.translations;
    const authorId = post.author?._id?.toString?.() ?? "";
    const isMine = !!(opts?.viewerId && authorId && opts.viewerId === authorId);
    const groupId = post.group && typeof post.group === "object"
        ? "_id" in post.group && post.group._id
            ? post.group._id.toString()
            : "id" in post.group && typeof post.group.id === "string"
                ? post.group.id
                : "toString" in post.group && typeof post.group.toString === "function"
                    ? post.group.toString()
                    : null
        : null;
    const churchId = post.church && typeof post.church === "object"
        ? "_id" in post.church && post.church._id
            ? post.church._id.toString()
            : "id" in post.church && typeof post.church.id === "string"
                ? post.church.id
                : "toString" in post.church && typeof post.church.toString === "function"
                    ? post.church.toString()
                    : null
        : null;
    const group = groupId &&
        post.group &&
        typeof post.group === "object" &&
        "name" in post.group &&
        typeof post.group.name === "string"
        ? {
            id: groupId,
            name: post.group.name,
            image: normalizeMediaUrl("image" in post.group && typeof post.group.image === "string"
                ? post.group.image
                : ""),
            privacy: "privacy" in post.group && typeof post.group.privacy === "string"
                ? post.group.privacy.toLowerCase()
                : "public",
        }
        : undefined;
    const church = churchId &&
        post.church &&
        typeof post.church === "object" &&
        "name" in post.church &&
        typeof post.church.name === "string"
        ? {
            id: churchId,
            name: post.church.name,
            image: normalizeMediaUrl("image" in post.church && typeof post.church.image === "string"
                ? post.church.image
                : ""),
        }
        : undefined;
    const rawImages = Array.isArray(post.images)
        ? post.images
        : [];
    const normalizedImages = rawImages
        .map(normalizeMediaUrl)
        .filter(Boolean);
    const primaryImage = normalizeMediaUrl(post.image ?? "") || normalizedImages[0] || "";
    if (primaryImage && !normalizedImages.includes(primaryImage)) {
        normalizedImages.unshift(primaryImage);
    }
    const rawVideos = Array.isArray(post.videos)
        ? post.videos
        : [];
    const normalizedVideos = rawVideos
        .map(normalizeMediaUrl)
        .filter(Boolean);
    const primaryVideo = normalizeMediaUrl(post.video ?? "") || normalizedVideos[0] || "";
    if (primaryVideo && !normalizedVideos.includes(primaryVideo)) {
        normalizedVideos.unshift(primaryVideo);
    }
    const rawThumbnail = post.videoThumbnail;
    const videoThumbnail = typeof rawThumbnail === "string" && rawThumbnail.trim()
        ? normalizeMediaUrl(rawThumbnail.trim())
        : undefined;
    const media = [
        ...normalizedImages.map((url) => ({
            type: "image",
            url,
        })),
        ...normalizedVideos.map((url) => ({
            type: "video",
            url,
            ...(videoThumbnail ? { thumbnail: videoThumbnail } : {}),
        })),
    ];
    return {
        id: post._id.toString(),
        author: mapAuthor(post.author),
        time: timeAgo(post.createdAt),
        text: pickTranslatedText(post, opts?.lang),
        originalText: post.text ?? "",
        sourceLanguage: post.sourceLanguage ?? "en",
        ...(translations && Object.keys(translations).length
            ? { translations }
            : {}),
        image: primaryImage,
        images: normalizedImages,
        video: primaryVideo,
        videos: normalizedVideos,
        videoThumbnail: videoThumbnail ?? "",
        media,
        mode: post.mode ?? "prayer",
        ...(group ? { group } : {}),
        ...(groupId ? { groupId } : {}),
        ...(church ? { church } : {}),
        ...(churchId ? { churchId } : {}),
        stats: {
            prays: post.praysCount,
            praises: post.praisesCount,
            likes: post.likesCount ?? 0,
            comments: post.commentsCount,
            shares: post.sharesCount,
        },
        isMine,
        ...(opts?.prayed !== undefined ? { isPrayedByMe: opts.prayed } : {}),
        ...(opts?.praised !== undefined ? { isPraisedByMe: opts.praised } : {}),
        ...(opts?.liked !== undefined ? { isLikedByMe: opts.liked } : {}),
    };
}
export function mapCommentTree(c, replyMap, reactionFlags, viewerId) {
    const id = c._id.toString();
    const childRows = replyMap.get(id) ?? [];
    const flags = reactionFlags?.get(id);
    const authorId = c.author?._id?.toString?.() ?? "";
    const replies = childRows.map((r) => mapCommentTree(r, replyMap, reactionFlags, viewerId));
    return {
        id,
        author: mapAuthor(c.author),
        time: timeAgo(c.createdAt),
        text: c.text ?? "",
        image: c.image ? normalizeMediaUrl(c.image) : "",
        praysCount: c.praysCount ?? 0,
        praisesCount: c.praisesCount ?? 0,
        isPrayedByMe: flags?.pray ?? false,
        isPraisedByMe: flags?.praise ?? false,
        isMine: !!(viewerId && authorId && viewerId === authorId),
        replies,
    };
}
export { formatCountLabel };
