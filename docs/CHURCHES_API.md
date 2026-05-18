# Churches API — Frontend Integration Guide

Base path: **`/api/churches`**

All authenticated routes need:

```http
Authorization: Bearer <accessToken>
Content-Type: application/json
```

Local base URL example: `http://localhost:3004`

---

## Screens → APIs (quick map)

| App screen | What to call |
|------------|----------------|
| `ChurchesScreen` — My Churches tab | `GET /api/churches?tab=my` |
| `ChurchesScreen` — Followed tab | `GET /api/churches?tab=followed` |
| `ChurchesScreen` — search / filters | `GET /api/churches?q=...&filter=most_followed` |
| `DiscoverChurchesScreen` | `GET /api/churches/discover?q=...` |
| `CreateChurchScreen` → submit | `POST /api/churches` then navigate with `church.id` |
| `ChurchVerifyCodeScreen` | `POST /api/churches/:id/verify` body `{ code }` |
| `ChurchVerifyCodeScreen` — resend | `POST /api/churches/:id/verification/send` |
| `ChurchDetailScreen` | `GET /api/churches/:id` + `POST .../follow` |
| `ChurchDetailScreen` — posts feed | `GET /api/posts?churchId=:id` |
| `EditChurchScreen` — save | `PATCH /api/churches/:id` |
| `EditChurchScreen` — delete | `DELETE /api/churches/:id` |
| Add staff / invite user | `POST /api/churches/:id/members` |
| Logo / banner upload | `POST /api/upload/image?kind=church_logo` or `church_banner` |

---

## Church object (response)

```json
{
  "id": "665f1a2b3c4d5e6f7a8b9c0d",
  "name": "Grace Community Church",
  "locationShort": "Houston, TX",
  "locationFull": "3700 Southwest Fwy, Near Greenway Plaza, Houston, Texas, United States",
  "country": "United States",
  "state": "Texas",
  "city": "Houston",
  "streetAddress": "3700 Southwest Fwy",
  "landmark": "Near Greenway Plaza",
  "followersLabel": "12.4k followers",
  "membersLabel": "3 members",
  "image": "https://.../logo.png",
  "bannerImage": "https://.../banner.jpg",
  "banner": "https://.../banner.jpg",
  "website": "https://example.com",
  "email": "info@church.com",
  "phone": "+1 713-555-0100",
  "denomination": "Non-denominational",
  "shortBio": "One line summary",
  "about": "Long description",
  "liveStreamUrl": "https://...",
  "isVerified": true,
  "isFollowed": false,
  "isMyChurch": true,
  "followerCount": 12400,
  "memberCount": 3
}
```

`banner` is an alias of `bannerImage` (for `ChurchDetailScreen`).

---

## Field mapping (`CreateChurchScreen` → API)

The backend accepts **either** API names or UI names:

| UI (`CreateChurchScreen`) | API field |
|---------------------------|-----------|
| `churchName` | `name` |
| `businessEmail` | `email` |
| `businessPhone` | `phone` |
| `aboutChurch` | `about` |
| `logo` | `image` |
| `bannerImage` | `bannerImage` |
| `country`, `state`, `city`, `streetAddress`, `landmark` | same |
| `website`, `shortBio` | same |

`locationShort` / `locationFull` are auto-built from city/state/country/address if omitted.

---

## Recommended create + verify flow

### 1) Create (from `CreateChurchScreen`)

```http
POST /api/churches
Authorization: Bearer <token>
```

**Body** — send the form as-is (UI names OK):

```json
{
  "churchName": "Lakewood Church",
  "website": "https://www.lakewoodchurch.com",
  "country": "United States",
  "state": "Texas",
  "city": "Houston",
  "streetAddress": "3700 Southwest Fwy",
  "landmark": "Near Greenway Plaza",
  "businessEmail": "info@lakewoodchurch.com",
  "businessPhone": "+1 713-635-4154",
  "shortBio": "Optional one-liner",
  "aboutChurch": "Optional long text",
  "logo": "https://cdn.../logo.png",
  "bannerImage": "https://cdn.../banner.jpg"
}
```

**Response** `201`

```json
{
  "church": { "...": "see Church object" },
  "verificationRequired": true,
  "devVerificationCode": "48291"
}
```

- `devVerificationCode` is returned **only in development** until email OTP is integrated. In production, omit from UI and rely on email.
- Navigate to `ChurchVerifyCode` with `church.id` and `target: church.email`.

### 2) Verify OTP (`ChurchVerifyCodeScreen`)

```http
POST /api/churches/:churchId/verify
```

```json
{ "code": "12345" }
```

**Response** `200`

```json
{
  "ok": true,
  "church": { "...": "isVerified: true" }
}
```

**Dev stub:** set `CHURCH_VERIFY_CODE=12345` in backend `.env` (default). Any generated code from create/resend also works for 15 minutes.

### 3) Resend code

```http
POST /api/churches/:churchId/verification/send
Authorization: Bearer <token>
```

Owner/admin only. Response includes `devVerificationCode` in dev.

---

## List churches

```http
GET /api/churches?tab=my
GET /api/churches?tab=followed
GET /api/churches?q=grace&filter=most_followed
```

| Query | Values |
|-------|--------|
| `tab` | `my` \| `followed` |
| `q` | search string |
| `filter` | `recommended` \| `most_followed` \| `nearest` \| `trending_posts` \| `trending_search` |

**Response** `200`

```json
{ "churches": [ /* Church[] */ ] }
```

`isMyChurch` = you own the church **or** you are admin/owner in members.

---

## Discover churches

Churches you do **not** own and do **not** follow (for `DiscoverChurchesScreen`).

```http
GET /api/churches/discover?q=houston
```

**Response** `200`

```json
{ "churches": [ /* Church[] */ ] }
```

---

## Get one church

```http
GET /api/churches/:id
```

**Response** `200`

```json
{ "church": { /* Church object */ } }
```

---

## Update church

```http
PATCH /api/churches/:id
Authorization: Bearer <token>
```

Owner or church **admin** member. Body: same fields as create (`EditChurchScreen` uses `name`, `email`, `phone`, etc.).

**Response** `200`

```json
{ "church": { /* updated */ } }
```

---

## Delete church

```http
DELETE /api/churches/:id
Authorization: Bearer <token>
```

**Only the original owner** (`createdBy`). Removes follows and members.

**Response** `200`

```json
{ "ok": true }
```

---

## Follow / unfollow

Toggle — same endpoint for follow and unfollow.

```http
POST /api/churches/:id/follow
Authorization: Bearer <token>
```

**Response** `200`

```json
{
  "following": true,
  "followerCount": 12401,
  "followersLabel": "12.4k followers"
}
```

Use on `ChurchDetailScreen` and `DiscoverChurchesScreen`.

---

## Church members (staff)

Roles: `owner` (creator), `admin`, `member`.

### List members

```http
GET /api/churches/:id/members
Authorization: Bearer <token>
```

Owner/admin only.

**Response** `200`

```json
{
  "members": [
    {
      "id": "...",
      "userId": "...",
      "name": "Jane",
      "email": "jane@example.com",
      "avatar": "https://...",
      "role": "admin",
      "joinedAt": "2026-05-18T12:00:00.000Z"
    }
  ]
}
```

### Add member (by user id or email)

```http
POST /api/churches/:id/members
Authorization: Bearer <token>
```

```json
{ "email": "volunteer@example.com", "role": "admin" }
```

or

```json
{ "userId": "665f...", "role": "member" }
```

**Response** `201`

```json
{
  "member": {
    "userId": "...",
    "name": "Jane",
    "email": "jane@example.com",
    "avatar": "",
    "role": "admin"
  },
  "memberCount": 4
}
```

### Remove member

```http
DELETE /api/churches/:id/members/:userId
Authorization: Bearer <token>
```

Cannot remove the church owner.

### Change role

```http
PATCH /api/churches/:id/members/:userId
Authorization: Bearer <token>
```

```json
{ "role": "admin" }
```

Allowed: `admin` \| `member`. Owner only.

---

## Church posts (existing Posts API)

```http
GET /api/posts?churchId=<churchId>
POST /api/posts
```

Create post body can include `churchId` to attach to a church profile feed (`ChurchDetailScreen`).

---

## Image upload

```http
POST /api/upload/image?kind=church_logo
POST /api/upload/image?kind=church_banner
```

Multipart field name: `image` (see main `docs/API.md`). Use returned URL in `logo` / `bannerImage` on create or patch.

---

## RTK Query example (optional)

```ts
// churchesApi.ts
import { api } from './api';

export const churchesApi = api.injectEndpoints({
  endpoints: (build) => ({
    listChurches: build.query({
      query: ({ tab, q, filter }: { tab?: string; q?: string; filter?: string }) => ({
        url: '/churches',
        params: { tab, q, filter },
      }),
      transformResponse: (r: { churches: unknown[] }) => r.churches,
    }),
    discoverChurches: build.query({
      query: (q?: string) => ({ url: '/churches/discover', params: { q } }),
      transformResponse: (r: { churches: unknown[] }) => r.churches,
    }),
    createChurch: build.mutation({
      query: (body) => ({ url: '/churches', method: 'POST', body }),
    }),
    verifyChurch: build.mutation({
      query: ({ id, code }: { id: string; code: string }) => ({
        url: `/churches/${id}/verify`,
        method: 'POST',
        body: { code },
      }),
    }),
    followChurch: build.mutation({
      query: (id: string) => ({ url: `/churches/${id}/follow`, method: 'POST' }),
    }),
    updateChurch: build.mutation({
      query: ({ id, ...body }) => ({ url: `/churches/${id}`, method: 'PATCH', body }),
    }),
    deleteChurch: build.mutation({
      query: (id: string) => ({ url: `/churches/${id}`, method: 'DELETE' }),
    }),
  }),
});
```

---

## Errors

| Status | Meaning |
|--------|---------|
| 400 | Validation / invalid code / bad id |
| 401 | Missing or invalid token |
| 403 | Not owner/admin |
| 404 | Church or user not found |
| 500 | Server error |

Body shape: `{ "message": "Human readable error" }`

---

## Checklist for frontend dev

1. Replace mock arrays in `ChurchesScreen`, `DiscoverChurchesScreen` with `GET` list/discover.
2. On `CreateChurchScreen` submit → `POST /churches` → pass `church.id` to verify screen.
3. On verify → `POST /churches/:id/verify` with 5-digit `code`.
4. `EditChurchScreen` → `PATCH` + `DELETE`.
5. `ChurchDetailScreen` follow button → `POST /follow`; feed → `GET /posts?churchId=`.
6. Upload images before create/patch when picker is wired.
7. Use `isMyChurch` to show edit affordance; navigate to `EditChurch` with `church` from API.

For full auth, posts, and upload details see [`API.md`](./API.md).
