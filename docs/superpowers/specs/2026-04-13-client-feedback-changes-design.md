# Client Feedback Changes — Design Spec (eadie1989, Apr 12 2026)

This spec covers the 9 changes requested by client `eadie1989` on Apr 12, 2026.
Each change includes target files, schema delta, and approach.

## Cross-cutting principles

- **Graceful degradation:** All third-party integrations (LocationIQ for geocoding, etc.) MUST work without API keys. When a key is missing, the feature falls back to a plain text input + manual entry. No runtime errors, no console spam beyond a single info-level "key not configured, using fallback" log.
- **Provider abstraction:** Build a small `lib/location` module with a `geocode()` and `autocomplete()` interface. Default impl uses LocationIQ (5K/day free). Easy to swap to Google Places later by changing one file.
- **Map rendering:** Reuse the existing Leaflet + CartoDB stack already used in `components/admin/LocationMap.tsx`. No new map library.
- **Migrations:** All new migrations go in `apps/web/supabase/migrations/` with timestamp `20260413xxxxxx_<name>.sql`. Use `ADD COLUMN IF NOT EXISTS` and check existing patterns.
- **Existing patterns to reuse:**
  - Trainer image approval = same pattern as document verification (NEW-18) in `admin/trainers/page.tsx` modal.
  - `sessionLengths: number[]` already exists in `trainer/setup/page.tsx` state — extend it, don't replace.
  - `trainer_profiles` already has `latitude`, `longitude`, `city`, `state`.

## Country detection (shared utility)

Create `apps/web/src/lib/units.ts`:
- `detectCountry(zipOrPostal: string): "US" | "CA" | "OTHER"`
  - 5-digit numeric → `"US"`, Canadian postal pattern (A1A 1A1) → `"CA"`
- `radiusUnit(country): "mi" | "km"` — US → mi, CA → km, default mi
- `formatRadius(value, country): string` — "25 mi" or "40 km"
- `kmToMi(km)`, `miToKm(mi)` helpers

---

## Change 1 — Trainer custom session duration + multi-day camps

**Files:** `apps/web/src/app/dashboard/trainer/setup/page.tsx`
**Migration:** `20260413000001_add_camp_durations.sql`

State `sessionLengths: number[]` already exists. Currently shows fixed pills (30/45/60/90/120). Replace with:
- Existing presets shown as toggleable chips: 30, 45, 60, 90, 120 min
- "Custom duration" input — number input (in minutes), with shortcut buttons "+ Add 3-hour", "+ Add 4-hour"
- New section **"Multi-Day Camp Offerings"** (optional):
  - Camp name (text)
  - Hours per day (number)
  - Number of days (number)
  - Total price
  - Stored as JSON array `camp_offerings jsonb` on `trainer_profiles`

Migration:
```sql
ALTER TABLE trainer_profiles ADD COLUMN IF NOT EXISTS camp_offerings jsonb DEFAULT '[]'::jsonb;
```

---

## Change 2 — Trainer recurring weekly availability

**Files:** `apps/web/src/app/dashboard/availability/page.tsx`
**Migration:** `20260413000002_add_recurring_availability.sql`

Currently each slot is per-day. Add ability to set "I'm always available Mon-Fri 9am-5pm":

- Add toggle at top of page: **"Recurring Weekly Schedule"** vs **"Per-Slot"** (current behavior).
- In recurring mode: show 7-day grid with 2 time inputs per day (start, end), or "Off". One save = generates slots for next 12 weeks (or marks as recurring).
- New table:
```sql
CREATE TABLE IF NOT EXISTS availability_recurring (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trainer_id uuid NOT NULL REFERENCES trainer_profiles(id) ON DELETE CASCADE,
  day_of_week int NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  start_time time NOT NULL,
  end_time time NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (trainer_id, day_of_week)
);
```
- When loading available slots for athletes, query both `availability_slots` AND `availability_recurring` (recurring rules expanded into virtual slots for the next 8 weeks).
- Existing per-slot logic stays untouched as fallback.

---

## Change 3 — Trainer profile image with admin approval

**Files:**
- `apps/web/src/app/dashboard/trainer/setup/page.tsx` (upload UI)
- `apps/web/src/app/admin/trainers/page.tsx` (approval modal — extend existing docs modal pattern)
- New API: `apps/web/src/app/api/admin/approve-trainer-image/route.ts`

**Migration:** `20260413000003_add_profile_image_approval.sql`
```sql
ALTER TABLE trainer_profiles
  ADD COLUMN IF NOT EXISTS profile_image_url text,
  ADD COLUMN IF NOT EXISTS profile_image_status text DEFAULT 'none' CHECK (profile_image_status IN ('none','pending','approved','rejected')),
  ADD COLUMN IF NOT EXISTS profile_image_rejection_reason text;
-- Storage bucket needed: 'trainer-profile-images' (mirror verification-documents pattern)
```

Trainer setup page:
- Image picker (drag-drop or click). Upload to Supabase storage bucket `trainer-profile-images`.
- After upload, set `profile_image_url` + `profile_image_status = 'pending'`.
- Show status banner: "Pending admin approval", "Approved", or "Rejected: <reason>".

Admin trainers page:
- New tab/filter: **"Image Approval"** (alongside Pending/Verified/Declined).
- Modal mirrors existing docs verification modal: shows preview, Approve / Reject (with reason) buttons.
- Only `profile_image_status = 'approved'` images shown publicly on trainer cards.

---

## Change 4 — Location autocomplete (city/town with state/country confirmation)

**New files:**
- `apps/web/src/lib/location/index.ts` — provider interface
- `apps/web/src/lib/location/locationiq.ts` — LocationIQ impl
- `apps/web/src/lib/location/fallback.ts` — no-op (returns empty)
- `apps/web/src/components/forms/LocationAutocomplete.tsx` — reusable input

**Touched:**
- `apps/web/src/app/dashboard/profile/page.tsx` (athlete city/state)
- `apps/web/src/app/dashboard/trainer/setup/page.tsx` (trainer city/state)
- `apps/web/src/app/auth/register/page.tsx` (if location collected at signup)

`LocationAutocomplete` props:
- `value: { city, state, country, lat, lng } | null`
- `onChange(loc)`
- `placeholder`

Behavior:
- If `NEXT_PUBLIC_LOCATIONIQ_KEY` env is set: typeahead dropdown with city + state + country results. Selecting fills lat/lng.
- If env missing: behaves as plain text input. User can still type a city manually. lat/lng stays null.

Env var (added to `.env.example`):
```
NEXT_PUBLIC_LOCATIONIQ_KEY=
```

---

## Change 5 — Calendar green highlight for available booking dates

**File:** `apps/web/src/app/dashboard/trainers/[id]/page.tsx` (and any reused Calendar component)

When athlete views a trainer's calendar:
- Compute set of dates with at least one bookable (non-blocked, non-booked) slot in the next 60 days.
- Date cells with availability get `bg-emerald-500/15 border-emerald-500/30 text-emerald-300` (matches existing emerald palette in admin LocationMap).
- Today + selected date keep their existing highlights — green is layered as background.
- Tooltip on hover: "X slots available".

No schema change.

---

## Change 6 — Hybrid US/Canada address form

**File:** `apps/web/src/app/dashboard/profile/page.tsx`

Current form fields: `addressLine1`, `city`, `state`, `zipCode`.
Changes:
- Rename **State** label → **State / Province** (data field stays `state`, accepts free text — drop strict US state validation if any)
- Rename **ZIP code** label → **ZIP / Postal Code** (data field stays `zipCode`, accept both formats)
- Add validation: US `^\d{5}(-\d{4})?$` OR Canada `^[A-Za-z]\d[A-Za-z][ -]?\d[A-Za-z]\d$`
- Detect country from format → store derived `country` (not a new column required if we always derive on the fly via `lib/units.ts`).

No schema change required (existing columns accommodate both).

---

## Change 7 — Auto KM/Miles based on country

**Files:**
- `apps/web/src/app/dashboard/profile/page.tsx` (radius input label)
- `apps/web/src/app/dashboard/search/page.tsx` (radius slider/display)
- `apps/web/src/lib/units.ts` (helpers)

Anywhere `travel_radius` or "Radius (miles)" is shown:
- Detect athlete's country via `detectCountry(zipCode)`.
- Show `"Radius: 40 km"` or `"Radius: 25 mi"` accordingly.
- Internal storage stays in **miles** (no DB migration). Display layer converts.

---

## Change 8 — Multiple sports for family members (max 3)

**File:** `apps/web/src/app/dashboard/sub-accounts/page.tsx`
**Migration:** `20260413000004_subaccount_multi_sport.sql`

Currently `profile_data.sport` is a single string. Change to array (max 3 entries).

Migration: no DDL needed (it's `jsonb`), but write a one-time data migration:
```sql
-- One-shot: convert single-sport string to array
UPDATE sub_accounts
SET profile_data = jsonb_set(profile_data, '{sports}', to_jsonb(ARRAY[profile_data->>'sport']))
WHERE profile_data ? 'sport' AND NOT profile_data ? 'sports';
```

UI:
- Replace the single-select sport dropdown with multi-select chip picker (max 3 — disable additional chips after 3 selected).
- Validation: at least 1 sport required.
- Backwards compat: when reading, if `sports` array missing fall back to `[sport]`.

---

## Change 9 — Map view on Find Trainer page

**File:** `apps/web/src/app/dashboard/search/page.tsx`
**New:** `apps/web/src/components/search/FindTrainerMap.tsx` (reuse Leaflet stack from `components/admin/LocationMap.tsx`)

Add view toggle at top of search results: **List | Map**.

Map view:
- Leaflet map centered on athlete location (or US center if unknown).
- Trainer pins (only those with `latitude`/`longitude`).
- Click pin → popup with trainer name, sport, rating, "View profile" link.
- Pins clustered if zoomed out (use `leaflet.markercluster` if already in deps; otherwise simple grouping).
- Pulses for "available now" trainers (optional, basic version: just colored dots).
- All controls (sport filter, sort, etc.) work on both views.

---

## Implementation waves

**Wave 1 (parallel, no file overlaps):**
- A: `lib/units.ts` + `lib/location/*` + `LocationAutocomplete` component (foundation)
- B: Trainer setup edits (Changes 1 + 3 trainer-side)
- C: Availability recurring (Change 2)
- D: Sub-accounts multi-sport (Change 8)

**Wave 2 (parallel, depends on Wave 1):**
- E: Profile page (Changes 4 athlete-side, 6, 7)
- F: Admin trainers approval modal (Change 3 admin-side)
- G: Search page map + KM/Miles (Changes 7 search-side, 9)
- H: Trainer detail page calendar highlight (Change 5)

## Verification

After both waves: run `pnpm --filter web build` (or `npm run build` per local convention) and resolve any TS errors.
