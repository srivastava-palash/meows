# Meows of Mumbai — Design Spec
**Date:** 2026-04-23

## Overview

A community map website where anyone can add photos of Mumbai's stray cats with their location. Each entry is one cat post — photo and location required, name and story optional. Someone can drop a photo with no words, or write a whole paragraph about their favourite street cat. Both are the same type of entry. Users open the site, see Mumbai's map with cat thumbnails pinned where they were spotted, and can read and discuss each one — no login required.

---

## Goals

- Make it easy for anyone (on mobile, standing on a Mumbai street) to add a cat in under a minute
- Let people browse Mumbai's stray cat community through an interactive map
- Build community around individual cats through optional stories and threaded comments
- Start with Mumbai, designed to expand to other cities later

---

## Stack

| Layer | Choice | Reason |
|---|---|---|
| Frontend | Next.js (App Router) | SSR for SEO — cat pages are shareable and Google-indexable |
| Map | Leaflet.js + OpenStreetMap | Free, open-source, excellent mobile support |
| Backend / DB | Supabase (PostgreSQL + PostGIS) | Native geospatial queries, built-in image storage |
| Auth | Custom — own `users` table + `iron-session` | Username + password only, no email, no external auth dependency |
| Hosting | Vercel | Free tier, zero-config Next.js deployment |

---

## Data Model

### `users` (optional accounts)
| Column | Type | Notes |
|---|---|---|
| id | uuid | Primary key |
| username | text | Unique, chosen at signup |
| password_hash | text | bcrypt hash — never store plaintext |
| created_at | timestamptz | Auto |

### `cats` (primary entity — one row per cat entry)
Each row is one cat post. A post always has a photo and location. Name and story are optional — both, one, or neither is fine.

| Column | Type | Notes |
|---|---|---|
| id | uuid | Primary key |
| photo_url | text | Full-res image in Supabase Storage |
| thumbnail_url | text | Auto-resized thumbnail (120×120px @2x) for map pins |
| photo_width | int | Original photo width in px |
| photo_height | int | Original photo height in px |
| lat | float8 | Latitude (kept for convenience / Leaflet) |
| lng | float8 | Longitude (kept for convenience / Leaflet) |
| location | geography(Point, 4326) | PostGIS column — used for all geo queries (ST_DWithin, spatial index) |
| location_name | text | Cached reverse-geocoded neighbourhood (e.g. "Bandra West") |
| name | text | Optional — cat's name or nickname |
| story | text | Optional — anything from one sentence to a full story |
| last_seen_at | timestamptz | Optional — when the cat was spotted |
| user_id | uuid | Optional FK to `users` — null for anonymous |
| is_approved | bool | Defaults true; admin can set false to hide |
| is_hidden | bool | Soft delete — hidden from map and detail page |
| report_count | int | Incremented on each user report |
| updated_at | timestamptz | Auto-updated on any change |
| created_at | timestamptz | Auto |

### `comments`
| Column | Type | Notes |
|---|---|---|
| id | uuid | Primary key |
| cat_id | uuid | FK to `cats` |
| text | text | Comment content |
| author_name | text | From `users.username` if logged in, else free-text or "anonymous" |
| user_id | uuid | Optional FK to `users` — null for anonymous |
| parent_id | uuid | Optional FK to `comments` — enables threading |
| is_hidden | bool | Soft delete — hidden from thread |
| report_count | int | Incremented on each user report |
| updated_at | timestamptz | Auto |
| created_at | timestamptz | Auto |

### `reports`
| Column | Type | Notes |
|---|---|---|
| id | uuid | Primary key |
| target_type | text | `'cat'` or `'comment'` |
| target_id | uuid | ID of the reported item |
| reason | text | Optional — what the user reported |
| created_at | timestamptz | Auto |

---

## Pages

### `/signup` and `/login`
- **Signup:** Choose a username + password. No email field. API route hashes password with bcrypt and inserts into `users`. Session cookie set via `iron-session`.
- **Login:** Username + password → bcrypt compare → session cookie.
- Both redirect to `/` on success.

### `/profile` — My Contributions (logged-in only)
- Lists all cats the user has added (thumbnails, date, location)
- Lists all comments they've posted with links back to the cat
- Accessible from navbar when logged in

### `/` — Map Homepage
- Full-screen Leaflet map centered on Mumbai
- Cat pins as circular thumbnail photos with orange border, positioned at **slightly rounded coordinates** (see Privacy section)
- Clustered pins (orange circle with count) when many cats are nearby — zoom to expand
- Clicking a pin shows a popup: thumbnail, name (if given), neighbourhood, story snippet (if any), "See more →" link
- "My Location" button (bottom-right) — uses browser Geolocation API to pan/zoom to user's position
- Orange navbar with cat count + "Add a Cat" button (+ username or "Login" link)

### `/cats/[id]` — Cat Detail Page
- Server-side rendered with Open Graph meta tags (`og:image`, `og:title`, `og:description`) for rich WhatsApp/Twitter previews
- Full-width cat photo
- Cat name if given (otherwise just the neighbourhood + date)
- Neighbourhood badge, spotted date
- Mini map showing **exact** location (only at this detail level — see Privacy)
- Story block if present (highlighted with orange left border) — if no story, the photo and comments stand alone
- Threaded comment section (HN/Reddit style, one level of nesting for MVP):
  - Optional author name (defaults to "anonymous")
  - "↩ Reply" inline under each comment
  - Report button (🚩) on each comment
  - Add comment form at bottom — no login required
- Report button on the cat post itself
- Back button to return to map

### `/add` — Add a Cat (3-step form)
- **Step 1 — Photo:** Tap to take photo (camera) or upload from gallery. Required. Client validates file type and size (max 10MB).
- **Step 2 — Location:** GPS auto-detects and drops a pin. User can drag to fine-tune. Nominatim reverse-geocodes to neighbourhood name (see Nominatim note). Required.
- **Step 3 — Details (all optional):** Cat name, story (free-form text, any length), last-seen date. Skip button visible — user can submit with just photo + location.
- Mobile-first, one step per screen with progress indicator.
- Rate limited: max 5 posts per IP per hour.

### `/admin` — Simple Admin View (protected)
- Table of cats sorted by `report_count desc` and most recent
- Toggle `is_hidden` per cat
- Table of comments with same controls
- Protected by a hardcoded admin password in env vars — not linked from anywhere public

---

## Key Behaviours

### One Entry Type
There is no distinction between a "sighting" and a "story". Every cat post lives in the `cats` table. A post can be:
- Just a photo + location (no name, no story) — valid and complete
- Photo + location + name — valid
- Photo + location + name + a long story — valid
- Photo + location + story but no name — valid

The detail page adapts: if there's no story, it simply doesn't render the story block. Name falls back to the neighbourhood + date as a title.

### Optional Accounts
Everything — adding cats, posting comments — works without an account. Accounts are opt-in.

**Auth approach:** Custom `users` table with bcrypt-hashed passwords. `iron-session` stores a signed, encrypted session cookie (httpOnly, Secure). No email involved — no password reset for MVP (users can create a new account if they forget).

**When logged in:** Navbar shows username. Comments and cats attributed to account. `/profile` lists contributions.

**When anonymous:** All features still work. Name field on comments is free-text or blank (→ "anonymous").

### Map Loading by Bounding Box
Cats are never fetched all at once. The map API accepts the current viewport bounds and returns only cats within that area.

**API:** `GET /api/cats?swLat=&swLng=&neLat=&neLng=`

**Trigger:** Leaflet fires a `moveend` event on every pan/zoom. The client debounces this (300ms) and sends the new bounds to the API. On first load, the initial Mumbai bounds are used.

**Query:**
```sql
SELECT id, thumbnail_url, lat, lng, name, location_name
FROM cats
WHERE location && ST_MakeEnvelope($swLng, $swLat, $neLng, $neLat, 4326)
AND is_hidden = false AND is_approved = true
LIMIT 200;
```

The `&&` operator uses the GIST spatial index — no full table scan. Limit of 200 pins per request; if the viewport is zoomed very far out, the cluster plugin handles visual density on the client.

**Caching:** Responses are cached at the Vercel Edge for 30 seconds — acceptable staleness for a community map, dramatically reduces DB load.

### PostGIS Geo Queries
The `location geography(Point, 4326)` column has a spatial index (GIST). The `lat`/`lng` float columns are kept for convenience (Leaflet, JSON serialisation) and are always written together with `location`.

### Privacy — Coordinate Rounding
On the map homepage, pin positions are displayed at **~100m precision** (coordinates rounded to 3 decimal places) to avoid pinpointing a private residence. Exact coordinates are stored at full precision and shown only on the `/cats/[id]` detail page mini-map.

### GPS + Manual Adjust
Browser Geolocation API auto-detects position and drops a pin. User drags to fine-tune. Works on desktop (less precise). Coordinates stored at full precision; display rounding happens at render time.

### Reverse Geocoding — Nominatim
Nominatim (free, OSM-based) converts coordinates to a neighbourhood name **once, at submission time**. Result cached in `location_name` — never called at read time. Respects Nominatim's 1 req/sec policy. For production scale, replace with a paid geocoding provider (Mapbox, Google, Pelias).

### Moderation
- Any visitor can report a cat post or comment with one tap. No login required. Report increments `report_count` and creates a row in `reports`.
- Items with `report_count >= 5` are automatically soft-hidden (`is_hidden = true`) pending admin review.
- Admin (`/admin`) can review and restore or permanently hide items.
- Rate limiting: 5 cat posts / 20 comments per IP per hour via Vercel Edge middleware.
- No CAPTCHA for MVP — add if abuse occurs at scale.

### Cat Clustering
Leaflet's `leaflet.markercluster` plugin groups nearby pins at low zoom into an orange numbered circle. Zooming in expands clusters into individual cat pins.

### Image Storage & Processing
Photos uploaded to Supabase Storage via a Next.js API route. `sharp` generates two versions: full-resolution (original) and a 120×120px thumbnail (retina-safe for 60px display pins). `photo_width` and `photo_height` stored for layout reservation (avoids CLS on load).

---

## Visual Design

- **Palette:** Orange/coral (`#ff6b35`) as primary, warm off-white backgrounds, rounded corners throughout
- **Tone:** Playful and warm — a celebration of Mumbai's cats, not a utility tool
- **Typography:** Bold weights for names, light for metadata
- **Map style:** Default OpenStreetMap tiles (clean, readable)
- **Mobile:** Fully responsive. The Add Cat flow is designed for someone standing on a street with one hand on their phone.

---

## Out of Scope (for now)

- Password reset / account recovery (create a new account if forgotten)
- Push notifications
- Multi-city support (Mumbai first, designed to expand)
- Likes / reactions on cats or comments
- Search / filter on the map
- Cat identity grouping (linking multiple posts to the same cat)

---

## Success Criteria

- A person on mobile can add a cat in under 60 seconds
- Cat detail pages render with correct OG tags for WhatsApp sharing
- The map loads with existing pins without a blank flash
- Adding cats and commenting work without any account
- Reported content is auto-hidden at threshold and reviewable by admin
- All geo queries use the PostGIS spatial index (no full table scans)
