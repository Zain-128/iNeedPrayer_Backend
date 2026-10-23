# Church Finder API Specification

Backend API specification for the **Church Finder / Nearby Churches** service powered by **Google Places API (New)**.

---

## 1. Base Information

- **Base Path**: `/api/churches`
- **Hostinger Base URL**: `https://dimgrey-mink-558336.hostingersite.com`
- **Local Dev Base URL**: `http://localhost:3004`
- **Authentication**: Optional (`Authorization: Bearer <token>`). Endpoints can be called publicly or with user tokens.
- **Rate Limit**: `60 requests / minute / IP`. Returns `429 Too Many Requests` if exceeded.
- **Rate Limit**: `60 requests / minute / IP`. Returns `429 Too Many Requests` if exceeded.
- **Cache**: Dual-tier location cache (2-hour in-memory + 7-day MongoDB geospatial proximity cache) saving ~90-98% Google API calls.

---

## 2. API Endpoints Quick Reference

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/churches/nearby` | Search nearby churches via Query String |
| `POST` | `/api/churches/nearby` | Search nearby churches via JSON Body |
| `GET` / `POST` | `/api/churches/places/nearby` | Alias route for `/api/churches/nearby` |
| `GET` | `/api/churches/places/photo` | Photo proxy (secure image redirect) |
| `GET` | `/api/churches/places/:placeId` | Get full place details for a church |

---

## 3. Endpoints Specification

### 3.1. Search Nearby Churches

Fetches physical churches around given coordinates within a radius. Worldwide support.

- **Route**: `GET /api/churches/nearby` **OR** `POST /api/churches/nearby`
- **Content-Type**: `application/json` (for POST)

#### Request Parameters

| Parameter | Type | Required | Default | Validation & Rules |
|---|---|---|---|---|
| `latitude` / `lat` | `number` | **Yes** | — | Min: `-90`, Max: `90` |
| `longitude` / `lng` / `lon` | `number` | **Yes** | — | Min: `-180`, Max: `180` |
| `radius` | `number` | No | `10000` | In meters (default: 10 KM). Min: `100`, Max: `50000`. Values $\le 50$ are auto-converted from km to meters. |
| `query` / `q` | `string` | No | — | Optional church name/keyword search within the area |
| `limit` | `number` | No | `20` | Results limit (1 to 20, default: 20) |
| `rankBy` | `string` | No | `"popularity"` | `"popularity"` or `"distance"` |
| `lang` | `string` | No | `"en"` | Language code for addresses and names |

#### cURL Example (GET)

```bash
curl -X GET "https://dimgrey-mink-558336.hostingersite.com/api/churches/nearby?latitude=37.7749&longitude=-122.4194&radius=10000&rankBy=distance" \
  -H "Accept: application/json"
```

#### cURL Example (POST)

```bash
curl -X POST "https://dimgrey-mink-558336.hostingersite.com/api/churches/nearby" \
  -H "Content-Type: application/json" \
  -d '{
    "latitude": 37.7749,
    "longitude": -122.4194,
    "radius": 10000,
    "rankBy": "distance"
  }'
```

#### Success Response (`200 OK`)

```json
{
  "success": true,
  "count": 2,
  "center": {
    "latitude": 37.7749,
    "longitude": -122.4194
  },
  "radius": 10000,
  "cached": true,
  "source": "cache",
  "churches": [
    {
      "placeId": "ChIJN1t_tDeuEmsRUsoyG83frY4",
      "name": "Grace Cathedral",
      "address": "1100 California St, San Francisco, CA 94108, USA",
      "coordinates": {
        "latitude": 37.7919,
        "longitude": -122.4132
      },
      "location": {
        "latitude": 37.7919,
        "longitude": -122.4132
      },
      "distanceMeters": 1940,
      "distanceFormatted": "1.9 km",
      "rating": 4.7,
      "userRatingCount": 1820,
      "types": [
        "church",
        "place_of_worship",
        "point_of_interest",
        "establishment"
      ],
      "primaryType": "church",
      "phoneNumber": "(415) 749-6300",
      "website": "https://gracecathedral.org",
      "googleMapsUri": "https://maps.google.com/?cid=123456789",
      "coverPhotoUrl": "https://dimgrey-mink-558336.hostingersite.com/api/churches/places/photo?photoRef=places%2FChIJ...%2Fphotos%2F...",
      "photos": [
        {
          "name": "places/ChIJ.../photos/...",
          "widthPx": 4032,
          "heightPx": 3024,
          "proxyUrl": "https://dimgrey-mink-558336.hostingersite.com/api/churches/places/photo?photoRef=places%2FChIJ...%2Fphotos%2F..."
        }
      ]
    }
  ],
  "data": [
    /* Exact replica of churches array */
  ]
}
```

---

### 3.2. Church Photo Proxy

Streams Google Places photo without exposing the backend `GOOGLE_PLACES_API_KEY`.

- **Route**: `GET /api/churches/places/photo`
- **Response**: `302 Found` (redirects to Google high-speed CDN image)
- **Headers Returned**: `Cache-Control: public, max-age=86400`

#### Query Parameters

| Parameter | Type | Required | Default | Description |
|---|---|---|---|---|
| `photoRef` / `photoReference` / `name` | `string` | **Yes** | — | Google Places photo resource name from `photos[i].name` |
| `maxWidth` | `number` | No | `800` | Max width in px |
| `maxHeight` | `number` | No | `600` | Max height in px |

#### cURL Example

```bash
curl -I -X GET "https://dimgrey-mink-558336.hostingersite.com/api/churches/places/photo?photoRef=places/ChIJN1t_tDeuEmsRUsoyG83frY4/photos/AU3C...&maxWidth=600&maxHeight=400"
```

---

### 3.3. Get Church Details (Single Place)

Fetches full Google Places metadata including reviews, opening hours, and editorial summary.

- **Route**: `GET /api/churches/places/:placeId`
- **Alternative**: `GET /api/churches/places/details?placeId=...`

#### Parameters

| Parameter | Location | Type | Required | Description |
|---|---|---|---|---|
| `placeId` | URL param / Query | `string` | **Yes** | Google Place ID (e.g. `ChIJN1t_tDeuEmsRUsoyG83frY4`) |
| `lang` | Query | `string` | No | Language code (default: `"en"`) |

#### cURL Example

```bash
curl -X GET "https://dimgrey-mink-558336.hostingersite.com/api/churches/places/ChIJN1t_tDeuEmsRUsoyG83frY4"
```

#### Success Response (`200 OK`)

```json
{
  "success": true,
  "place": {
    "id": "ChIJN1t_tDeuEmsRUsoyG83frY4",
    "displayName": {
      "text": "Grace Cathedral",
      "languageCode": "en"
    },
    "formattedAddress": "1100 California St, San Francisco, CA 94108, USA",
    "location": {
      "latitude": 37.7919,
      "longitude": -122.4132
    },
    "rating": 4.7,
    "userRatingCount": 1820,
    "nationalPhoneNumber": "(415) 749-6300",
    "websiteUri": "https://gracecathedral.org",
    "regularOpeningHours": {
      "openNow": true,
      "periods": [ ... ],
      "weekdayDescriptions": [
        "Monday: 10:00 AM – 5:00 PM",
        "Tuesday: 10:00 AM – 5:00 PM",
        ...
      ]
    },
    "reviews": [
      {
        "authorAttribution": {
          "displayName": "John Doe",
          "photoUri": "https://..."
        },
        "rating": 5,
        "text": { "text": "Beautiful church and peaceful atmosphere." },
        "relativePublishTimeDescription": "2 months ago"
      }
    ]
  }
}
```

---

## 4. Status Codes & Error Handling

All error responses return a standardized JSON structure:

```json
{
  "success": false,
  "message": "<Error description>"
}
```

| HTTP Status | Code | Description & Example |
|---|---|---|
| `200 OK` | `OK` | Request succeeded. |
| `400 Bad Request` | `INVALID_PARAMS` | Missing or invalid `latitude` / `longitude` values. |
| `429 Too Many Requests` | `RATE_LIMITED` | Exceeded 60 req/min. Header `Retry-After: <seconds>` included. |
| `502 Bad Gateway` | `GOOGLE_API_ERROR` | Upstream Google Places API returned an error (e.g., quota exceeded). |
| `503 Service Unavailable` | `NOT_CONFIGURED` | `GOOGLE_PLACES_API_KEY` missing in `.env`. |
| `504 Gateway Timeout` | `TIMEOUT` | Google Places API took $> 10$ seconds to respond. |

### Error Response Samples

#### Missing Coordinates (`400 Bad Request`)
```json
{
  "success": false,
  "message": "Both latitude and longitude are required. Example: ?latitude=40.7128&longitude=-74.0060"
}
```

#### Rate Limit Exceeded (`429 Too Many Requests`)
```json
{
  "success": false,
  "message": "Too many requests to Church Finder. Please wait a moment before searching again.",
  "retryAfterSeconds": 15
}
```

#### Unconfigured API Key (`503 Service Unavailable`)
```json
{
  "success": false,
  "message": "Google Places API key is not configured on the backend. Please set GOOGLE_PLACES_API_KEY in .env."
}
```

---

## 5. Cost Optimization & Google Billing Strategy

### 5.1. The Cost Challenge
Google Places API (New) charges per **Nearby Search** or **Text Search** request.
- If 1,000 users open the app and perform 2 additional searches each = **3,000 requests**.
- Without optimization, 3,000 requests = ~$96 to $105 on Google Cloud.

### 5.2. Architecture Optimizations Implemented

#### 1. Frontend UX Optimization ("Search This Area" pattern)
- **Initial Load**: When the screen opens, GPS gets the user coordinates and triggers **one** search with default **10 KM** radius and **max 20 results**.
- **No Map-Drag Triggers**: Moving, panning, or zooming the map **does not** automatically fire API calls.
- **Explicit Trigger**: A new request is made **only** when the user taps **"Search This Area"** or **"Refresh Location"**.
- Result: Prevents rapid-fire requests from map gestures (saving 5–10 requests per user session).

#### 2. Backend Multi-Tier Location Caching
- **L1 In-Memory Cache**: 2 hours TTL for instant responses.
- **L2 Persistent MongoDB Cache (`ChurchPlacesCache`)**: 7-day TTL with `2dsphere` geospatial indexing. Survives server restarts.
- **1.5 KM Proximity Spatial Reuse**:
  - For a 10 KM radius search, physical churches do not move.
  - If another user searches within **~1.5 KM** (15% offset) of an existing cached search center, the backend **reuses** the cached church places.
  - The backend dynamically recalculates the exact distance (`distanceMeters` & `distanceFormatted`) from the new user's actual position.
- Result: 1,000 users in the same metropolitan area generate only **a few unique Google API calls instead of 1,000**. (90% to 98% call reduction).

### 5.3. Google Maps Platform Pricing & Free Tier

| Service | Pricing | Free Allowance |
|---|---|---|
| **Google Maps SDK** (Android & iOS) | **FREE** | Unlimited native map loads |
| **Google Places Nearby Search** (New) | ~$0.032 / request (~$32 / 1,000) | **$200 free monthly credit** |

- **$200 Monthly Free Tier Calculation**:
  $$\frac{\$200}{\$0.032} \approx 6,250 \text{ free requests per month}$$
- **Real-World Impact**:
  With backend location caching, 1,000 to 3,000 user searches are condensed into only ~100 to 300 unique Google API calls.
  This easily fits **100% within Google's free $200 monthly tier**, resulting in **$0.00 actual billing cost**!

