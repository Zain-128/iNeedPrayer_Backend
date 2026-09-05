import mongoose from "mongoose";
import { Response } from "express";
import { AuthRequest } from "../middleware/auth.middleware.js";
import * as usersService from "../services/users.service.js";
import * as postsService from "../services/posts.service.js";
import * as groupsService from "../services/groups.service.js";
import * as churchesService from "../services/churches.service.js";
import { Group } from "../models/group.model.js";
import { Church } from "../models/church.model.js";

function parseTargetUserId(body: unknown): string | null {
  const userId = (body as { userId?: string })?.userId;
  if (!userId || typeof userId !== "string") return null;
  if (!mongoose.isValidObjectId(userId)) return null;
  return userId;
}

function parseProfileUserId(
  queryUserId: unknown,
  fallbackUserId: string
): string | null {
  if (queryUserId === undefined || queryUserId === "") return fallbackUserId;
  if (typeof queryUserId !== "string") return null;
  if (!mongoose.isValidObjectId(queryUserId)) return null;
  return queryUserId;
}

function handleError(res: Response, err: unknown) {
  const e = err as Error & { statusCode?: number };
  return res.status(e.statusCode ?? 500).json({ message: e.message });
}

type SearchType = "all" | "people" | "posts" | "groups" | "churches";

function parseSearchType(raw: unknown): SearchType | null {
  if (raw === undefined) return "all";
  if (typeof raw !== "string") return null;
  if (
    raw === "all" ||
    raw === "people" ||
    raw === "posts" ||
    raw === "groups" ||
    raw === "churches"
  ) {
    return raw;
  }
  return null;
}

function parsePageLimit(query: AuthRequest["query"]) {
  const page = Math.max(1, Number(query.page) || 1);
  const limit = Math.min(50, Math.max(1, Number(query.limit) || 20));
  return { page, limit };
}

function paginate<T>(items: T[], page: number, limit: number) {
  const total = items.length;
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const start = (page - 1) * limit;
  return {
    items: items.slice(start, start + limit),
    total,
    totalPages,
  };
}

async function attachPostScopes(
  posts: Array<Record<string, unknown>>
): Promise<Array<Record<string, unknown>>> {
  const groupIds = new Set<string>();
  const churchIds = new Set<string>();

  for (const p of posts) {
    if (typeof p.groupId === "string") groupIds.add(p.groupId);
    if (typeof p.churchId === "string") churchIds.add(p.churchId);
  }

  const [groups, churches] = await Promise.all([
    groupIds.size
      ? Group.find({ _id: { $in: [...groupIds] } })
          .select("name image privacy")
          .lean()
      : Promise.resolve([]),
    churchIds.size
      ? Church.find({ _id: { $in: [...churchIds] } })
          .select("name image")
          .lean()
      : Promise.resolve([]),
  ]);

  const groupMap = new Map(
    groups.map((g) => [
      g._id.toString(),
      {
        id: g._id.toString(),
        name: g.name ?? "",
        image: g.image ?? "",
        privacy: String(g.privacy ?? "Public").toLowerCase(),
      },
    ])
  );

  const churchMap = new Map(
    churches.map((c) => [
      c._id.toString(),
      {
        id: c._id.toString(),
        name: c.name ?? "",
        image: c.image ?? "",
      },
    ])
  );

  return posts.map((post) => {
    const out = { ...post };
    const groupId = typeof out.groupId === "string" ? out.groupId : null;
    const churchId = typeof out.churchId === "string" ? out.churchId : null;
    if (groupId && groupMap.has(groupId)) {
      out.group = groupMap.get(groupId);
    }
    if (churchId && churchMap.has(churchId)) {
      out.church = churchMap.get(churchId);
    }
    return out;
  });
}

export const follow = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.userId) return res.status(401).json({ message: "Unauthorized" });
    const targetId = parseTargetUserId(req.body);
    if (!targetId) return res.status(400).json({ message: "userId is required" });
    const result = await usersService.followUser(req.userId, targetId);
    return res.json(result);
  } catch (err) {
    return handleError(res, err);
  }
};

export const unfollow = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.userId) return res.status(401).json({ message: "Unauthorized" });
    const targetId = parseTargetUserId(req.body);
    if (!targetId) return res.status(400).json({ message: "userId is required" });
    const result = await usersService.unfollowUser(req.userId, targetId);
    return res.json(result);
  } catch (err) {
    return handleError(res, err);
  }
};

export const followers = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.userId) return res.status(401).json({ message: "Unauthorized" });
    const profileUserId = parseProfileUserId(req.query.userId, req.userId);
    if (!profileUserId) {
      return res.status(400).json({ message: "Invalid userId" });
    }
    const users = await usersService.listFollowers(profileUserId, req.userId);
    return res.json({ users });
  } catch (err) {
    return handleError(res, err);
  }
};

export const following = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.userId) return res.status(401).json({ message: "Unauthorized" });
    const profileUserId = parseProfileUserId(req.query.userId, req.userId);
    if (!profileUserId) {
      return res.status(400).json({ message: "Invalid userId" });
    }
    const users = await usersService.listFollowing(profileUserId, req.userId);
    return res.json({ users });
  } catch (err) {
    return handleError(res, err);
  }
};

export const block = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.userId) return res.status(401).json({ message: "Unauthorized" });
    const blockedId = parseTargetUserId(req.body);
    if (!blockedId) return res.status(400).json({ message: "userId is required" });
    await usersService.blockUser(req.userId, blockedId);
    return res.json({ message: "Blocked" });
  } catch (err) {
    return handleError(res, err);
  }
};

export const unblock = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.userId) return res.status(401).json({ message: "Unauthorized" });
    const blockedId = parseTargetUserId(req.body);
    if (!blockedId) return res.status(400).json({ message: "userId is required" });
    await usersService.unblockUser(req.userId, blockedId);
    return res.json({ message: "Unblocked" });
  } catch (err) {
    return handleError(res, err);
  }
};

export const search = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.userId) return res.status(401).json({ message: "Unauthorized" });

    const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
    const type = parseSearchType(req.query.type);
    if (!type) return res.status(400).json({ message: "Invalid type" });

    const { page, limit } = parsePageLimit(req.query);
    const lang = typeof req.query.lang === "string" ? req.query.lang : undefined;

    if (!q) {
      if (type === "all") {
        return res.json({
          q,
          type,
          page,
          limit,
          counts: { people: 0, posts: 0, groups: 0, churches: 0 },
          people: [],
          posts: [],
          groups: [],
          churches: [],
        });
      }
      return res.json({
        q,
        type,
        page,
        limit,
        total: 0,
        totalPages: 1,
        ...(type === "people" ? { people: [] } : {}),
        ...(type === "posts" ? { posts: [] } : {}),
        ...(type === "groups" ? { groups: [] } : {}),
        ...(type === "churches" ? { churches: [] } : {}),
      });
    }

    if (type === "posts") {
      const result = await postsService.listPosts({
        viewerId: req.userId,
        q,
        page,
        limit,
        lang,
      });
      const posts = await attachPostScopes(
        result.posts as unknown as Array<Record<string, unknown>>
      );
      return res.json({
        q,
        type,
        page: result.page,
        limit: result.limit,
        total: result.total,
        totalPages: Math.max(1, Math.ceil(result.total / result.limit)),
        posts,
      });
    }

    if (type === "people") {
      const peopleAll = await usersService.searchUsers(q, req.userId, 500);
      const pageData = paginate(peopleAll, page, limit);
      return res.json({
        q,
        type,
        page,
        limit,
        total: pageData.total,
        totalPages: pageData.totalPages,
        people: pageData.items,
      });
    }

    if (type === "groups") {
      const groupsAll = await groupsService.listGroups({ userId: req.userId, q });
      const pageData = paginate(groupsAll, page, limit);
      return res.json({
        q,
        type,
        page,
        limit,
        total: pageData.total,
        totalPages: pageData.totalPages,
        groups: pageData.items,
      });
    }

    if (type === "churches") {
      const churchesAll = await churchesService.listChurches({ userId: req.userId, q });
      const pageData = paginate(churchesAll, page, limit);
      return res.json({
        q,
        type,
        page,
        limit,
        total: pageData.total,
        totalPages: pageData.totalPages,
        churches: pageData.items,
      });
    }

    const [peopleAll, postsResult, groupsAll, churchesAll] = await Promise.all([
      usersService.searchUsers(q, req.userId, limit),
      postsService.listPosts({ viewerId: req.userId, q, page: 1, limit, lang }),
      groupsService.listGroups({ userId: req.userId, q }),
      churchesService.listChurches({ userId: req.userId, q }),
    ]);

    const posts = await attachPostScopes(
      postsResult.posts as unknown as Array<Record<string, unknown>>
    );

    return res.json({
      q,
      type,
      page,
      limit,
      counts: {
        people: peopleAll.length,
        posts: postsResult.total,
        groups: groupsAll.length,
        churches: churchesAll.length,
      },
      people: peopleAll,
      posts,
      groups: groupsAll.slice(0, limit),
      churches: churchesAll.slice(0, limit),
    });
  } catch (err) {
    return handleError(res, err);
  }
};
