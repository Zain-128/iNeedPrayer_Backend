import { GOOGLE_PLACES_API_KEY, PUBLIC_BASE_URL } from "../contants.js";
import { ChurchPlacesCache } from "../models/churchPlacesCache.model.js";

export interface Coordinates {
  latitude: number;
  longitude: number;
}

export interface NearbyChurchesQuery {
  latitude: number;
  longitude: number;
  radius?: number; // in meters (default: 10000 [10 KM], max: 50000)
  query?: string; // optional search keyword/text (e.g. "Grace", "Baptist")
  limit?: number; // max results 1-20 (default 20)
  rankPreference?: "POPULARITY" | "DISTANCE";
  languageCode?: string;
}

export interface ChurchPlacePhoto {
  name: string;
  widthPx?: number;
  heightPx?: number;
  url?: string;
  proxyUrl?: string;
}

export interface ChurchPlaceItem {
  placeId: string;
  name: string;
  address: string;
  coordinates: Coordinates;
  location: Coordinates; // alias for coordinates for easy MapView integration
  distanceMeters: number;
  distanceFormatted: string;
  rating?: number | null;
  userRatingCount?: number;
  types?: string[];
  primaryType?: string;
  phoneNumber?: string;
  website?: string;
  googleMapsUri?: string;
  photos?: ChurchPlacePhoto[];
  coverPhotoUrl?: string;
}

export interface NearbyChurchesResult {
  center: Coordinates;
  radius: number;
  count: number;
  churches: ChurchPlaceItem[];
  data: ChurchPlaceItem[]; // alias for churches
  cached?: boolean;
  source?: "cache" | "google";
}

/** In-memory L1 cache for places search results (2 hour TTL) */
interface CacheEntry {
  expiresAt: number;
  center: Coordinates;
  radius: number;
  query: string;
  data: NearbyChurchesResult;
}

const placesCache = new Map<string, CacheEntry>();

/** Clean expired L1 cache items every 15 minutes */
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of placesCache.entries()) {
    if (entry.expiresAt <= now) {
      placesCache.delete(key);
    }
  }
}, 15 * 60 * 1000).unref();

/**
 * Calculates straight-line distance in meters using Haversine formula
 */
export function calculateDistanceMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371e3; // Earth radius in meters
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
}

/** Formats distance for display (e.g. "450 m" or "2.3 km") */
export function formatDistance(meters: number): string {
  if (meters < 1000) {
    return `${meters} m`;
  }
  return `${(meters / 1000).toFixed(1)} km`;
}

/**
 * Generates backend proxy URL for a Google Places photo
 * Keeps the Google Places API key secure on the backend
 */
function buildPhotoProxyUrl(photoName: string, maxWidth = 800, maxHeight = 600): string {
  const base = PUBLIC_BASE_URL || "";
  return `${base}/api/churches/places/photo?photoRef=${encodeURIComponent(photoName)}&maxWidth=${maxWidth}&maxHeight=${maxHeight}`;
}

/**
 * Transforms raw Google Places API (New) item into clean ChurchPlaceItem
 */
function transformGooglePlace(
  p: any,
  centerLat: number,
  centerLng: number
): ChurchPlaceItem {
  const placeId: string = p.id || "";
  const name: string = p.displayName?.text || "";
  const address: string = p.formattedAddress || "";
  const latitude: number = Number(p.location?.latitude || 0);
  const longitude: number = Number(p.location?.longitude || 0);

  const distanceMeters = calculateDistanceMeters(centerLat, centerLng, latitude, longitude);
  const distanceFormatted = formatDistance(distanceMeters);

  const rawPhotos: any[] = Array.isArray(p.photos) ? p.photos : [];
  const photos: ChurchPlacePhoto[] = rawPhotos.map((photo: any) => ({
    name: photo.name,
    widthPx: photo.widthPx,
    heightPx: photo.heightPx,
    proxyUrl: photo.name ? buildPhotoProxyUrl(photo.name) : undefined,
  }));

  const coverPhotoUrl = photos[0]?.proxyUrl;

  return {
    placeId,
    name,
    address,
    coordinates: { latitude, longitude },
    location: { latitude, longitude },
    distanceMeters,
    distanceFormatted,
    rating: typeof p.rating === "number" ? p.rating : null,
    userRatingCount: typeof p.userRatingCount === "number" ? p.userRatingCount : 0,
    types: Array.isArray(p.types) ? p.types : [],
    primaryType: p.primaryType || "church",
    phoneNumber: p.nationalPhoneNumber || p.internationalPhoneNumber || undefined,
    website: p.websiteUri || undefined,
    googleMapsUri: p.googleMapsUri || undefined,
    photos: photos.length > 0 ? photos : undefined,
    coverPhotoUrl,
  };
}

/**
 * Search nearby churches using Google Places API (New) with Location-Based Caching
 *
 * Cost Optimization Strategy:
 * 1. Default search radius is 10 KM (10,000 meters) with up to 20 results.
 * 2. Checks L1 in-memory cache and L2 persistent MongoDB geospatial cache.
 * 3. Proximity Cache Reuse: If a search was already performed within ~1.5 KM
 *    of the user's location with similar radius, cached churches are reused
 *    with distances recalculated to the user's exact position.
 * 4. Google Places API is only called if no cached area covers this location.
 */
export async function searchNearbyChurches(
  opts: NearbyChurchesQuery
): Promise<NearbyChurchesResult> {
  const { latitude, longitude } = opts;

  if (
    typeof latitude !== "number" ||
    typeof longitude !== "number" ||
    isNaN(latitude) ||
    isNaN(longitude) ||
    latitude < -90 ||
    latitude > 90 ||
    longitude < -180 ||
    longitude > 180
  ) {
    const err = new Error(
      "Invalid coordinates. Latitude must be between -90 and 90, Longitude between -180 and 180."
    );
    (err as any).statusCode = 400;
    throw err;
  }

  // Radius handling: default 10,000m (10 KM), clamp between 100m and 50000m (Google max)
  const rawRadius = Number(opts.radius) || 10000;
  const radius = Math.min(50000, Math.max(100, Math.round(rawRadius)));
  const limit = Math.min(20, Math.max(1, Number(opts.limit) || 20));
  const query = opts.query?.trim() || "";
  const rankPreference = opts.rankPreference === "DISTANCE" ? "DISTANCE" : "POPULARITY";

  // 1. Check L1 In-Memory Exact Cache
  const cacheKey = `${latitude.toFixed(3)}:${longitude.toFixed(3)}:${radius}:${query}:${rankPreference}:${limit}`;
  const exactCached = placesCache.get(cacheKey);
  if (exactCached && exactCached.expiresAt > Date.now()) {
    return {
      ...exactCached.data,
      cached: true,
      source: "cache",
    };
  }

  // 2. Check L1 In-Memory Proximity Spatial Cache (~1.5 KM vicinity for 10 KM radius)
  const proximityThreshold = Math.min(2000, Math.max(500, Math.round(radius * 0.15)));
  const now = Date.now();
  for (const entry of placesCache.values()) {
    if (
      entry.expiresAt > now &&
      entry.query.toLowerCase() === query.toLowerCase() &&
      entry.radius >= radius * 0.9
    ) {
      const distFromCacheCenter = calculateDistanceMeters(
        latitude,
        longitude,
        entry.center.latitude,
        entry.center.longitude
      );
      if (distFromCacheCenter <= proximityThreshold) {
        // Reuse cached churches with recalculated distances
        let churches = entry.data.churches.map((c) => {
          const d = calculateDistanceMeters(
            latitude,
            longitude,
            c.coordinates.latitude,
            c.coordinates.longitude
          );
          return {
            ...c,
            distanceMeters: d,
            distanceFormatted: formatDistance(d),
          };
        }).filter((c) => c.distanceMeters <= radius);

        if (rankPreference === "DISTANCE") {
          churches.sort((a, b) => a.distanceMeters - b.distanceMeters);
        }

        const proxResult: NearbyChurchesResult = {
          center: { latitude, longitude },
          radius,
          count: churches.length,
          churches,
          data: churches,
          cached: true,
          source: "cache",
        };

        // Cache this exact key too
        placesCache.set(cacheKey, {
          expiresAt: entry.expiresAt,
          center: { latitude, longitude },
          radius,
          query,
          data: proxResult,
        });

        return proxResult;
      }
    }
  }

  // 3. Check L2 Persistent MongoDB Geospatial Cache
  try {
    const cachedDoc = await ChurchPlacesCache.findOne({
      query: query.toLowerCase().trim(),
      location: {
        $nearSphere: {
          $geometry: {
            type: "Point",
            coordinates: [longitude, latitude],
          },
          $maxDistance: proximityThreshold,
        },
      },
      radius: { $gte: radius * 0.9 },
    }).lean();

    if (
      cachedDoc &&
      Array.isArray(cachedDoc.churches) &&
      cachedDoc.churches.length > 0
    ) {
      let churches = (cachedDoc.churches as ChurchPlaceItem[])
        .map((c) => {
          const d = calculateDistanceMeters(
            latitude,
            longitude,
            c.coordinates.latitude,
            c.coordinates.longitude
          );
          return {
            ...c,
            distanceMeters: d,
            distanceFormatted: formatDistance(d),
          };
        })
        .filter((c) => c.distanceMeters <= radius);

      if (rankPreference === "DISTANCE") {
        churches.sort((a, b) => a.distanceMeters - b.distanceMeters);
      }

      const dbResult: NearbyChurchesResult = {
        center: { latitude, longitude },
        radius,
        count: churches.length,
        churches,
        data: churches,
        cached: true,
        source: "cache",
      };

      // Populate L1 cache for fast subsequent hits
      placesCache.set(cacheKey, {
        expiresAt: Date.now() + 2 * 60 * 60 * 1000, // 2 hours in memory
        center: { latitude, longitude },
        radius,
        query,
        data: dbResult,
      });

      return dbResult;
    }
  } catch (dbErr) {
    // If DB is temporarily unavailable, gracefully continue to Google API
    console.warn("[GooglePlacesCache] DB lookup error:", dbErr);
  }

  // 4. Cache Miss -> Call Google Places API (New)
  if (!GOOGLE_PLACES_API_KEY) {
    const err = new Error(
      "Google Places API key is not configured on the backend. Please set GOOGLE_PLACES_API_KEY in .env."
    );
    (err as any).statusCode = 503;
    throw err;
  }

  const fieldMask = [
    "places.id",
    "places.displayName",
    "places.formattedAddress",
    "places.location",
    "places.types",
    "places.primaryType",
    "places.rating",
    "places.userRatingCount",
    "places.nationalPhoneNumber",
    "places.internationalPhoneNumber",
    "places.websiteUri",
    "places.googleMapsUri",
    "places.photos",
  ].join(",");

  let url: string;
  let requestBody: Record<string, unknown>;

  if (query) {
    // Text search scoped to location circle
    url = "https://places.googleapis.com/v1/places:searchText";
    requestBody = {
      textQuery: query,
      includedType: "church",
      locationBias: {
        circle: {
          center: { latitude, longitude },
          radius,
        },
      },
      maxResultCount: limit,
      ...(opts.languageCode ? { languageCode: opts.languageCode } : {}),
    };
  } else {
    // Nearby search with circle restriction
    url = "https://places.googleapis.com/v1/places:searchNearby";
    requestBody = {
      includedTypes: ["church"],
      maxResultCount: limit,
      locationRestriction: {
        circle: {
          center: { latitude, longitude },
          radius,
        },
      },
      rankPreference,
      ...(opts.languageCode ? { languageCode: opts.languageCode } : {}),
    };
  }

  let response: globalThis.Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": GOOGLE_PLACES_API_KEY,
        "X-Goog-FieldMask": fieldMask,
      },
      body: JSON.stringify(requestBody),
      signal: AbortSignal.timeout(10000), // 10s timeout
    });
  } catch (err: any) {
    if (err.name === "TimeoutError") {
      const timeoutErr = new Error("Google Places API request timed out. Please try again.");
      (timeoutErr as any).statusCode = 504;
      throw timeoutErr;
    }
    const netErr = new Error(`Failed to reach Google Places API: ${err.message}`);
    (netErr as any).statusCode = 502;
    throw netErr;
  }

  const rawData: any = await response.json();

  if (!response.ok) {
    const errorMsg =
      rawData?.error?.message ||
      `Google Places API returned status code ${response.status}`;
    const statusCode = response.status === 403 || response.status === 401 ? 502 : response.status;
    console.error("[GooglePlaces] API Error:", rawData);

    const apiErr = new Error(`Google Places error: ${errorMsg}`);
    (apiErr as any).statusCode = statusCode;
    (apiErr as any).details = rawData?.error;
    throw apiErr;
  }

  const places: any[] = Array.isArray(rawData.places) ? rawData.places : [];
  let churches = places.map((p) => transformGooglePlace(p, latitude, longitude));

  if (rankPreference === "DISTANCE") {
    churches.sort((a, b) => a.distanceMeters - b.distanceMeters);
  }

  const result: NearbyChurchesResult = {
    center: { latitude, longitude },
    radius,
    count: churches.length,
    churches,
    data: churches,
    cached: false,
    source: "google",
  };

  // 5. Store in L1 In-Memory Cache (2 hours TTL)
  placesCache.set(cacheKey, {
    expiresAt: Date.now() + 2 * 60 * 60 * 1000,
    center: { latitude, longitude },
    radius,
    query,
    data: result,
  });

  // 6. Asynchronously save to MongoDB Persistent Cache (7 days auto-expiration)
  ChurchPlacesCache.create({
    location: {
      type: "Point",
      coordinates: [longitude, latitude],
    },
    latitude,
    longitude,
    radius,
    query: query.toLowerCase().trim(),
    rankPreference,
    churches,
    count: churches.length,
  }).catch((saveErr) => {
    console.warn("[GooglePlacesCache] Failed to save cache entry in MongoDB:", saveErr);
  });

  return result;
}

/**
 * Resolves a Google Place photo reference to an image URL
 * Uses skipHttpRedirect=true to get a high-speed CDN URL or stream
 */
export async function getGooglePlacePhotoUrl(
  photoRef: string,
  maxWidth = 800,
  maxHeight = 600
): Promise<string> {
  if (!GOOGLE_PLACES_API_KEY) {
    const err = new Error("Google Places API key is not configured.");
    (err as any).statusCode = 503;
    throw err;
  }

  if (!photoRef) {
    const err = new Error("photoRef is required.");
    (err as any).statusCode = 400;
    throw err;
  }

  const url = `https://places.googleapis.com/v1/${photoRef}/media?maxHeightPx=${maxHeight}&maxWidthPx=${maxWidth}&key=${GOOGLE_PLACES_API_KEY}&skipHttpRedirect=true`;

  const response = await fetch(url, {
    method: "GET",
    signal: AbortSignal.timeout(8000),
  });

  if (!response.ok) {
    const raw: any = await response.json().catch(() => ({}));
    const err = new Error(raw?.error?.message || "Failed to fetch place photo from Google.");
    (err as any).statusCode = response.status;
    throw err;
  }

  const data: any = await response.json();
  const photoUri = data?.photoUri;

  if (!photoUri) {
    const err = new Error("Photo URI not returned by Google Places.");
    (err as any).statusCode = 404;
    throw err;
  }

  return photoUri;
}

/**
 * Fetch detailed information for a single church place by Place ID
 */
export async function getGooglePlaceDetails(
  placeId: string,
  languageCode?: string
): Promise<Record<string, unknown>> {
  if (!placeId) {
    const err = new Error("placeId is required.");
    (err as any).statusCode = 400;
    throw err;
  }

  if (!GOOGLE_PLACES_API_KEY) {
    const err = new Error("Google Places API key is not configured.");
    (err as any).statusCode = 503;
    throw err;
  }

  const fieldMask = [
    "id",
    "displayName",
    "formattedAddress",
    "location",
    "types",
    "primaryType",
    "rating",
    "userRatingCount",
    "nationalPhoneNumber",
    "internationalPhoneNumber",
    "websiteUri",
    "googleMapsUri",
    "regularOpeningHours",
    "photos",
    "editorialSummary",
    "reviews",
  ].join(",");

  const url = `https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}${
    languageCode ? `?languageCode=${encodeURIComponent(languageCode)}` : ""
  }`;

  const response = await fetch(url, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": GOOGLE_PLACES_API_KEY,
      "X-Goog-FieldMask": fieldMask,
    },
    signal: AbortSignal.timeout(10000),
  });

  const data: any = await response.json();

  if (!response.ok) {
    const err = new Error(data?.error?.message || "Failed to fetch place details.");
    (err as any).statusCode = response.status;
    throw err;
  }

  return data;
}
