import { timeAgo, formatCountLabel } from "./timeAgo.js";

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
    image?: string;
    mode?: string;
    praysCount: number;
    praisesCount: number;
    commentsCount: number;
    sharesCount: number;
    createdAt: Date;
    author: LeanUser;
  },
  opts?: { prayed?: boolean; praised?: boolean }
) {
  return {
    id: post._id.toString(),
    author: mapAuthor(post.author),
    time: timeAgo(post.createdAt),
    text: post.text ?? "",
    image: post.image ?? "",
    mode: post.mode ?? "prayer",
    stats: {
      prays: post.praysCount,
      praises: post.praisesCount,
      comments: post.commentsCount,
      shares: post.sharesCount,
    },
    ...(opts?.prayed !== undefined ? { isPrayedByMe: opts.prayed } : {}),
    ...(opts?.praised !== undefined ? { isPraisedByMe: opts.praised } : {}),
  };
}

export type CommentTreeNode = {
  id: string;
  author: { name: string; avatar: string };
  time: string;
  text: string;
  replies?: CommentTreeNode[];
};

export type CommentLean = {
  _id: { toString(): string };
  text: string;
  createdAt: Date;
  author: LeanUser;
  parentComment?: unknown;
};

export function mapCommentTree(
  c: CommentLean,
  replyMap: Map<string, CommentLean[]>
): CommentTreeNode {
  const id = c._id.toString();
  const childRows = replyMap.get(id) ?? [];
  const replies: CommentTreeNode[] = childRows.map((r) =>
    mapCommentTree(r, replyMap)
  );
  return {
    id,
    author: {
      name: c.author.name,
      avatar: c.author.avatar ?? "",
    },
    time: timeAgo(c.createdAt),
    text: c.text,
    ...(replies.length ? { replies } : {}),
  };
}

export { formatCountLabel };
