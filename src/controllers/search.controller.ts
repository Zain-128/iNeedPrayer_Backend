import type { Response } from "express";
import type { AuthRequest } from "../middleware/auth.middleware.js";
import * as searchService from "../services/search.service.js";

const SEARCH_TYPES = new Set([
  "all",
  "posts",
  "prayers",
  "praises",
  "people",
  "groups",
  "churches",
]);

function handleError(res: Response, err: unknown) {
  const e = err as { statusCode?: number; message?: string };
  return res.status(e.statusCode ?? 500).json({ message: e.message });
}

/** GET /api/search?q=&type=all|posts|prayers|praises|people|groups|churches&page=&limit= */
export const search = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.userId) return res.status(401).json({ message: "Unauthorized" });

    const typeRaw = String(req.query.type ?? "all").toLowerCase();
    const type = SEARCH_TYPES.has(typeRaw)
      ? (typeRaw as any)
      : "all";

    const result = await searchService.searchAll({
      q: String(req.query.q ?? ""),
      type,
      page: Number(req.query.page) || 1,
      limit: Number(req.query.limit) || 10,
      currentUserId: req.userId,
    });

    return res.json(result);
  } catch (err) {
    return handleError(res, err);
  }
};
