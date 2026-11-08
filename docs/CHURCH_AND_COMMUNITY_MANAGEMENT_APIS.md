# Church & Community Management — Backend API Documentation
**Platform:** I Need Prayer  
**Date:** November 2, 2026  
**Status:** Implemented & Verified  

---

## 1. Architectural Distinction
* **Churches:** Function like a Facebook Page. Users **follow** churches (or are invited to follow). Churches do not have a Join Request or member admission workflow.
* **Communities / Groups:** Function like a Facebook Group. Users can join **Public** groups directly, while **Private** groups require **Join Requests** that must be approved or rejected by authorized staff.

---

## 2. Church Module

### 2.1 Church Follow Invitations

| Method | Endpoint | Description | Auth Required |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/churches/:id/invite-candidates` | Retrieve eligible friends to invite (excludes followers, staff, pending invites, blocked users). Supports optional `?q=` | Yes |
| `GET` | `/api/churches/:id/follow-invites` | Retrieve sent follow invitations for the church (`?status=all\|pending\|accepted\|declined\|cancelled`) | Yes (Staff) |
| `GET` | `/api/churches/follow-invites/received` | Retrieve follow invitations received by the current user | Yes |
| `POST` | `/api/churches/:id/invite` | Send batch follow invitations (`{ "userIds": ["id1", "id2"] }`) | Yes (Staff) |
| `POST` | `/api/churches/:id/follow-invites/:inviteId/accept` | Recipient accepts invitation, auto-follows church | Yes |
| `POST` | `/api/churches/:id/follow-invites/:inviteId/decline` | Recipient declines invitation | Yes |
| `DELETE` | `/api/churches/:id/follow-invites/:inviteId` | Cancel a pending sent invitation | Yes (Staff) |
| `POST` | `/api/churches/:id/follow-invites/:inviteId/resend` | Resend invitation and re-trigger notification | Yes (Staff) |
| `POST` | `/api/churches/:id/follow` | Toggle follow / unfollow church | Yes |
| `POST` | `/api/churches/:id/unfollow` | Explicitly unfollow church | Yes |
| `DELETE` | `/api/churches/:id/follow` | Explicitly unfollow church | Yes |

#### Sample Request Body: Batch Follow Invite
`POST /api/churches/:id/invite`
```json
{
  "userIds": ["67210214c77c68a4cb0211a1", "67210214c77c68a4cb0211a2"]
}
```

#### Sample Response: Received Follow Invites
`GET /api/churches/follow-invites/received`
```json
{
  "invites": [
    {
      "id": "67210214c77c68a4cb021199",
      "church": {
        "id": "67210214c77c68a4cb021188",
        "name": "Grace Community Church",
        "image": "https://cdn.ineedprayer.world/churches/grace.jpg",
        "bannerImage": "https://cdn.ineedprayer.world/churches/grace_banner.jpg",
        "locationShort": "Dallas, TX",
        "followerCount": 1250,
        "city": "Dallas",
        "state": "TX"
      },
      "invitedBy": {
        "id": "67210214c77c68a4cb021177",
        "name": "Pastor David",
        "avatar": "https://cdn.ineedprayer.world/avatars/david.jpg"
      },
      "status": "pending",
      "createdAt": "2026-11-02T10:00:00.000Z"
    }
  ]
}
```

---

### 2.2 Church Staff & Permission Management

| Method | Endpoint | Description | Auth Required |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/churches/:id/permissions` | Retrieve current user's role and granular permission flags | Yes |
| `GET` | `/api/churches/:id/role-limits` | Retrieve staff limits and remaining slots based on church subscription | Yes (Staff) |
| `GET` | `/api/churches/:id/staff` | List Owner, Admins, and Editors | Yes (Staff) |
| `POST` | `/api/churches/:id/staff` | Add new staff member (`admin` or `editor`) | Yes (Owner/Admin) |
| `PATCH` | `/api/churches/:id/staff/:userId` | Change staff member's role | Yes (Owner) |
| `DELETE` | `/api/churches/:id/staff/:userId` | Remove staff member (cannot remove owner) | Yes (Owner/Admin) |

#### Sample Response: Permissions
`GET /api/churches/:id/permissions`
```json
{
  "role": "owner",
  "permissions": {
    "isOwner": true,
    "canEditChurch": true,
    "canManageAdmins": true,
    "canManageEditors": true,
    "canManageFollowers": true,
    "canManageInvitations": true,
    "canManageEvents": true,
    "canManagePosts": true,
    "canManageLiveStreams": true,
    "canAccessAnalytics": true,
    "canManageWallet": true,
    "canManageWithdrawals": true,
    "canDeleteChurch": true
  }
}
```

#### Sample Response: Role Limits
`GET /api/churches/:id/role-limits`
```json
{
  "plan": "Standard",
  "limits": {
    "admins": {
      "max": 3,
      "current": 1,
      "remaining": 2
    },
    "editors": {
      "max": 5,
      "current": 1,
      "remaining": 4
    }
  }
}
```

---

### 2.3 Church Events Management

| Method | Endpoint | Description | Auth Required |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/churches/:id/events` | List events (`?filter=upcoming\|past\|all&status=published&page=1&limit=20`) | Optional |
| `POST` | `/api/churches/:id/events` | Create a new church event (notifies followers) | Yes (Staff) |
| `GET` | `/api/churches/:id/events/:eventId` | Get single event details | Optional |
| `PATCH` | `/api/churches/:id/events/:eventId` | Update church event | Yes (Staff) |
| `DELETE` | `/api/churches/:id/events/:eventId` | Delete church event | Yes (Staff) |

#### Sample Request Body: Create Event
`POST /api/churches/:id/events`
```json
{
  "title": "Sunday Worship Service",
  "description": "Join us for worship, prayer, and communion.",
  "eventDate": "2026-11-15T10:00:00.000Z",
  "startTime": "10:00",
  "endTime": "12:00",
  "timezone": "America/Chicago",
  "location": "Main Sanctuary",
  "eventType": "in_person",
  "coverImage": "https://cdn.ineedprayer.world/events/sunday_worship.jpg",
  "status": "published"
}
```

---

## 3. Community / Group Module

### 3.1 Community Join Requests & Invitations

| Method | Endpoint | Description | Auth Required |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/groups/join-requests/sent` | Retrieve join requests sent by the current user | Yes |
| `DELETE` | `/api/groups/:id/join-request` | Cancel pending join request for a group | Yes |
| `DELETE` | `/api/groups/join-requests/:requestId` | Cancel pending join request by request ID | Yes |
| `GET` | `/api/groups/:id/pending-join-requests` | Retrieve incoming join requests (for private groups) | Yes (Staff) |
| `POST` | `/api/groups/:id/join-requests/:userId/approve` | Approve join request (supports `:userId` or `:requestId`) | Yes (Staff) |
| `POST` | `/api/groups/:id/join-requests/:userId/reject` | Reject join request (supports `:userId` or `:requestId`) | Yes (Staff) |
| `GET` | `/api/groups/invites/received` | Retrieve group invitations received by current user | Yes |
| `GET` | `/api/groups/:id/invite-candidates` | Retrieve eligible friends to invite to group | Yes (Member) |

#### Sample Response: Sent Join Requests
`GET /api/groups/join-requests/sent`
```json
{
  "requests": [
    {
      "id": "67210214c77c68a4cb021155",
      "groupId": "67210214c77c68a4cb021144",
      "groupName": "Faith & Prayer Community",
      "groupImage": "https://cdn.ineedprayer.world/groups/faith.jpg",
      "status": "pending",
      "requestedAt": "2026-11-02T10:00:00.000Z"
    }
  ]
}
```

---

## 4. Live Stream Settings (Church, Community & Shared)

### 4.1 Direct Endpoints
* **Church:**
  * `GET /api/churches/:id/live-settings`
  * `PATCH /api/churches/:id/live-settings`
* **Community / Group:**
  * `GET /api/groups/:id/live-settings`
  * `PATCH /api/groups/:id/live-settings`

### 4.2 Shared Endpoints
* `GET /api/live-stream/settings?sourceType=church&sourceId=:id` *(or `sourceType=group`)*
* `PATCH /api/live-stream/settings` *(also mounted on `/api/live/settings`)*

#### Sample Request Body: Update Settings
`PATCH /api/live-stream/settings`
```json
{
  "sourceType": "church",
  "sourceId": "67210214c77c68a4cb021188",
  "settings": {
    "enabled": true,
    "allowedRoles": ["owner", "admin"],
    "liveChatEnabled": true,
    "superChatsEnabled": true,
    "donationsEnabled": true,
    "reactionsEnabled": true,
    "replayEnabled": true,
    "moderationEnabled": true
  }
}
```

#### Sample Response:
```json
{
  "message": "Live stream settings updated successfully",
  "settings": {
    "sourceType": "church",
    "sourceId": "67210214c77c68a4cb021188",
    "enabled": true,
    "allowedRoles": ["owner", "admin"],
    "liveChatEnabled": true,
    "superChatsEnabled": true,
    "donationsEnabled": true,
    "reactionsEnabled": true,
    "replayEnabled": true,
    "moderationEnabled": true
  }
}
```
