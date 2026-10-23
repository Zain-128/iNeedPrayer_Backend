# Admin Churches API

Manage churches from the admin dashboard.

**Base path:** `/api/admin`  
**Auth:** `Authorization: Bearer <admin-token>` (all endpoints below)

Dashboard page: `/churches`  
Church profile: `/church/[id]`

---

## Shared list response

```json
{
  "data": [ ... ],
  "meta": { "page": 1, "limit": 20, "total": 50, "totalPages": 3 },
  "stats": { "total": 50, "approved": 40, "pending": 5, "suspended": 5 }
}
```

### Common query keys

| Key | Type | Required | Default | Description |
|-----|------|----------|---------|-------------|
| `page` | number | No | `1` | Page number |
| `limit` | number | No | `20` | Page size (max `100`) |
| `search` | string | No | — | Matches `name`, `email`, `city`, `country`, `pastorName` |
| `status` | string | No | — | `Approved` \| `Pending` \| `Suspended` \| `Rejected` |
| `type` | string | No | — | `Physical` \| `Online` \| `Both` |

---

## List Churches

**Endpoint:** `GET /api/admin/churches`  
**Payload:** none

### Church list item (`data[]`)

| Key | Type | Description |
|-----|------|-------------|
| `id` | string | Church id |
| `name` | string | Church name |
| `email` | string | Contact email |
| `pastor` | string | Pastor name |
| `type` | string | `Physical` \| `Online` \| `Both` |
| `followers` | number | Follower count |
| `city` | string | City or `"—"` |
| `country` | string | Country or `"—"` |
| `status` | string | `Approved` \| `Pending` \| `Suspended` |
| `logo` | string | Logo/image URL |
| `createdAt` | string | e.g. `"Mar 03, 2026"` |

**Example:**
```http
GET /api/admin/churches?status=Pending&type=Online&search=grace
Authorization: Bearer <token>
```

---

## Get Church

**Endpoint:** `GET /api/admin/churches/:id`  
**Payload:** none

### Response `200`

```json
{
  "church": {
    "id": "...",
    "name": "Grace Community Church",
    "email": "grace@mail.com",
    "phone": "+1 555 0100",
    "type": "Both",
    "status": "Approved",
    "pastor": "Pastor John Miller",
    "pastorEmail": "john@grace.com",
    "pastorPhone": "",
    "pastorBio": "",
    "denomination": "Non-denominational",
    "language": "",
    "country": "USA",
    "state": "TX",
    "city": "Dallas",
    "shortLocation": "Dallas, TX",
    "fullAddress": "123 Main St",
    "website": "https://grace.com",
    "about": "A welcoming community...",
    "vision": "",
    "mission": "",
    "members": 120,
    "followers": 1240,
    "logo": "https://...",
    "banner": "https://...",
    "createdAt": "Mar 03, 2026",
    "updatedAt": "Mar 05, 2026"
  }
}
```

**Errors:**
- `400` `{ "message": "Invalid id" }`
- `404` `{ "message": "Church not found" }`

---

## Create Church

**Endpoint:** `POST /api/admin/churches`

### Payload

| Key | Type | Required | Description |
|-----|------|----------|-------------|
| `name` | string | Yes | Church name |
| `email` | string | No | Contact email |
| `phone` | string | No | Phone |
| `type` | string | No | `Physical` (default) \| `Online` \| `Both` |
| `status` | string | No | `Approved` (default) \| `Pending` \| `Suspended` \| `Rejected` |
| `pastor` | string | No | Pastor name (alias: `pastorName`) |
| `pastorEmail` | string | No | Pastor email |
| `pastorPhone` | string | No | Pastor phone |
| `pastorBio` | string | No | Pastor bio |
| `denomination` | string | No | Denomination |
| `country` | string | No | Country |
| `state` | string | No | State |
| `city` | string | No | City |
| `shortLocation` | string | No | Short location label |
| `fullAddress` | string | No | Full address |
| `website` | string | No | Website URL |
| `about` | string | No | About text |
| `logo` | string | No | Logo URL (alias: `image`) |
| `banner` | string | No | Banner URL |
| `members` | number | No | Member count (default `1`) |

```json
{
  "name": "Grace Community Church",
  "email": "grace@mail.com",
  "type": "Both",
  "status": "Pending",
  "pastor": "Pastor John Miller",
  "country": "USA",
  "city": "Dallas",
  "about": "Welcome to our church.",
  "logo": "https://cdn.example.com/logo.jpg"
}
```

### Response `201`

```json
{ "church": { ... } }
```

**Errors:**
- `400` `{ "message": "name is required" }`

---

## Update Church

**Endpoint:** `PATCH /api/admin/churches/:id`

Same fields as **Create Church** — all optional. Only sent fields are updated.

### Response `200`

```json
{ "church": { ... } }
```

---

## Delete Church

**Endpoint:** `DELETE /api/admin/churches/:id`  
**Payload:** none

### Response `200`

```json
{ "message": "Church deleted", "id": "..." }
```

---

## Approve Church

**Endpoint:** `POST /api/admin/churches/:id/approve`  
**Payload:** none

Sets status to `Approved`.

### Response `200`

```json
{ "id": "...", "status": "Approved", "message": "Church approved" }
```

---

## Suspend Church

**Endpoint:** `POST /api/admin/churches/:id/suspend`  
**Payload:** none

Sets status to `Suspended`.

### Response `200`

```json
{ "id": "...", "status": "Suspended", "message": "Church suspended" }
```

---

## Unsuspend Church

**Endpoint:** `POST /api/admin/churches/:id/unsuspend`  
**Payload:** none

Sets status back to `Approved`.

### Response `200`

```json
{ "id": "...", "status": "Approved", "message": "Church approved" }
```

---

## Dashboard screens → APIs

| Screen | API |
|--------|-----|
| `/churches` list | `GET /api/admin/churches` |
| `/churches` create | `POST /api/admin/churches` |
| `/church/[id]` detail | `GET /api/admin/churches/:id` |
| Edit church | `PATCH /api/admin/churches/:id` |
| Approve | `POST /api/admin/churches/:id/approve` |
| Suspend | `POST /api/admin/churches/:id/suspend` |
| Unsuspend | `POST /api/admin/churches/:id/unsuspend` |
| Delete | `DELETE /api/admin/churches/:id` |
