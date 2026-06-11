import { timeAgo, formatCountLabel } from "./timeAgo.js";
import { pickTranslatedText } from "../services/translate.service.js";
export function mapAuthor(u) {
    const location = [u.city, u.state, u.country].filter(Boolean).join(", ") || undefined;
    return {
        id: u._id.toString(),
        name: u.name,
        avatar: u.avatar ?? "",
        ...(location ? { location } : {}),
    };
}
export function mapPost(post, opts) {
    const translations = post.translations instanceof Map
        ? Object.fromEntries(post.translations.entries())
        : post.translations;
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
        image: post.image ?? "",
        mode: post.mode ?? "prayer",
        ...(post.group ? { groupId: post.group.toString() } : {}),
        ...(post.church ? { churchId: post.church.toString() } : {}),
        stats: {
            prays: post.praysCount,
            praises: post.praisesCount,
            likes: post.likesCount ?? 0,
            comments: post.commentsCount,
            shares: post.sharesCount,
        },
        ...(opts?.prayed !== undefined ? { isPrayedByMe: opts.prayed } : {}),
        ...(opts?.praised !== undefined ? { isPraisedByMe: opts.praised } : {}),
        ...(opts?.liked !== undefined ? { isLikedByMe: opts.liked } : {}),
    };
}
export function mapCommentTree(c, replyMap, reactionFlags) {
    const id = c._id.toString();
    const childRows = replyMap.get(id) ?? [];
    const flags = reactionFlags?.get(id);
    const replies = childRows.map((r) => mapCommentTree(r, replyMap, reactionFlags));
    return {
        id,
        author: {
            name: c.author.name,
            avatar: c.author.avatar ?? "",
        },
        time: timeAgo(c.createdAt),
        text: c.text,
        praysCount: c.praysCount ?? 0,
        praisesCount: c.praisesCount ?? 0,
        isPrayedByMe: flags?.pray ?? false,
        isPraisedByMe: flags?.praise ?? false,
        replies,
    };
}
export { formatCountLabel };
