# Church Finder API (Google Places New) — Frontend Integration Guide

This document describes the **Church Finder / Nearby Churches** API integration powered by **Google Places API (New)** for the React Native mobile application and Web client.

---

## 1. Overview & Architecture

- **Purpose**: Fetch nearby verified churches anywhere in the world based on user location or map coordinates.
- **Provider**: Google Places API (New) (`POST places:searchNearby` and `POST places:searchText`).
- **Security**: The `GOOGLE_PLACES_API_KEY` is kept **strictly on the backend**. A secure image proxy (`/api/churches/places/photo`) streams church photos without exposing the API key to client apps.
- **Rate Limiting**: 60 requests per minute per IP address. Exceeded limits return `429 Too Many Requests`.
- **Caching**: 5-minute smart in-memory caching based on coordinate grid (~110m precision) to optimize speed and preserve Google Places quota during map panning.

---

## 2. Endpoints Summary

| Method | Endpoint | Description | Auth Required |
|---|---|---|---|
| `GET` / `POST` | `/api/churches/nearby` | Fetch nearby churches based on coordinates & radius | Optional (`Bearer <token>`) |
| `GET` / `POST` | `/api/churches/places/nearby` | Alias for `/api/churches/nearby` | Optional (`Bearer <token>`) |
| `GET` | `/api/churches/places/photo` | Secure photo proxy (redirects to CDN) | Optional |
| `GET` | `/api/churches/places/:placeId` | Single church detailed metadata & hours | Optional |

---

## 3. Search Nearby Churches

### `GET /api/churches/nearby` or `POST /api/churches/nearby`

Supports both query parameters (for `GET`) and JSON body (for `POST`).

### Request Parameters

| Parameter | Type | Required | Default | Description |
|---|---|---|---|---|
| `latitude` / `lat` | `number` | **Yes** | — | Center latitude (-90 to 90), e.g. `37.7749` |
| `longitude` / `lng` / `lon` | `number` | **Yes** | — | Center longitude (-180 to 180), e.g. `-122.4194` |
| `radius` | `number` | No | `10000` | Search radius in meters (default: 10 KM). Min: 100, Max: 50000. Values $\le 50$ are auto-converted as kilometers. |
| `query` / `q` | `string` | No | — | Optional text search within the map area (e.g. `"Grace"`, `"Baptist"`, `"Cathedral"`) |
| `limit` | `number` | No | `20` | Maximum results to return (1 to 20, default: 20). |
| `rankBy` | `string` | No | `"popularity"` | Sorting preference: `"popularity"` or `"distance"`. |
| `lang` | `string` | No | `"en"` | BCP-47 language code for place names/addresses. |

### Example Request (GET)
```http
GET /api/churches/nearby?latitude=37.7749&longitude=-122.4194&radius=10000&rankBy=distance
```

### Example Request (POST)
```http
POST /api/churches/nearby
Content-Type: application/json

{
  "latitude": 37.7749,
  "longitude": -122.4194,
  "radius": 10000,
  "rankBy": "distance"
}
```

---

## 4. Success Response (`200 OK`)

Both `churches` and `data` arrays are returned for convenience.

```json
{
  "success": true,
  "count": 2,
  "center": {
    "latitude": 37.7749,
    "longitude": -122.4194
  },
  "radius": 5000,
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
      "coverPhotoUrl": "https://api.yourdomain.com/api/churches/places/photo?photoRef=places%2FChIJ...%2Fphotos%2F...&maxWidth=800&maxHeight=600",
      "photos": [
        {
          "name": "places/ChIJ.../photos/...",
          "widthPx": 4032,
          "heightPx": 3024,
          "proxyUrl": "https://api.yourdomain.com/api/churches/places/photo?photoRef=places%2FChIJ...%2Fphotos%2F...&maxWidth=800&maxHeight=600"
        }
      ]
    }
  ],
  "data": [ /* same as churches */ ]
}
```

### Key Response Fields Explained

| Field | Type | Description |
|---|---|---|
| `placeId` | `string` | Unique Google Place ID. Used for unique React list keys and fetching full details. |
| `name` | `string` | Display name of the church. |
| `address` | `string` | Full formatted address. |
| `coordinates` | `{ latitude, longitude }` | Compatible directly with React Native `MapView.Marker` `coordinate` prop. |
| `distanceMeters` | `number` | Straight-line distance from map center in meters. |
| `distanceFormatted` | `string` | Pre-formatted distance label (e.g. `"450 m"` or `"1.9 km"`). |
| `rating` | `number \| null` | Google star rating (e.g. `4.7`) or `null` if no reviews. |
| `userRatingCount` | `number` | Total number of reviews on Google. |
| `coverPhotoUrl` | `string \| undefined` | Secure proxy image URL ready to pass to React Native `<Image source={{ uri }} />`. |
| `website` | `string \| undefined` | Church official website URL. |
| `phoneNumber` | `string \| undefined` | Church contact phone number. |
| `googleMapsUri` | `string \| undefined` | Link to open church in Google Maps app. |

---

## 5. Church Photo Proxy

### `GET /api/churches/places/photo`

Use this endpoint to render church photos securely without exposing the Google Places API key.

#### Query Parameters:
- `photoRef`: The photo resource name from `photos[i].name` (e.g. `places/ChIJ.../photos/...`).
- `maxWidth`: (Optional, default `800`) Maximum image width in pixels.
- `maxHeight`: (Optional, default `600`) Maximum image height in pixels.

#### Behavior:
- Automatically redirects (`HTTP 302`) to Google's fast CDN edge URL.
- Sets `Cache-Control: public, max-age=86400` (cached for 24 hours on device).
- Simply pass `coverPhotoUrl` directly to `<Image source={{ uri: church.coverPhotoUrl }} />`.

---

## 6. Error Responses

### `400 Bad Request` — Missing or Invalid Coordinates
```json
{
  "success": false,
  "message": "Both latitude and longitude are required. Example: ?latitude=40.7128&longitude=-74.0060"
}
```

### `429 Too Many Requests` — Rate Limited
```json
{
  "success": false,
  "message": "Too many requests to Church Finder. Please wait a moment before searching again.",
  "retryAfterSeconds": 15
}
```
*Response includes `Retry-After: 15` header.*

### `503 Service Unavailable` — API Key Not Set
```json
{
  "success": false,
  "message": "Google Places API key is not configured on the backend. Please set GOOGLE_PLACES_API_KEY in .env."
}
```

---

## 7. React Native Integration (RTK Query)

The RTK Query hooks and TypeScript types are already added to `INeedPrayer/src/redux/services/churchesApi.ts`.

### Hook Import:
```tsx
import {
  useGetNearbyChurchesQuery,
  useLazyGetNearbyChurchesQuery,
  NearbyChurchPlace,
} from '../../redux/services/churchesApi';
```

### Complete Screen Example (`ChurchFinderScreen.tsx`):

```tsx
import React, { useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  FlatList,
  Image,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import MapView, { Marker, Region, PROVIDER_GOOGLE } from 'react-native-maps';
import { useLazyGetNearbyChurchesQuery, NearbyChurchPlace } from '../../redux/services/churchesApi';

const { width } = Dimensions.get('window');

// Default region (e.g. 10 KM view delta ~0.09 degrees)
const DEFAULT_DELTA = 0.09;

export const ChurchFinderScreen = () => {
  const mapRef = useRef<MapView>(null);
  const [selectedChurch, setSelectedChurch] = useState<NearbyChurchPlace | null>(null);
  const [currentRegion, setCurrentRegion] = useState<Region>({
    latitude: 40.7128,
    longitude: -74.0060,
    latitudeDelta: DEFAULT_DELTA,
    longitudeDelta: DEFAULT_DELTA,
  });
  const [showSearchThisArea, setShowSearchThisArea] = useState<boolean>(false);
  const isInitialMount = useRef(true);

  const [triggerFetchNearby, { data, isFetching }] = useLazyGetNearbyChurchesQuery();

  // 1. On Mount: Detect GPS and trigger ONE initial search (10 KM radius, max 20 results)
  useEffect(() => {
    // Example: Using @react-native-community/geolocation or Expo Location
    // Geolocation.getCurrentPosition((pos) => { ... })
    const initialLat = 40.7128;
    const initialLng = -74.0060;

    triggerFetchNearby({
      latitude: initialLat,
      longitude: initialLng,
      radius: 10000, // 10 KM
      limit: 20,
    });
  }, [triggerFetchNearby]);

  // 2. When map moves: DO NOT call API automatically. Just show "Search This Area" button.
  const handleRegionChangeComplete = useCallback((region: Region) => {
    setCurrentRegion(region);
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }
    // Reveal the "Search This Area" button so user decides when to make an API request
    setShowSearchThisArea(true);
  }, []);

  // 3. User taps "Search This Area"
  const handleSearchThisArea = useCallback(() => {
    setShowSearchThisArea(false);
    triggerFetchNearby({
      latitude: currentRegion.latitude,
      longitude: currentRegion.longitude,
      radius: 10000, // 10 KM
      limit: 20,
    });
  }, [currentRegion, triggerFetchNearby]);

  const churches = data?.churches || [];

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        provider={PROVIDER_GOOGLE}
        style={styles.map}
        initialRegion={INITIAL_REGION}
        onRegionChangeComplete={handleRegionChangeComplete}
        showsUserLocation
        showsMyLocationButton
      >
        {churches.map((church) => (
          <Marker
            key={church.placeId}
            coordinate={church.coordinates}
            title={church.name}
            description={`${church.distanceFormatted} • ${church.address}`}
            onPress={() => setSelectedChurch(church)}
          />
        ))}
      </MapView>

      {/* Floating "Search This Area" Button (Revealed only when user moves map) */}
      {showSearchThisArea && !isFetching && (
        <TouchableOpacity
          style={styles.searchThisAreaBtn}
          activeOpacity={0.85}
          onPress={handleSearchThisArea}
        >
          <Text style={styles.searchThisAreaText}>🔍 Search This Area</Text>
        </TouchableOpacity>
      )}

      {/* Loading Indicator */}
      {isFetching && (
        <View style={styles.loaderBadge}>
          <ActivityIndicator size="small" color="#fff" />
          <Text style={styles.loaderText}>Searching churches...</Text>
        </View>
      )}

      {/* Bottom Horizontal Cards List */}
      {churches.length > 0 && (
        <View style={styles.carouselContainer}>
          <FlatList
            horizontal
            showsHorizontalScrollIndicator={false}
            data={churches}
            keyExtractor={(item) => item.placeId}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[
                  styles.card,
                  selectedChurch?.placeId === item.placeId && styles.cardActive,
                ]}
                activeOpacity={0.85}
                onPress={() => {
                  setSelectedChurch(item);
                  mapRef.current?.animateToRegion({
                    latitude: item.coordinates.latitude,
                    longitude: item.coordinates.longitude,
                    latitudeDelta: 0.02,
                    longitudeDelta: 0.02,
                  }, 500);
                }}
              >
                {item.coverPhotoUrl ? (
                  <Image source={{ uri: item.coverPhotoUrl }} style={styles.cardImage} />
                ) : (
                  <View style={[styles.cardImage, styles.placeholderImage]}>
                    <Text style={styles.placeholderText}>⛪</Text>
                  </View>
                )}
                <View style={styles.cardBody}>
                  <Text style={styles.cardTitle} numberOfLines={1}>
                    {item.name}
                  </Text>
                  <Text style={styles.cardAddress} numberOfLines={2}>
                    {item.address}
                  </Text>
                  <View style={styles.cardFooter}>
                    <Text style={styles.distanceBadge}>{item.distanceFormatted}</Text>
                    {item.rating != null && (
                      <Text style={styles.ratingText}>⭐ {item.rating.toFixed(1)}</Text>
                    )}
                  </View>
                </View>
              </TouchableOpacity>
            )}
          />
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  map: { width: '100%', height: '100%' },
  loaderBadge: {
    position: 'absolute',
    top: 50,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.75)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 8,
  },
  loaderText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  searchThisAreaBtn: {
    position: 'absolute',
    top: 50,
    alignSelf: 'center',
    backgroundColor: '#007AFF',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 25,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowOffset: { width: 0, height: 3 },
    shadowRadius: 6,
    elevation: 6,
  },
  searchThisAreaText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  carouselContainer: {
    position: 'absolute',
    bottom: 24,
    left: 0,
    right: 0,
    paddingHorizontal: 12,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 14,
    width: width * 0.75,
    marginHorizontal: 8,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 8,
    elevation: 5,
  },
  cardActive: {
    borderWidth: 2,
    borderColor: '#007AFF',
  },
  cardImage: { width: '100%', height: 110, resizeMode: 'cover' },
  placeholderImage: {
    backgroundColor: '#f0f0f0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholderText: { fontSize: 36 },
  cardBody: { padding: 12 },
  cardTitle: { fontSize: 15, fontWeight: '700', color: '#1c1c1e', marginBottom: 4 },
  cardAddress: { fontSize: 12, color: '#666', marginBottom: 8, lineHeight: 16 },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  distanceBadge: { fontSize: 12, fontWeight: '700', color: '#007AFF' },
  ratingText: { fontSize: 12, fontWeight: '600', color: '#FF9500' },
});
```

---

## 8. Best Practices for Frontend

1. **Debounce Map Movements**: Always add 300–500ms debouncing to `onRegionChangeComplete` so you don't send API requests on every single touch or drag event.
2. **Calculate Radius Dynamically**: Use `(latitudeDelta * 111000) / 2` to automatically adjust the search radius to whatever the user is viewing on screen.
3. **Handle 429 Status**: If rate limited, display a gentle toast: *"Please wait a moment before searching again."*
4. **Offline / Fallback**: If GPS or internet is disabled, show a retry button with user coordinates fallback.
