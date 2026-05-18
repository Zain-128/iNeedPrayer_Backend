# Groups API — Frontend Integration Guide

Base path: **`/api/groups`**

Auth: `Authorization: Bearer <token>` on protected routes.

---

## Screens → APIs

| Screen | API |
|--------|-----|
| `CommunityGroupsScreen` — Joined tab | `GET /api/groups?tab=joined` |
| `CommunityGroupsScreen` — My Groups tab | `GET /api/groups?tab=my` |
| `DiscoverGroupsScreen` | `GET /api/groups/discover?q=` |
| `CreateNewGroupScreen` — Continue | `POST /api/groups` |
| `InviteMembersScreen` — user list | `GET /api/groups/:id/invite-candidates` |
| `InviteMembersScreen` — Done | `POST /api/groups/:id/invite` |
| `GroupDetailScreen` — detail | `GET /api/groups/:id` |
| `GroupDetailScreen` — Join | `POST /api/groups/:id/join` |
| `GroupDetailScreen` — Leave | `POST /api/groups/:id/leave` |
| `GroupDetailScreen` — Invite | navigate to InviteMembers with real `groupId` |
| Group feed posts | `GET /api/posts?groupId=:id` |

---

## Recommended create + invite flow

### 1) `CreateNewGroupScreen` — Continue

```http
POST /api/groups
Authorization: Bearer <token>
```

```json
{
  "groupName": "Prayer Warriors Group",
  "image": "https://cdn.example.com/group-cover.jpg",
  "description": ""
}
```

UI field `groupName` maps to `name`. Image is optional (upload first via `POST /api/upload/image?kind=group`).

**Response** `201`

```json
{
  "group": {
    "id": "665f...",
    "name": "Prayer Warriors Group",
    "membersLabel": "1 members",
    "memberCount": 1,
    "image": "https://...",
    "description": "",
    "isMyGroup": true,
    "isJoined": true,
    "isMember": true,
    "createdBy": "665a...",
    "myRole": "owner",
    "isCreatorOrAdmin": true
  }
}
```

Navigate to InviteMembers with **`group.id`** (not `g_${Date.now()}`).

### 2) `InviteMembersScreen` — load users

```http
GET /api/groups/:groupId/invite-candidates?q=john
Authorization: Bearer <token>
```

**Response** `200`

```json
{
  "users": [
    { "id": "665b...", "name": "John Smith", "avatar": "https://...", "email": "john@example.com" }
  ]
}
```

### 3) `InviteMembersScreen` — Done

```http
POST /api/groups/:groupId/invite
Authorization: Bearer <token>
```

```json
{
  "userIds": ["665b...", "665c..."]
}
```

Or by email:

```json
{
  "emails": ["friend@example.com"]
}
```

**Response** `200`

```json
{
  "invited": 2,
  "memberCount": 3,
  "membersLabel": "3 members"
}
```

---

## Group object

```json
{
  "id": "...",
  "name": "Prayer Warriors\nGroup",
  "membersLabel": "11k members",
  "memberCount": 11000,
  "image": "https://...",
  "description": "",
  "isMyGroup": true,
  "isJoined": true,
  "isMember": true,
  "createdBy": "userId"
}
```

| Flag | Meaning |
|------|---------|
| `isJoined` / `isMember` | You are a member (Joined tab) |
| `isMyGroup` | You created the group (My Groups tab) |

`GET /api/groups/:id` also returns:

```json
{
  "myRole": "owner",
  "isCreatorOrAdmin": true
}
```

Use `isCreatorOrAdmin` for “Go Live (Admin)” and Invite button visibility.

---

## List groups

```http
GET /api/groups?tab=joined
GET /api/groups?tab=my
GET /api/groups?q=prayer
GET /api/groups/mine
```

| Query | Description |
|-------|-------------|
| `tab=joined` | Groups you are a member of |
| `tab=my` | Groups you created |
| `q` | Search name/description |
| `mine=true` | Same as `tab=my` (legacy) |

**Response:** `{ "groups": [ ... ] }`

---

## Discover groups

Groups you are **not** a member of (`DiscoverGroupsScreen`).

```http
GET /api/groups/discover?q=
```

**Response:** `{ "groups": [ ... ] }`

Join button → `POST /api/groups/:id/join`

---

## Get / update / delete

```http
GET    /api/groups/:id
PATCH  /api/groups/:id
DELETE /api/groups/:id
```

**PATCH body** (owner or admin):

```json
{
  "groupName": "Updated Name",
  "image": "https://...",
  "description": "About this group"
}
```

**DELETE** — owner only.

---

## Join / leave

```http
POST /api/groups/:id/join
POST /api/groups/:id/leave
```

Leave returns `{ "ok": true, "memberCount": N }`. Owner cannot leave (must delete group).

---

## Members

```http
GET    /api/groups/:id/members
POST   /api/groups/:id/members
DELETE /api/groups/:id/members/:userId
PATCH  /api/groups/:id/members/:userId
```

**Add one member:**

```json
{ "userId": "665b...", "role": "member" }
```

or `{ "email": "user@example.com", "role": "admin" }`

Roles: `owner` (creator only), `admin`, `member`.

---

## Group posts

```http
GET  /api/posts?groupId=<groupId>
POST /api/posts
```

Body must include `groupId`; user must be a **member** (`403` otherwise).

---

## Image upload

```http
POST /api/upload/image?kind=group
```

Use returned URL in `image` when creating or updating a group.

---

## RTK Query sketch

```ts
createGroup: build.mutation({
  query: (body) => ({ url: '/groups', method: 'POST', body }),
}),
inviteCandidates: build.query({
  query: ({ id, q }) => ({ url: `/groups/${id}/invite-candidates`, params: { q } }),
}),
inviteToGroup: build.mutation({
  query: ({ id, userIds }) => ({
    url: `/groups/${id}/invite`,
    method: 'POST',
    body: { userIds },
  }),
}),
```

---

## Frontend checklist

1. `CreateNewGroupScreen`: `POST /groups` on Continue → pass real `group.id` to InviteMembers.
2. `InviteMembersScreen`: load `invite-candidates`; on Done call `POST .../invite` with selected `userIds`.
3. `CommunityGroupsScreen`: `tab=joined` / `tab=my` instead of mock `GROUPS`.
4. `DiscoverGroupsScreen`: `GET /discover` + `POST .../join`.
5. `GroupDetailScreen`: `join` / `leave`; show admin UI when `isCreatorOrAdmin`.

See also [`API.md`](./API.md) and [`CHURCHES_API.md`](./CHURCHES_API.md).
