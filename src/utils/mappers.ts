import { timeAgo, formatCountLabel } from "./timeAgo.js";
import { pickTranslatedText } from "../services/translate.service.js";

type LeanUser = {
  _id: { toString(): string };
  name: string;
  avatar?: string;
  city?: string;
  state?: string;
  country?: string;
};

export function mapAuthor(u: LeanUser) {
  const location =
    [u.city, u.state, u.country].filter(Boolean).join(", ") || undefined;
  return {
    id: u._id.toString(),
    name: u.name,
    avatar: u.avatar ?? "",
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
    group?: { toString(): string } | null;
    church?: { toString(): string } | null;
  },
  opts?: {
    prayed?: boolean;
    praised?: boolean;
    liked?: boolean;
    lang?: string;
  }
) {
  const translations =
    post.translations instanceof Map
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

export type CommentTreeNode = {
  id: string;
  author: ReturnType<typeof mapAuthor>;
  time: string;
  text: string;
  praysCount: number;
  praisesCount: number;
  isPrayedByMe: boolean;
  isPraisedByMe: boolean;
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
  reactionFlags?: Map<string, { pray: boolean; praise: boolean }>
): CommentTreeNode {
  const id = c._id.toString();
  const childRows = replyMap.get(id) ?? [];
  const flags = reactionFlags?.get(id);
  const replies: CommentTreeNode[] = childRows.map((r) =>
    mapCommentTree(r, replyMap, reactionFlags)
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
    replies,
  };
}

export { formatCountLabel };
