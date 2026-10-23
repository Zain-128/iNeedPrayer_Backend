# Admin Settings API

**Base path:** `/api/admin`  
**Auth:** `Authorization: Bearer <admin-token>`

Dashboard page: `/settings`

Settings are key-value pairs organized by category. The admin can read and update app-wide configuration.

---

## Get all settings

`GET /api/admin/settings`

**Query:** `category` (optional)

Returns a key-value map of all settings, optionally filtered by category.

**Response:**
```json
{
  "siteName": "INeedPrayer",
  "maintenanceMode": false,
  "maxUploadSizeMB": 10,
  "defaultLanguage": "en"
}
```

---

## Get settings by category

`GET /api/admin/settings?category=notifications`

**Categories:** `general` | `notifications` | `security` | `payments` | `appearance`

---

## Update settings

`PATCH /api/admin/settings`

```json
{
  "category": "general",
  "siteName": "INeedPrayer",
  "maintenanceMode": false,
  "maxUploadSizeMB": 10
}
```

The `category` field determines which category the keys belong to. All other fields are key-value pairs to upsert.

**Response:**
```json
{
  "siteName": "INeedPrayer",
  "maintenanceMode": false,
  "maxUploadSizeMB": 10
}
```

---

## Get notification settings

`GET /api/admin/settings/notifications`

Shortcut for `GET /api/admin/settings?category=notifications`.

---

## Update notification settings

`PATCH /api/admin/settings/notifications`

```json
{
  "pushEnabled": true,
  "emailNotifications": false,
  "quietHoursStart": "22:00",
  "quietHoursEnd": "07:00"
}
```

All fields are upserted under the `notifications` category.

---

## Delete a setting

`DELETE /api/admin/settings/:key`

Not exposed via routes yet. Use `PATCH` to set a value to `null` to effectively disable it.
