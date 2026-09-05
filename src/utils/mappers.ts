import { timeAgo, formatCountLabel } from "./timeAgo.js";
import { pickTranslatedText } from "../services/translate.service.js";
import { PUBLIC_BASE_URL } from "../contants.js";

type LeanUser = {
  _id: { toString(): string };
  name: string;
  avatar?: string;
  city?: string;
  state?: string;
  country?: string;
};

/** Prefer relative /uploads paths; rewrite legacy Hostinger absolute upload URLs. */
export function normalizeMediaUrl(url?: string | null): string {
  if (!url) return "";
  const trimmed = url.trim();
  if (!trimmed) return "";

  const uploadsMatch = trimmed.match(/\/uploads\/[^?#]+/i);
  if (uploadsMatch) {
    const pathOnly = uploadsMatch[0];
    if (PUBLIC_BASE_URL) return `${PUBLIC_BASE_URL}${pathOnly}`;
    return pathOnly;
  }

  return trimmed;
}

export function mapAuthor(u: LeanUser) {
  const location =
    [u.city, u.state, u.country].filter(Boolean).join(", ") || undefined;
  return {
    id: u._id.toString(),
    name: u.name,
    avatar: normalizeMediaUrl(u.avatar ?? ""),
    ...(location ? { location } : {}),
  };
}

export function mapPost(
  post: {
    _id: { toString(): string };
    text?: string;
    sourceLanguage?: string;
    translations?: Map<string, string> | Record<string, string>;
    image?: string;
    mode?: string;
    praysCount: number;
    praisesCount: number;
    likesCount?: number;
    commentsCount: number;
    sharesCount: number;
    createdAt: Date;
    author: LeanUser;
    group?:
      | { toString(): string }
      | {
          _id?: { toString(): string };
          id?: string;
          name?: string;
          image?: string;
          privacy?: string;
        }
      | null;
    church?:
      | { toString(): string }
      | {
          _id?: { toString(): string };
          id?: string;
          name?: string;
          image?: string;
        }
      | null;
  },
  opts?: {
    prayed?: boolean;
    praised?: boolean;
    liked?: boolean;
    lang?: string;
    viewerId?: string;
  }
) {
  const translations =
    post.translations instanceof Map
      ? Object.fromEntries(post.translations.entries())
      : post.translations;

  const authorId = post.author?._id?.toString?.() ?? "";
  const isMine = !!(opts?.viewerId && authorId && opts.viewerId === authorId);

  const groupId =
    post.group && typeof post.group === "object"
      ? "_id" in post.group && post.group._id
        ? post.group._id.toString()
        : "id" in post.group && typeof post.group.id === "string"
          ? post.group.id
          : "toString" in post.group && typeof post.group.toString === "function"
            ? post.group.toString()
            : null
      : null;

  const churchId =
    post.church && typeof post.church === "object"
      ? "_id" in post.church && post.church._id
        ? post.church._id.toString()
        : "id" in post.church && typeof post.church.id === "string"
          ? post.church.id
          : "toString" in post.church && typeof post.church.toString === "function"
            ? post.church.toString()
            : null
      : null;

  const group =
    groupId &&
    post.group &&
    typeof post.group === "object" &&
    "name" in post.group &&
    typeof post.group.name === "string"
      ? {
          id: groupId,
          name: post.group.name,
          image: normalizeMediaUrl(
            "image" in post.group && typeof post.group.image === "string"
              ? post.group.image
              : ""
          ),
          privacy:
            "privacy" in post.group && typeof post.group.privacy === "string"
              ? post.group.privacy.toLowerCase()
              : "public",
        }
      : undefined;

  const church =
    churchId &&
    post.church &&
    typeof post.church === "object" &&
    "name" in post.church &&
    typeof post.church.name === "string"
      ? {
          id: churchId,
          name: post.church.name,
          image: normalizeMediaUrl(
            "image" in post.church && typeof post.church.image === "string"
              ? post.church.image
              : ""
          ),
        }
      : undefined;

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
    image: normalizeMediaUrl(post.image ?? ""),
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

export type CommentTreeNode = {
  id: string;
  author: ReturnType<typeof mapAuthor>;
  time: string;
  text: string;
  praysCount: number;
  praisesCount: number;
  isPrayedByMe: boolean;
  isPraisedByMe: boolean;
  isMine: boolean;
  replies: CommentTreeNode[];
};

export type CommentLean = {
  _id: { toString(): string };
  text: string;
  createdAt: Date;
  author: LeanUser;
  parentComment?: unknown;
  praysCount?: number;
  praisesCount?: number;
};

export function mapCommentTree(
  c: CommentLean,
  replyMap: Map<string, CommentLean[]>,
  reactionFlags?: Map<string, { pray: boolean; praise: boolean }>,
  viewerId?: string
): CommentTreeNode {
  const id = c._id.toString();
  const childRows = replyMap.get(id) ?? [];
  const flags = reactionFlags?.get(id);
  const authorId = c.author?._id?.toString?.() ?? "";
  const replies: CommentTreeNode[] = childRows.map((r) =>
    mapCommentTree(r, replyMap, reactionFlags, viewerId)
  );
  return {
    id,
    author: mapAuthor(c.author),
    time: timeAgo(c.createdAt),
    text: c.text,
    praysCount: c.praysCount ?? 0,
    praisesCount: c.praisesCount ?? 0,
    isPrayedByMe: flags?.pray ?? false,
    isPraisedByMe: flags?.praise ?? false,
    isMine: !!(viewerId && authorId && viewerId === authorId),
    replies,
  };
}

export { formatCountLabel };
