import { Response, Request } from "express";
import mongoose from "mongoose";
import { AuthRequest } from "../middleware/auth.middleware.js";
import * as churchesService from "../services/churches.service.js";
import * as googlePlacesService from "../services/googlePlaces.service.js";
import { paramStr } from "../utils/routeParams.js";

function invalidId(res: Response) {
  return res.status(400).json({ message: "Invalid id" });
}

export const listChurches = async (req: AuthRequest, res: Response) => {
  try {
    const filter = typeof req.query.filter === "string" ? req.query.filter : undefined;
    const tab =
      req.query.tab === "followed"
        ? "followed"
        : req.query.tab === "my"
          ? "my"
          : undefined;
    const churches = await churchesService.listChurches({
      userId: req.userId,
      q: typeof req.query.q === "string" ? req.query.q : undefined,
      filter: filter as churchesService.ChurchFilter | undefined,
      tab,
    });
    return res.json({ churches });
  } catch (err) {
    const e = err as Error & { statusCode?: number };
    return res.status(e.statusCode ?? 500).json({ message: e.message });
  }
};

export const discoverChurches = async (req: AuthRequest, res: Response) => {
  try {
    const churches = await churchesService.discoverChurches({
      userId: req.userId,
      q: typeof req.query.q === "string" ? req.query.q : undefined,
    });
    return res.json({ churches });
  } catch (err) {
    const e = err as Error & { statusCode?: number };
    return res.status(e.statusCode ?? 500).json({ message: e.message });
  }
};

export const getChurch = async (req: AuthRequest, res: Response) => {
  try {
    const id = paramStr(req.params.id);
    if (id === "nearby") {
      return getNearbyChurchesFromGoogle(req, res);
    }
    if (id === "discover") {
      return discoverChurches(req, res);
    }
    if (!mongoose.isValidObjectId(id)) return invalidId(res);
    const church = await churchesService.getChurch(id, req.userId);
    return res.json({ church });
  } catch (err) {
    const e = err as Error & { statusCode?: number };
    return res.status(e.statusCode ?? 500).json({ message: e.message });
  }
};

export const createChurch = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.userId) return res.status(401).json({ message: "Unauthorized" });
    const result = await churchesService.createChurch(req.userId, req.body ?? {});
    return res.status(201).json(result);
  } catch (err) {
    const e = err as Error & { statusCode?: number };
    return res.status(e.statusCode ?? 500).json({ message: e.message });
  }
};

export const updateChurch = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.userId) return res.status(401).json({ message: "Unauthorized" });
    const id = paramStr(req.params.id);
    if (!mongoose.isValidObjectId(id)) return invalidId(res);
    const church = await churchesService.updateChurch(id, req.userId, req.body ?? {});
    return res.json({ church });
  } catch (err) {
    const e = err as Error & { statusCode?: number };
    return res.status(e.statusCode ?? 500).json({ message: e.message });
  }
};

export const deleteChurch = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.userId) return res.status(401).json({ message: "Unauthorized" });
    const id = paramStr(req.params.id);
    if (!mongoose.isValidObjectId(id)) return invalidId(res);
    const result = await churchesService.deleteChurch(id, req.userId);
    return res.json(result);
  } catch (err) {
    const e = err as Error & { statusCode?: number };
    return res.status(e.statusCode ?? 500).json({ message: e.message });
  }
};

export const followChurch = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.userId) return res.status(401).json({ message: "Unauthorized" });
    const id = paramStr(req.params.id);
    if (!mongoose.isValidObjectId(id)) return invalidId(res);
    const result = await churchesService.toggleFollowChurch(req.userId, id);
    return res.json(result);
  } catch (err) {
    const e = err as Error & { statusCode?: number };
    return res.status(e.statusCode ?? 500).json({ message: e.message });
  }
};

export const sendVerification = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.userId) return res.status(401).json({ message: "Unauthorized" });
    const id = paramStr(req.params.id);
    if (!mongoose.isValidObjectId(id)) return invalidId(res);
    const result = await churchesService.sendChurchVerification(id, req.userId);
    return res.json(result);
  } catch (err) {
    const e = err as Error & { statusCode?: number };
    return res.status(e.statusCode ?? 500).json({ message: e.message });
  }
};

export const verifyChurch = async (req: AuthRequest, res: Response) => {
  try {
    const id = paramStr(req.params.id);
    if (!mongoose.isValidObjectId(id)) return invalidId(res);
    const { code } = req.body ?? {};
    const result = await churchesService.verifyChurch(
      id,
      String(code ?? ""),
      req.userId
    );
    return res.json(result);
  } catch (err) {
    const e = err as Error & { statusCode?: number };
    return res.status(e.statusCode ?? 500).json({ message: e.message });
  }
};

export const listMembers = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.userId) return res.status(401).json({ message: "Unauthorized" });
    const id = paramStr(req.params.id);
    if (!mongoose.isValidObjectId(id)) return invalidId(res);
    const members = await churchesService.listChurchMembers(id, req.userId);
    return res.json({ members });
  } catch (err) {
    const e = err as Error & { statusCode?: number };
    return res.status(e.statusCode ?? 500).json({ message: e.message });
  }
};

export const addMember = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.userId) return res.status(401).json({ message: "Unauthorized" });
    const id = paramStr(req.params.id);
    if (!mongoose.isValidObjectId(id)) return invalidId(res);
    const result = await churchesService.addChurchMember(id, req.userId, req.body ?? {});
    return res.status(201).json(result);
  } catch (err) {
    const e = err as Error & { statusCode?: number };
    return res.status(e.statusCode ?? 500).json({ message: e.message });
  }
};

export const removeMember = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.userId) return res.status(401).json({ message: "Unauthorized" });
    const id = paramStr(req.params.id);
    const userId = paramStr(req.params.userId);
    if (!mongoose.isValidObjectId(id) || !mongoose.isValidObjectId(userId)) {
      return invalidId(res);
    }
    const result = await churchesService.removeChurchMember(id, req.userId, userId);
    return res.json(result);
  } catch (err) {
    const e = err as Error & { statusCode?: number };
    return res.status(e.statusCode ?? 500).json({ message: e.message });
  }
};

export const updateMemberRole = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.userId) return res.status(401).json({ message: "Unauthorized" });
    const id = paramStr(req.params.id);
    const userId = paramStr(req.params.userId);
    if (!mongoose.isValidObjectId(id) || !mongoose.isValidObjectId(userId)) {
      return invalidId(res);
    }
    const { role } = req.body ?? {};
    const result = await churchesService.updateChurchMemberRole(
      id,
      req.userId,
      userId,
      role
    );
    return res.json(result);
  } catch (err) {
    const e = err as Error & { statusCode?: number };
    return res.status(e.statusCode ?? 500).json({ message: e.message });
  }
};

export const inviteFollowers = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.userId) return res.status(401).json({ message: "Unauthorized" });
    const churchId = paramStr(req.params.churchId || req.params.id);
    if (!mongoose.isValidObjectId(churchId)) return invalidId(res);

    const { userIds, emails } = req.body ?? {};
    const ids = Array.isArray(userIds)
      ? userIds.filter((x: unknown) => typeof x === "string")
      : typeof req.body.userId === "string"
      ? [req.body.userId]
      : [];
    const mail = Array.isArray(emails)
      ? emails.filter((x: unknown) => typeof x === "string")
      : [];

    const result = await churchesService.inviteUsersToChurch(
      churchId,
      req.userId,
      { userIds: ids, emails: mail }
    );
    return res.json(result);
  } catch (err) {
    const e = err as Error & { statusCode?: number };
    return res.status(e.statusCode ?? 500).json({ message: e.message });
  }
};

export const listInvites = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.userId) return res.status(401).json({ message: "Unauthorized" });
    const churchId = paramStr(req.params.churchId || req.params.id);
    if (!mongoose.isValidObjectId(churchId)) return invalidId(res);

    const raw = typeof req.query.status === "string" ? req.query.status : "all";
    const status =
      raw === "pending" ||
      raw === "accepted" ||
      raw === "rejected" ||
      raw === "all"
        ? raw
        : "all";

    const invites = await churchesService.listChurchInvites(
      churchId,
      req.userId,
      status
    );
    return res.json({ invites });
  } catch (err) {
    const e = err as Error & { statusCode?: number };
    return res.status(e.statusCode ?? 500).json({ message: e.message });
  }
};

export const cancelInvite = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.userId) return res.status(401).json({ message: "Unauthorized" });
    const churchId = paramStr(req.params.churchId || req.params.id);
    const userId = paramStr(req.params.userId);
    if (!mongoose.isValidObjectId(churchId) || !mongoose.isValidObjectId(userId)) {
      return invalidId(res);
    }
    const result = await churchesService.cancelChurchInvite(
      churchId,
      req.userId,
      userId
    );
    return res.json(result);
  } catch (err) {
    const e = err as Error & { statusCode?: number };
    return res.status(e.statusCode ?? 500).json({ message: e.message });
  }
};

export const acceptInvite = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.userId) return res.status(401).json({ message: "Unauthorized" });
    const churchId = paramStr(req.params.churchId || req.params.id);
    if (!mongoose.isValidObjectId(churchId)) return invalidId(res);

    const result = await churchesService.acceptChurchInvite(churchId, req.userId);
    return res.json(result);
  } catch (err) {
    const e = err as Error & { statusCode?: number };
    return res.status(e.statusCode ?? 500).json({ message: e.message });
  }
};

export const declineInvite = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.userId) return res.status(401).json({ message: "Unauthorized" });
    const churchId = paramStr(req.params.churchId || req.params.id);
    if (!mongoose.isValidObjectId(churchId)) return invalidId(res);

    const result = await churchesService.declineChurchInvite(churchId, req.userId);
    return res.json(result);
  } catch (err) {
    const e = err as Error & { statusCode?: number };
    return res.status(e.statusCode ?? 500).json({ message: e.message });
  }
};

/**
 * Search nearby churches using Google Places API (New)
 * Supports both GET (query parameters) and POST (JSON body)
 *
 * Parameters:
 * - latitude / lat: number (-90 to 90) [Required]
 * - longitude / lng / lon: number (-180 to 180) [Required]
 * - radius: number in meters (default: 5000, max: 50000)
 * - q / query: optional text query for searching specific church names
 * - limit: number of results (1-20, default: 20)
 * - rankBy: "popularity" | "distance" (default: "popularity")
 */
export const getNearbyChurchesFromGoogle = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    const query = req.query as Record<string, string | undefined>;
    const body = (req.body || {}) as Record<string, unknown>;

    // Support both GET query params and POST body
    const rawLat = query.latitude ?? query.lat ?? body.latitude ?? body.lat;
    const rawLng =
      query.longitude ??
      query.lng ??
      query.lon ??
      body.longitude ??
      body.lng ??
      body.lon;

    if (rawLat === undefined || rawLng === undefined) {
      return res.status(400).json({
        success: false,
        message:
          "Both latitude and longitude are required. Example: ?latitude=40.7128&longitude=-74.0060",
      });
    }

    const latitude = parseFloat(String(rawLat));
    const longitude = parseFloat(String(rawLng));

    if (
      isNaN(latitude) ||
      isNaN(longitude) ||
      latitude < -90 ||
      latitude > 90 ||
      longitude < -180 ||
      longitude > 180
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Invalid coordinates. Latitude must be between -90 and 90, and longitude between -180 and 180.",
      });
    }

    const rawRadius = query.radius ?? body.radius;
    let radius = rawRadius !== undefined ? parseFloat(String(rawRadius)) : 10000;

    // If client sent radius in km (<= 50), auto-convert to meters
    if (radius > 0 && radius <= 50) {
      radius = radius * 1000;
    }

    const q =
      typeof query.q === "string"
        ? query.q
        : typeof query.query === "string"
          ? query.query
          : typeof body.query === "string"
            ? body.query
            : typeof body.q === "string"
              ? body.q
              : undefined;

    const rawLimit = query.limit ?? body.limit;
    const limit = rawLimit ? parseInt(String(rawLimit), 10) : 20;

    const rankBy =
      query.rankBy ||
      query.rankPreference ||
      body.rankBy ||
      body.rankPreference;
    const rankPreference =
      String(rankBy).toLowerCase() === "distance" ? "DISTANCE" : "POPULARITY";

    const lang =
      typeof query.lang === "string"
        ? query.lang
        : typeof body.lang === "string"
          ? body.lang
          : undefined;

    const result = await googlePlacesService.searchNearbyChurches({
      latitude,
      longitude,
      radius,
      query: q,
      limit,
      rankPreference,
      languageCode: lang,
    });

    return res.json({
      success: true,
      count: result.count,
      center: result.center,
      radius: result.radius,
      cached: !!result.cached,
      source: result.source || "google",
      churches: result.churches,
      data: result.churches,
    });
  } catch (err) {
    const e = err as Error & { statusCode?: number; details?: unknown };
    return res.status(e.statusCode ?? 500).json({
      success: false,
      message: e.message || "Failed to fetch nearby churches",
      ...(e.details ? { details: e.details } : {}),
    });
  }
};

/**
 * Google Places Photo Proxy
 * Securely redirects to CDN photo without exposing backend API key
 *
 * Query params:
 * - photoRef (or photoReference / name): Google Places photo resource name
 * - maxWidth: optional (default: 800)
 * - maxHeight: optional (default: 600)
 */
export const getGooglePlacePhoto = async (req: Request, res: Response) => {
  try {
    const photoRef =
      typeof req.query.photoRef === "string"
        ? req.query.photoRef
        : typeof req.query.photoReference === "string"
          ? req.query.photoReference
          : typeof req.query.name === "string"
            ? req.query.name
            : undefined;

    if (!photoRef) {
      return res.status(400).json({
        success: false,
        message: "photoRef is required. Example: ?photoRef=places/ChIJ.../photos/...",
      });
    }

    const maxWidth = req.query.maxWidth ? parseInt(String(req.query.maxWidth), 10) : 800;
    const maxHeight = req.query.maxHeight ? parseInt(String(req.query.maxHeight), 10) : 600;

    const photoUri = await googlePlacesService.getGooglePlacePhotoUrl(
      photoRef,
      maxWidth,
      maxHeight
    );

    // Cache on client and CDN for 24 hours
    res.setHeader("Cache-Control", "public, max-age=86400");
    return res.redirect(photoUri);
  } catch (err) {
    const e = err as Error & { statusCode?: number };
    return res.status(e.statusCode ?? 500).json({
      success: false,
      message: e.message || "Failed to load place photo",
    });
  }
};

/**
 * Fetch detailed place info for a single church
 */
export const getGooglePlaceDetails = async (req: Request, res: Response) => {
  try {
    const placeId = paramStr(req.params.placeId) || (typeof req.query.placeId === "string" ? req.query.placeId : "");
    if (!placeId) {
      return res.status(400).json({ success: false, message: "placeId is required" });
    }

    const lang = typeof req.query.lang === "string" ? req.query.lang : undefined;
    const place = await googlePlacesService.getGooglePlaceDetails(placeId, lang);

    return res.json({
      success: true,
      place,
    });
  } catch (err) {
    const e = err as Error & { statusCode?: number };
    return res.status(e.statusCode ?? 500).json({
      success: false,
      message: e.message || "Failed to fetch place details",
    });
  }
};

export const getPermissions = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.userId) return res.status(401).json({ message: "Unauthorized" });
    const churchId = paramStr(req.params.id || req.params.churchId);
    if (!mongoose.isValidObjectId(churchId)) return invalidId(res);
    const result = await churchesService.getUserChurchPermissions(churchId, req.userId);
    return res.json(result);
  } catch (err) {
    const e = err as Error & { statusCode?: number };
    return res.status(e.statusCode ?? 500).json({ message: e.message });
  }
};

export const getRoleLimits = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.userId) return res.status(401).json({ message: "Unauthorized" });
    const churchId = paramStr(req.params.id || req.params.churchId);
    if (!mongoose.isValidObjectId(churchId)) return invalidId(res);
    const result = await churchesService.getChurchRoleLimits(churchId, req.userId);
    return res.json(result);
  } catch (err) {
    const e = err as Error & { statusCode?: number };
    return res.status(e.statusCode ?? 500).json({ message: e.message });
  }
};

export const listStaff = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.userId) return res.status(401).json({ message: "Unauthorized" });
    const churchId = paramStr(req.params.id || req.params.churchId);
    if (!mongoose.isValidObjectId(churchId)) return invalidId(res);
    const result = await churchesService.listChurchStaff(churchId, req.userId);
    return res.json(result);
  } catch (err) {
    const e = err as Error & { statusCode?: number };
    return res.status(e.statusCode ?? 500).json({ message: e.message });
  }
};

export const addStaff = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.userId) return res.status(401).json({ message: "Unauthorized" });
    const churchId = paramStr(req.params.id || req.params.churchId);
    if (!mongoose.isValidObjectId(churchId)) return invalidId(res);
    const result = await churchesService.addChurchStaff(churchId, req.userId, req.body ?? {});
    return res.status(201).json(result);
  } catch (err) {
    const e = err as Error & { statusCode?: number };
    return res.status(e.statusCode ?? 500).json({ message: e.message });
  }
};

export const updateStaffRole = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.userId) return res.status(401).json({ message: "Unauthorized" });
    const churchId = paramStr(req.params.id || req.params.churchId);
    const userId = paramStr(req.params.userId);
    if (!mongoose.isValidObjectId(churchId) || !mongoose.isValidObjectId(userId)) return invalidId(res);
    const result = await churchesService.updateChurchStaffRole(
      churchId,
      req.userId,
      userId,
      req.body?.role
    );
    return res.json(result);
  } catch (err) {
    const e = err as Error & { statusCode?: number };
    return res.status(e.statusCode ?? 500).json({ message: e.message });
  }
};

export const removeStaff = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.userId) return res.status(401).json({ message: "Unauthorized" });
    const churchId = paramStr(req.params.id || req.params.churchId);
    const userId = paramStr(req.params.userId);
    if (!mongoose.isValidObjectId(churchId) || !mongoose.isValidObjectId(userId)) return invalidId(res);
    const result = await churchesService.removeChurchStaff(churchId, req.userId, userId);
    return res.json(result);
  } catch (err) {
    const e = err as Error & { statusCode?: number };
    return res.status(e.statusCode ?? 500).json({ message: e.message });
  }
};

export const unfollowChurch = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.userId) return res.status(401).json({ message: "Unauthorized" });
    const churchId = paramStr(req.params.id || req.params.churchId);
    if (!mongoose.isValidObjectId(churchId)) return invalidId(res);
    const result = await churchesService.unfollowChurch(req.userId, churchId);
    return res.json(result);
  } catch (err) {
    const e = err as Error & { statusCode?: number };
    return res.status(e.statusCode ?? 500).json({ message: e.message });
  }
};

export const listInviteCandidates = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.userId) return res.status(401).json({ message: "Unauthorized" });
    const churchId = paramStr(req.params.id || req.params.churchId);
    if (!mongoose.isValidObjectId(churchId)) return invalidId(res);
    const q = typeof req.query.q === "string" ? req.query.q : undefined;
    const result = await churchesService.listChurchInviteCandidates(churchId, req.userId, q);
    return res.json(result);
  } catch (err) {
    const e = err as Error & { statusCode?: number };
    return res.status(e.statusCode ?? 500).json({ message: e.message });
  }
};

export const listSentFollowInvites = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.userId) return res.status(401).json({ message: "Unauthorized" });
    const churchId = paramStr(req.params.id || req.params.churchId);
    if (!mongoose.isValidObjectId(churchId)) return invalidId(res);
    const status = typeof req.query.status === "string" ? req.query.status : "all";
    const result = await churchesService.listSentChurchFollowInvites(churchId, req.userId, status);
    return res.json(result);
  } catch (err) {
    const e = err as Error & { statusCode?: number };
    return res.status(e.statusCode ?? 500).json({ message: e.message });
  }
};

export const listReceivedFollowInvites = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.userId) return res.status(401).json({ message: "Unauthorized" });
    const result = await churchesService.listReceivedChurchFollowInvites(req.userId);
    return res.json(result);
  } catch (err) {
    const e = err as Error & { statusCode?: number };
    return res.status(e.statusCode ?? 500).json({ message: e.message });
  }
};

export const acceptFollowInvite = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.userId) return res.status(401).json({ message: "Unauthorized" });
    const paramId = paramStr(req.params.id || req.params.churchId || req.params.inviteId);
    const explicitInviteId = paramStr(req.params.inviteId);
    const result = await churchesService.acceptChurchFollowInvite(paramId, req.userId, explicitInviteId);
    return res.json(result);
  } catch (err) {
    const e = err as Error & { statusCode?: number };
    return res.status(e.statusCode ?? 500).json({ message: e.message });
  }
};

export const declineFollowInvite = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.userId) return res.status(401).json({ message: "Unauthorized" });
    const paramId = paramStr(req.params.id || req.params.churchId || req.params.inviteId);
    const explicitInviteId = paramStr(req.params.inviteId);
    const result = await churchesService.declineChurchFollowInvite(paramId, req.userId, explicitInviteId);
    return res.json(result);
  } catch (err) {
    const e = err as Error & { statusCode?: number };
    return res.status(e.statusCode ?? 500).json({ message: e.message });
  }
};

export const cancelFollowInvite = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.userId) return res.status(401).json({ message: "Unauthorized" });
    const paramId = paramStr(req.params.id || req.params.churchId || req.params.inviteId);
    const explicitInviteId = paramStr(req.params.inviteId);
    const result = await churchesService.cancelChurchFollowInvite(paramId, req.userId, explicitInviteId);
    return res.json(result);
  } catch (err) {
    const e = err as Error & { statusCode?: number };
    return res.status(e.statusCode ?? 500).json({ message: e.message });
  }
};

export const resendFollowInvite = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.userId) return res.status(401).json({ message: "Unauthorized" });
    const paramId = paramStr(req.params.id || req.params.churchId || req.params.inviteId);
    const explicitInviteId = paramStr(req.params.inviteId);
    const result = await churchesService.resendChurchFollowInvite(paramId, req.userId, explicitInviteId);
    return res.json(result);
  } catch (err) {
    const e = err as Error & { statusCode?: number };
    return res.status(e.statusCode ?? 500).json({ message: e.message });
  }
};

export const listEvents = async (req: Request, res: Response) => {
  try {
    const churchId = paramStr(req.params.id || req.params.churchId);
    if (!mongoose.isValidObjectId(churchId)) return invalidId(res);
    const filter = typeof req.query.filter === "string" ? req.query.filter : undefined;
    const status = typeof req.query.status === "string" ? req.query.status : undefined;
    const limit = req.query.limit ? parseInt(String(req.query.limit), 10) : undefined;
    const page = req.query.page ? parseInt(String(req.query.page), 10) : undefined;
    const result = await churchesService.listChurchEvents(churchId, { filter, status, limit, page });
    return res.json(result);
  } catch (err) {
    const e = err as Error & { statusCode?: number };
    return res.status(e.statusCode ?? 500).json({ message: e.message });
  }
};

export const getEvent = async (req: Request, res: Response) => {
  try {
    const churchId = paramStr(req.params.id || req.params.churchId);
    const eventId = paramStr(req.params.eventId);
    if (!mongoose.isValidObjectId(churchId) || !mongoose.isValidObjectId(eventId)) return invalidId(res);
    const result = await churchesService.getChurchEvent(churchId, eventId);
    return res.json(result);
  } catch (err) {
    const e = err as Error & { statusCode?: number };
    return res.status(e.statusCode ?? 500).json({ message: e.message });
  }
};

export const createEvent = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.userId) return res.status(401).json({ message: "Unauthorized" });
    const churchId = paramStr(req.params.id || req.params.churchId);
    if (!mongoose.isValidObjectId(churchId)) return invalidId(res);
    const result = await churchesService.createChurchEvent(churchId, req.userId, req.body ?? {});
    return res.status(201).json(result);
  } catch (err) {
    const e = err as Error & { statusCode?: number };
    return res.status(e.statusCode ?? 500).json({ message: e.message });
  }
};

export const updateEvent = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.userId) return res.status(401).json({ message: "Unauthorized" });
    const churchId = paramStr(req.params.id || req.params.churchId);
    const eventId = paramStr(req.params.eventId);
    if (!mongoose.isValidObjectId(churchId) || !mongoose.isValidObjectId(eventId)) return invalidId(res);
    const result = await churchesService.updateChurchEvent(churchId, eventId, req.userId, req.body ?? {});
    return res.json(result);
  } catch (err) {
    const e = err as Error & { statusCode?: number };
    return res.status(e.statusCode ?? 500).json({ message: e.message });
  }
};

export const deleteEvent = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.userId) return res.status(401).json({ message: "Unauthorized" });
    const churchId = paramStr(req.params.id || req.params.churchId);
    const eventId = paramStr(req.params.eventId);
    if (!mongoose.isValidObjectId(churchId) || !mongoose.isValidObjectId(eventId)) return invalidId(res);
    const result = await churchesService.deleteChurchEvent(churchId, eventId, req.userId);
    return res.json(result);
  } catch (err) {
    const e = err as Error & { statusCode?: number };
    return res.status(e.statusCode ?? 500).json({ message: e.message });
  }
};

export const getLiveSettings = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.userId) return res.status(401).json({ message: "Unauthorized" });
    const churchId = paramStr(req.params.id || req.params.churchId);
    if (!mongoose.isValidObjectId(churchId)) return invalidId(res);
    const result = await churchesService.getLiveStreamSettings("church", churchId, req.userId);
    return res.json(result);
  } catch (err) {
    const e = err as Error & { statusCode?: number };
    return res.status(e.statusCode ?? 500).json({ message: e.message });
  }
};

export const updateLiveSettings = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.userId) return res.status(401).json({ message: "Unauthorized" });
    const churchId = paramStr(req.params.id || req.params.churchId);
    if (!mongoose.isValidObjectId(churchId)) return invalidId(res);
    const result = await churchesService.updateLiveStreamSettings(
      "church",
      churchId,
      req.userId,
      req.body ?? {}
    );
    return res.json(result);
  } catch (err) {
    const e = err as Error & { statusCode?: number };
    return res.status(e.statusCode ?? 500).json({ message: e.message });
  }
};

