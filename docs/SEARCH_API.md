# Search API

One global search endpoint for people, posts, groups, and churches.

**Endpoint:** `GET /api/search`  
**Auth:** `Authorization: Bearer <token>` (required)  
**Payload:** none (query string only)

Local example: `/api/search?q=grace&type=all`

---

## Query keys

| Key | Type | Required | Default | Description |
|-----|------|----------|---------|-------------|
| `q` | string | Yes | — | Search text. Trimmed. Case-insensitive. Empty / missing → empty results. |
| `type` | string | No | `all` | What to search. See values below. |
| `page` | number | No | `1` | Page number (used when `type` is **not** `all`). Min `1`. |
| `limit` | number | No | `20` | Page size. Min `1`, max `50`. For `type=all` this is the **preview size per category**. |
| `lang` | string | No | viewer language | Optional. Used only for post text translation (`text` vs `originalText`). |

### `type` values

| `type` | Meaning |
|--------|---------|
| `all` | Preview of people + posts + groups + churches |
| `people` | Users only |
| `posts` | Prayer / praise posts only |
| `groups` | Groups only |
| `churches` | Churches only |

Invalid `type` → `400` `{ "message": "Invalid type" }`

---

## What is searched

| `type` | Matched fields |
|--------|----------------|
| `people` | `name`, `email` (blocked users hidden; current user excluded) |
| `posts` | post `text`, author `name` |
| `groups` | `name`, `description` |
| `churches` | `name`, `locationShort`, `city`, `country`, `about` |

---

## Common response keys

Every success `200` includes:

| Key | Type | Always | Description |
|-----|------|--------|-------------|
| `q` | string | yes | Echo of the search query |
| `type` | string | yes | Echo of `type` |
| `page` | number | yes | Current page |
| `limit` | number | yes | Page / preview size |

Then, depending on `type`, extra keys:

| Key | When present |
|-----|----------------|
| `people` | `type=all` or `type=people` |
| `posts` | `type=all` or `type=posts` |
| `groups` | `type=all` or `type=groups` |
| `churches` | `type=all` or `type=churches` |
| `counts` | `type=all` only — totals per category (for tab badges) |
| `total` | typed search only — total matches for that type |
| `totalPages` | typed search only — `Math.ceil(total / limit)` |

---

## Object keys

### Person (`people[]`)

Same shape as user search / author, plus follow flags for the Search people tab.

| Key | Type | Description |
|-----|------|-------------|
| `id` | string | User id |
| `name` | string | Display name |
| `avatar` | string | Avatar URL (may be `""`) |
| `location` | string | `"City, State, Country"` — omitted if empty |
| `bio` | string | Short bio (may be `""`) |
| `followersCount` | number | Follower count |
| `followersLabel` | string | e.g. `"1.2k followers"` |
| `isFollowing` | boolean | Viewer already follows this user |
| `friendStatus` | string | `none` \| `pending_sent` \| `pending_received` \| `friends` |

```json
{
  "id": "665c1a2b3c4d5e6f7a8b9c0d",
  "name": "John Smith",
  "avatar": "https://cdn.example.com/avatar.jpg",
  "location": "Houston, TX, United States",
  "bio": "Praying daily.",
  "followersCount": 128,
  "followersLabel": "128 followers",
  "isFollowing": false,
  "friendStatus": "none"
}
```

### Post (`posts[]`)

Same keys as `GET /api/posts`.

| Key | Type | Description |
|-----|------|-------------|
| `id` | string | Post id |
| `author` | object | `{ id, name, avatar, location? }` |
| `time` | string | Relative time, e.g. `"2 hours ago"` |
| `text` | string | Display text (translated if `lang` is set) |
| `originalText` | string | Original post text |
| `sourceLanguage` | string | e.g. `"en"` |
| `translations` | object | Optional `{ "es": "...", "ur": "..." }` |
| `image` | string | Image URL (may be `""`) |
| `mode` | string | `"prayer"` \| `"praise"` |
| `group` | object | Present only if posted in a group — `{ id, name, image, privacy }` |
| `groupId` | string | Same as `group.id` (kept for backward compatibility) |
| `church` | object | Present only if posted in a church — `{ id, name, image }` |
| `churchId` | string | Same as `church.id` (kept for backward compatibility) |
| `stats` | object | `{ prays, praises, likes, comments, shares }` |
| `isMine` | boolean | Posted by the viewer |
| `isPrayedByMe` | boolean | Viewer prayed |
| `isPraisedByMe` | boolean | Viewer praised |
| `isLikedByMe` | boolean | Viewer liked |

```json
{
  "id": "665d1a2b3c4d5e6f7a8b9c0d",
  "author": {
    "id": "665c1a2b3c4d5e6f7a8b9c0d",
    "name": "John Smith",
    "avatar": "https://cdn.example.com/avatar.jpg",
    "location": "Houston, TX, United States"
  },
  "group": {
    "id": "6a466e50eea7623ea0bd8fd3",
    "name": "Current Updates Karachi",
    "image": "https://cdn.example.com/group-cover.jpg",
    "privacy": "public"
  },
  "groupId": "6a466e50eea7623ea0bd8fd3",
  "time": "2 hours ago",
  "text": "Please pray for healing and grace.",
  "originalText": "Please pray for healing and grace.",
  "sourceLanguage": "en",
  "image": "",
  "mode": "prayer",
  "stats": {
    "prays": 12,
    "praises": 3,
    "likes": 5,
    "comments": 2,
    "shares": 1
  },
  "isMine": false,
  "isPrayedByMe": false,
  "isPraisedByMe": false,
  "isLikedByMe": false
}
```

**`group` object keys**

| Key | Type | Description |
|-----|------|-------------|
| `id` | string | Group id |
| `name` | string | Group name |
| `image` | string | Cover / logo URL |
| `privacy` | string | `"public"` \| `"private"` (lowercase) |

### Group (`groups[]`)

Same keys as `GET /api/groups`.

| Key | Type | Description |
|-----|------|-------------|
| `id` | string | Group id |
| `name` | string | Group name |
| `membersLabel` | string | e.g. `"11k members"` |
| `memberCount` | number | Member count |
| `image` | string | Cover / avatar URL |
| `description` | string | Group description |
| `isMyGroup` | boolean | Viewer created the group |
| `isJoined` | boolean | Viewer is a member |
| `isMember` | boolean | Same as `isJoined` |
| `createdBy` | string \| null | Owner user id |

```json
{
  "id": "665e1a2b3c4d5e6f7a8b9c0d",
  "name": "Prayer Community",
  "membersLabel": "1.1k members",
  "memberCount": 1100,
  "image": "https://cdn.example.com/group.jpg",
  "description": "Daily prayer circle",
  "isMyGroup": false,
  "isJoined": true,
  "isMember": true,
  "createdBy": "665c1a2b3c4d5e6f7a8b9c0d"
}
```

### Church (`churches[]`)

Same keys as `GET /api/churches`.

| Key | Type | Description |
|-----|------|-------------|
| `id` | string | Church id |
| `name` | string | Church name |
| `locationShort` | string | e.g. `"Houston, TX"` |
| `locationFull` | string | Full address line |
| `country` | string | |
| `state` | string | |
| `city` | string | |
| `streetAddress` | string | |
| `landmark` | string | |
| `followersLabel` | string | e.g. `"12.4k followers"` |
| `membersLabel` | string | e.g. `"3 members"` |
| `image` | string | Logo URL |
| `bannerImage` | string | Banner URL |
| `banner` | string | Alias of `bannerImage` |
| `website` | string | |
| `email` | string | |
| `phone` | string | |
| `denomination` | string | |
| `shortBio` | string | |
| `about` | string | |
| `liveStreamUrl` | string | |
| `isVerified` | boolean | |
| `isFollowed` | boolean | Viewer follows this church |
| `isMyChurch` | boolean | Viewer owns / admins this church |
| `followerCount` | number | |
| `memberCount` | number | |

```json
{
  "id": "665f1a2b3c4d5e6f7a8b9c0d",
  "name": "Grace Community Church",
  "locationShort": "Houston, TX",
  "locationFull": "3700 Southwest Fwy, Houston, Texas, United States",
  "country": "United States",
  "state": "Texas",
  "city": "Houston",
  "streetAddress": "3700 Southwest Fwy",
  "landmark": "",
  "followersLabel": "12.4k followers",
  "membersLabel": "3 members",
  "image": "https://cdn.example.com/logo.png",
  "bannerImage": "https://cdn.example.com/banner.jpg",
  "banner": "https://cdn.example.com/banner.jpg",
  "website": "https://example.com",
  "email": "info@church.com",
  "phone": "+1 713-555-0100",
  "denomination": "Non-denominational",
  "shortBio": "A place of prayer and worship",
  "about": "Long description...",
  "liveStreamUrl": "",
  "isVerified": true,
  "isFollowed": false,
  "isMyChurch": false,
  "followerCount": 12400,
  "memberCount": 3
}
```

---

## 1) All — `type=all`

```http
GET /api/search?q=grace&type=all
Authorization: Bearer <token>
```

Preview lists (default `limit=20` per category, no pagination of the combined result). Use `counts` for tab badges, then call a typed search for the full list.

**Success `200`**

```json
{
  "q": "grace",
  "type": "all",
  "page": 1,
  "limit": 20,
  "counts": {
    "people": 4,
    "posts": 18,
    "groups": 2,
    "churches": 1
  },
  "people": [
    {
      "id": "665c1a2b3c4d5e6f7a8b9c0d",
      "name": "Grace Lee",
      "avatar": "https://cdn.example.com/grace.jpg",
      "location": "Dallas, TX, United States",
      "bio": "Worship leader",
      "followersCount": 86,
      "followersLabel": "86 followers",
      "isFollowing": false,
      "friendStatus": "none"
    }
  ],
  "posts": [
    {
      "id": "665d1a2b3c4d5e6f7a8b9c0d",
      "author": {
        "id": "665c1a2b3c4d5e6f7a8b9c11",
        "name": "Hannah R.",
        "avatar": "https://cdn.example.com/hannah.jpg",
        "location": "Chicago, IL, United States"
      },
      "time": "3 hours ago",
      "text": "Thankful for God's grace today.",
      "originalText": "Thankful for God's grace today.",
      "sourceLanguage": "en",
      "image": "",
      "mode": "praise",
      "stats": {
        "prays": 4,
        "praises": 21,
        "likes": 9,
        "comments": 1,
        "shares": 0
      },
      "isMine": false,
      "isPrayedByMe": false,
      "isPraisedByMe": true,
      "isLikedByMe": false
    }
  ],
  "groups": [
    {
      "id": "665e1a2b3c4d5e6f7a8b9c0d",
      "name": "Grace Circle",
      "membersLabel": "240 members",
      "memberCount": 240,
      "image": "https://cdn.example.com/group.jpg",
      "description": "Weekly grace & prayer",
      "isMyGroup": false,
      "isJoined": false,
      "isMember": false,
      "createdBy": "665c1a2b3c4d5e6f7a8b9c22"
    }
  ],
  "churches": [
    {
      "id": "665f1a2b3c4d5e6f7a8b9c0d",
      "name": "Grace Community Church",
      "locationShort": "Houston, TX",
      "locationFull": "3700 Southwest Fwy, Houston, Texas, United States",
      "country": "United States",
      "state": "Texas",
      "city": "Houston",
      "streetAddress": "3700 Southwest Fwy",
      "landmark": "",
      "followersLabel": "12.4k followers",
      "membersLabel": "3 members",
      "image": "https://cdn.example.com/logo.png",
      "bannerImage": "https://cdn.example.com/banner.jpg",
      "banner": "https://cdn.example.com/banner.jpg",
      "website": "https://example.com",
      "email": "info@church.com",
      "phone": "+1 713-555-0100",
      "denomination": "Non-denominational",
      "shortBio": "A place of prayer and worship",
      "about": "Long description...",
      "liveStreamUrl": "",
      "isVerified": true,
      "isFollowed": false,
      "isMyChurch": false,
      "followerCount": 12400,
      "memberCount": 3
    }
  ]
}
```

Empty query / no matches: same keys, arrays `[]`, counts `0`.

---

## 2) People — `type=people`

```http
GET /api/search?q=john&type=people
Authorization: Bearer <token>
```

Optional: `&page=1&limit=20`

**Success `200`**

```json
{
  "q": "john",
  "type": "people",
  "page": 1,
  "limit": 20,
  "total": 2,
  "totalPages": 1,
  "people": [
    {
      "id": "665c1a2b3c4d5e6f7a8b9c0d",
      "name": "John Smith",
      "avatar": "https://cdn.example.com/john.jpg",
      "location": "Houston, TX, United States",
      "bio": "Praying daily.",
      "followersCount": 128,
      "followersLabel": "128 followers",
      "isFollowing": true,
      "friendStatus": "friends"
    },
    {
      "id": "665c1a2b3c4d5e6f7a8b9c33",
      "name": "Johnny Rivera",
      "avatar": "",
      "bio": "",
      "followersCount": 12,
      "followersLabel": "12 followers",
      "isFollowing": false,
      "friendStatus": "pending_sent"
    }
  ]
}
```

`location` is omitted when city/state/country are all empty.

---

## 3) Posts — `type=posts`

```http
GET /api/search?q=prayer&type=posts&page=1&limit=20
Authorization: Bearer <token>
```

Optional: `&lang=es`

**Success `200`**

```json
{
  "q": "prayer",
  "type": "posts",
  "page": 1,
  "limit": 20,
  "total": 37,
  "totalPages": 2,
  "posts": [
    {
      "id": "665d1a2b3c4d5e6f7a8b9c0d",
      "author": {
        "id": "665c1a2b3c4d5e6f7a8b9c0d",
        "name": "John Smith",
        "avatar": "https://cdn.example.com/john.jpg",
        "location": "Houston, TX, United States"
      },
      "time": "2 hours ago",
      "text": "Please keep my family in prayer.",
      "originalText": "Please keep my family in prayer.",
      "sourceLanguage": "en",
      "image": "https://cdn.example.com/post.jpg",
      "mode": "prayer",
      "group": {
        "id": "6a466e50eea7623ea0bd8fd3",
        "name": "Current Updates Karachi",
        "image": "https://cdn.example.com/group-cover.jpg",
        "privacy": "public"
      },
      "groupId": "6a466e50eea7623ea0bd8fd3",
      "stats": {
        "prays": 12,
        "praises": 3,
        "likes": 5,
        "comments": 2,
        "shares": 1
      },
      "isMine": false,
      "isPrayedByMe": true,
      "isPraisedByMe": false,
      "isLikedByMe": false
    }
  ]
}
```

---

## 4) Groups — `type=groups`

```http
GET /api/search?q=community&type=groups
Authorization: Bearer <token>
```

Optional: `&page=1&limit=20`

**Success `200`**

```json
{
  "q": "community",
  "type": "groups",
  "page": 1,
  "limit": 20,
  "total": 3,
  "totalPages": 1,
  "groups": [
    {
      "id": "665e1a2b3c4d5e6f7a8b9c0d",
      "name": "Prayer Community",
      "membersLabel": "1.1k members",
      "memberCount": 1100,
      "image": "https://cdn.example.com/group.jpg",
      "description": "A community for daily prayer",
      "isMyGroup": false,
      "isJoined": true,
      "isMember": true,
      "createdBy": "665c1a2b3c4d5e6f7a8b9c0d"
    }
  ]
}
```

---

## 5) Churches — `type=churches`

```http
GET /api/search?q=church&type=churches
Authorization: Bearer <token>
```

Optional: `&page=1&limit=20`

**Success `200`**

```json
{
  "q": "church",
  "type": "churches",
  "page": 1,
  "limit": 20,
  "total": 1,
  "totalPages": 1,
  "churches": [
    {
      "id": "665f1a2b3c4d5e6f7a8b9c0d",
      "name": "Grace Community Church",
      "locationShort": "Houston, TX",
      "locationFull": "3700 Southwest Fwy, Houston, Texas, United States",
      "country": "United States",
      "state": "Texas",
      "city": "Houston",
      "streetAddress": "3700 Southwest Fwy",
      "landmark": "",
      "followersLabel": "12.4k followers",
      "membersLabel": "3 members",
      "image": "https://cdn.example.com/logo.png",
      "bannerImage": "https://cdn.example.com/banner.jpg",
      "banner": "https://cdn.example.com/banner.jpg",
      "website": "https://example.com",
      "email": "info@church.com",
      "phone": "+1 713-555-0100",
      "denomination": "Non-denominational",
      "shortBio": "A place of prayer and worship",
      "about": "Long description...",
      "liveStreamUrl": "",
      "isVerified": true,
      "isFollowed": false,
      "isMyChurch": false,
      "followerCount": 12400,
      "memberCount": 3
    }
  ]
}
```

---

## Errors

| Status | Body | When |
|--------|------|------|
| `400` | `{ "message": "Invalid type" }` | `type` is not `all` / `people` / `posts` / `groups` / `churches` |
| `401` | `{ "message": "Not authorized; no token" }` | Missing token |
| `401` | `{ "message": "Invalid or expired token" }` | Bad / expired JWT |

Empty `q` is **not** an error — returns empty arrays (`total: 0`).

---

## Frontend usage

| Screen / tab | Call |
|--------------|------|
| Search — All | `GET /api/search?q=grace&type=all` |
| Search — People | `GET /api/search?q=john&type=people&page=1&limit=20` |
| Search — Posts | `GET /api/search?q=prayer&type=posts&page=1&limit=20` |
| Search — Groups | `GET /api/search?q=community&type=groups&page=1&limit=20` |
| Search — Churches | `GET /api/search?q=church&type=churches&page=1&limit=20` |

Reuse existing UI mappers:

- People row → `people[]` (`id`, `name`, `avatar`, `isFollowing`)
- Feed card → `posts[]` (same as Home `GET /api/posts`)
- Group card → `groups[]` (same as Discover Groups)
- Church card → `churches[]` (same as Discover Churches)
