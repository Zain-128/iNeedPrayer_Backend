# Live Stream API (mobile / app)

Single live stream per church or group, with Agora RTC video and Socket.io comments + hearts.

**Base path:** `/api/live`  
**Auth:** `Authorization: Bearer <user-token>` (start/stop/join/heartbeat/refresh require auth; status is optional auth)

**Scopes:** `church` | `group`

---

## REST

### Status

`GET /api/live/:scope/:entityId/status`

```json
{
  "isLive": true,
  "session": {
    "sessionId": "...",
    "channelName": "group_...",
    "title": "Creator Live",
    "status": "live",
    "viewerCount": 12,
    "likeCount": 340,
    "hostUserId": "...",
    "hostName": "...",
    "hostAvatar": "..."
  }
}
```

### Start (host / manager only)

`POST /api/live/:scope/:entityId/start`  
Body: `{ "title"?: string }`

Returns session + Agora publisher token: `token`, `uid`, `appId`, `expiresAt`, `role: "publisher"`, plus `likeCount`.

### Join (viewer)

`POST /api/live/:scope/:entityId/join`

Returns session + Agora subscriber token, `role: "subscriber"`.

### Stop (host / manager)

`POST /api/live/:scope/:entityId/stop`

### Heartbeat (host)

`POST /api/live/:scope/:entityId/heartbeat`  
Also emit socket `host-heartbeat` every ~15s while live.

### Refresh token

`POST /api/live/:scope/:entityId/refresh-token`

---

## Socket.io

Connect to the same API origin with:

```js
io(url, { auth: { token }, query: { token }, transports: ["websocket"] })
```

### Join room

`emit("join-live", { sessionId })`

Server replies:

- `live-history` — `{ sessionId, comments[], likeCount }`
- `viewer-count` — `{ sessionId, count }`

### Comments (batched ~400ms)

`emit("live-comment", { sessionId, text })`  
Rate limit: ~2s per user. Max length 280.

Receive: `live-comments-batch` — `{ sessionId, comments: [...] }`

### Hearts (batched ~250ms)

`emit("live-heart", { sessionId })`  
Soft rate limit ~80ms; excess taps are dropped quietly.

Receive: `live-hearts-batch` — `{ sessionId, count, delta, bursts: [{ userId, userName, avatar }] }`

`likeCount` is incremented in memory and flushed to Mongo every ~2s.

### Leave / end

`emit("leave-live", { sessionId })`  
Server may emit `stream-ended` when the host stops or the session goes stale.

### Scope subscription (optional)

`subscribe-live-scope` / `unsubscribe-live-scope` with `{ scope, entityId }` for `stream-started` / `stream-ended` on the church/group page.

---

## Mobile roles

| Entry | Role |
|-------|------|
| Church “Go to Live” (owner) | `host` → start |
| Church ticker / follower | `viewer` → join |
| Group menu “Go Live” (admin) | `host` → start |
| Group ticker | `viewer` → join |

Host gets local camera preview + mic/camera controls. Viewer subscribes to remote host video. Both share comments and hearts over the same session room.
