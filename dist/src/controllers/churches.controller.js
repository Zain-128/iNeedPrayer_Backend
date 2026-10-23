import mongoose from "mongoose";
import * as churchesService from "../services/churches.service.js";
import * as googlePlacesService from "../services/googlePlaces.service.js";
import { paramStr } from "../utils/routeParams.js";
function invalidId(res) {
    return res.status(400).json({ message: "Invalid id" });
}
export const listChurches = async (req, res) => {
    try {
        const filter = typeof req.query.filter === "string" ? req.query.filter : undefined;
        const tab = req.query.tab === "followed"
            ? "followed"
            : req.query.tab === "my"
                ? "my"
                : undefined;
        const churches = await churchesService.listChurches({
            userId: req.userId,
            q: typeof req.query.q === "string" ? req.query.q : undefined,
            filter: filter,
            tab,
        });
        return res.json({ churches });
    }
    catch (err) {
        const e = err;
        return res.status(e.statusCode ?? 500).json({ message: e.message });
    }
};
export const discoverChurches = async (req, res) => {
    try {
        const churches = await churchesService.discoverChurches({
            userId: req.userId,
            q: typeof req.query.q === "string" ? req.query.q : undefined,
        });
        return res.json({ churches });
    }
    catch (err) {
        const e = err;
        return res.status(e.statusCode ?? 500).json({ message: e.message });
    }
};
export const getChurch = async (req, res) => {
    try {
        const id = paramStr(req.params.id);
        if (id === "nearby") {
            return getNearbyChurchesFromGoogle(req, res);
        }
        if (id === "discover") {
            return discoverChurches(req, res);
        }
        if (!mongoose.isValidObjectId(id))
            return invalidId(res);
        const church = await churchesService.getChurch(id, req.userId);
        return res.json({ church });
    }
    catch (err) {
        const e = err;
        return res.status(e.statusCode ?? 500).json({ message: e.message });
    }
};
export const createChurch = async (req, res) => {
    try {
        if (!req.userId)
            return res.status(401).json({ message: "Unauthorized" });
        const result = await churchesService.createChurch(req.userId, req.body ?? {});
        return res.status(201).json(result);
    }
    catch (err) {
        const e = err;
        return res.status(e.statusCode ?? 500).json({ message: e.message });
    }
};
export const updateChurch = async (req, res) => {
    try {
        if (!req.userId)
            return res.status(401).json({ message: "Unauthorized" });
        const id = paramStr(req.params.id);
        if (!mongoose.isValidObjectId(id))
            return invalidId(res);
        const church = await churchesService.updateChurch(id, req.userId, req.body ?? {});
        return res.json({ church });
    }
    catch (err) {
        const e = err;
        return res.status(e.statusCode ?? 500).json({ message: e.message });
    }
};
export const deleteChurch = async (req, res) => {
    try {
        if (!req.userId)
            return res.status(401).json({ message: "Unauthorized" });
        const id = paramStr(req.params.id);
        if (!mongoose.isValidObjectId(id))
            return invalidId(res);
        const result = await churchesService.deleteChurch(id, req.userId);
        return res.json(result);
    }
    catch (err) {
        const e = err;
        return res.status(e.statusCode ?? 500).json({ message: e.message });
    }
};
export const followChurch = async (req, res) => {
    try {
        if (!req.userId)
            return res.status(401).json({ message: "Unauthorized" });
        const id = paramStr(req.params.id);
        if (!mongoose.isValidObjectId(id))
            return invalidId(res);
        const result = await churchesService.toggleFollowChurch(req.userId, id);
        return res.json(result);
    }
    catch (err) {
        const e = err;
        return res.status(e.statusCode ?? 500).json({ message: e.message });
    }
};
export const sendVerification = async (req, res) => {
    try {
        if (!req.userId)
            return res.status(401).json({ message: "Unauthorized" });
        const id = paramStr(req.params.id);
        if (!mongoose.isValidObjectId(id))
            return invalidId(res);
        const result = await churchesService.sendChurchVerification(id, req.userId);
        return res.json(result);
    }
    catch (err) {
        const e = err;
        return res.status(e.statusCode ?? 500).json({ message: e.message });
    }
};
export const verifyChurch = async (req, res) => {
    try {
        const id = paramStr(req.params.id);
        if (!mongoose.isValidObjectId(id))
            return invalidId(res);
        const { code } = req.body ?? {};
        const result = await churchesService.verifyChurch(id, String(code ?? ""), req.userId);
        return res.json(result);
    }
    catch (err) {
        const e = err;
        return res.status(e.statusCode ?? 500).json({ message: e.message });
    }
};
export const listMembers = async (req, res) => {
    try {
        if (!req.userId)
            return res.status(401).json({ message: "Unauthorized" });
        const id = paramStr(req.params.id);
        if (!mongoose.isValidObjectId(id))
            return invalidId(res);
        const members = await churchesService.listChurchMembers(id, req.userId);
        return res.json({ members });
    }
    catch (err) {
        const e = err;
        return res.status(e.statusCode ?? 500).json({ message: e.message });
    }
};
export const addMember = async (req, res) => {
    try {
        if (!req.userId)
            return res.status(401).json({ message: "Unauthorized" });
        const id = paramStr(req.params.id);
        if (!mongoose.isValidObjectId(id))
            return invalidId(res);
        const result = await churchesService.addChurchMember(id, req.userId, req.body ?? {});
        return res.status(201).json(result);
    }
    catch (err) {
        const e = err;
        return res.status(e.statusCode ?? 500).json({ message: e.message });
    }
};
export const removeMember = async (req, res) => {
    try {
        if (!req.userId)
            return res.status(401).json({ message: "Unauthorized" });
        const id = paramStr(req.params.id);
        const userId = paramStr(req.params.userId);
        if (!mongoose.isValidObjectId(id) || !mongoose.isValidObjectId(userId)) {
            return invalidId(res);
        }
        const result = await churchesService.removeChurchMember(id, req.userId, userId);
        return res.json(result);
    }
    catch (err) {
        const e = err;
        return res.status(e.statusCode ?? 500).json({ message: e.message });
    }
};
export const updateMemberRole = async (req, res) => {
    try {
        if (!req.userId)
            return res.status(401).json({ message: "Unauthorized" });
        const id = paramStr(req.params.id);
        const userId = paramStr(req.params.userId);
        if (!mongoose.isValidObjectId(id) || !mongoose.isValidObjectId(userId)) {
            return invalidId(res);
        }
        const { role } = req.body ?? {};
        const result = await churchesService.updateChurchMemberRole(id, req.userId, userId, role);
        return res.json(result);
    }
    catch (err) {
        const e = err;
        return res.status(e.statusCode ?? 500).json({ message: e.message });
    }
};

export const getNearbyChurchesFromGoogle = async (req, res) => {
    try {
        const query = req.query;
        const body = req.body || {};
        const rawLat = query.latitude ?? query.lat ?? body.latitude ?? body.lat;
        const rawLng = query.longitude ?? query.lng ?? query.lon ?? body.longitude ?? body.lng ?? body.lon;
        if (rawLat === undefined || rawLng === undefined) {
            return res.status(400).json({
                success: false,
                message: "Both latitude and longitude are required. Example: ?latitude=40.7128&longitude=-74.0060",
            });
        }
        const latitude = parseFloat(String(rawLat));
        const longitude = parseFloat(String(rawLng));
        if (isNaN(latitude) || isNaN(longitude) || latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
            return res.status(400).json({
                success: false,
                message: "Invalid coordinates. Latitude must be between -90 and 90, and longitude between -180 and 180.",
            });
        }
        const rawRadius = query.radius ?? body.radius;
        let radius = rawRadius !== undefined ? parseFloat(String(rawRadius)) : 10000;
        if (radius > 0 && radius <= 50) {
            radius = radius * 1000;
        }
        const q = typeof query.q === "string" ? query.q : typeof query.query === "string" ? query.query : typeof body.query === "string" ? body.query : typeof body.q === "string" ? body.q : undefined;
        const rawLimit = query.limit ?? body.limit;
        const limit = rawLimit ? parseInt(String(rawLimit), 10) : 20;
        const rankBy = query.rankBy || query.rankPreference || body.rankBy || body.rankPreference;
        const rankPreference = String(rankBy).toLowerCase() === "distance" ? "DISTANCE" : "POPULARITY";
        const lang = typeof query.lang === "string" ? query.lang : typeof body.lang === "string" ? body.lang : undefined;
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
    }
    catch (err) {
        const e = err;
        return res.status(e.statusCode ?? 500).json({
            success: false,
            message: e.message || "Failed to fetch nearby churches",
            ...(e.details ? { details: e.details } : {}),
        });
    }
};

export const getGooglePlacePhoto = async (req, res) => {
    try {
        const photoRef = typeof req.query.photoRef === "string" ? req.query.photoRef : typeof req.query.photoReference === "string" ? req.query.photoReference : typeof req.query.name === "string" ? req.query.name : undefined;
        if (!photoRef) {
            return res.status(400).json({
                success: false,
                message: "photoRef is required. Example: ?photoRef=places/ChIJ.../photos/...",
            });
        }
        const maxWidth = req.query.maxWidth ? parseInt(String(req.query.maxWidth), 10) : 800;
        const maxHeight = req.query.maxHeight ? parseInt(String(req.query.maxHeight), 10) : 600;
        const photoUri = await googlePlacesService.getGooglePlacePhotoUrl(photoRef, maxWidth, maxHeight);
        res.setHeader("Cache-Control", "public, max-age=86400");
        return res.redirect(photoUri);
    }
    catch (err) {
        const e = err;
        return res.status(e.statusCode ?? 500).json({
            success: false,
            message: e.message || "Failed to load place photo",
        });
    }
};

export const getGooglePlaceDetails = async (req, res) => {
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
    }
    catch (err) {
        const e = err;
        return res.status(e.statusCode ?? 500).json({
            success: false,
            message: e.message || "Failed to fetch place details",
        });
    }
};

