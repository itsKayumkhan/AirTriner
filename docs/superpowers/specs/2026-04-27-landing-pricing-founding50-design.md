# Landing Page Update — Pricing, Founding 50, Visual Posters

**Date:** 2026-04-27
**Scope:** `apps/web/src/app/page.tsx` + `apps/web/src/components/landing/HowItWorks.tsx` + new section components

## Goal

Client wants the landing page to:
1. Show **pricing** clearly for both Athletes and Trainers.
2. Show **how it works** for both sides (already exists, needs pricing context).
3. Let **guests browse trainers** but trigger sign-up wall on click (already works in code — verify only).
4. Add a **Founding 50** promotional section (first 50 coaches get free subscription + badge).
5. Add **full-width "poster" style images** between sections for visual impact.

## Source-of-truth pricing (from code)

| Item | Value | Source |
|---|---|---|
| Trainer Monthly | $25 USD | `api/stripe/create-checkout/route.ts:51` |
| Trainer Yearly | $250 USD (saves $50) | same, line 59 |
| Free Trial | 7 days | `dashboard/subscription/page.tsx:2` |
| Athlete commission | 3% per booking | `lib/fees.ts:16` |
| Trainer earnings | 100% of hourly rate | `lib/fees.ts` athlete-pays-all model |

Currency stays USD throughout (no INR conversion).

## Final landing page section order

```
1. Navbar (existing)
2. Hero (existing)
3. Stats strip (existing)
4. Elite Coaches slider (existing)
5. Browse by Sport (existing)
6. How It Works (existing — UPDATE copy with pricing context)
7. AirTrainr Advantage (existing)
8. ▶ NEW: Full-width poster banner #1 ("ATHLETES TRAIN. CHAMPIONS DOMINATE.")
9. ▶ NEW: Pricing section (two cards: Athletes / Trainers)
10. ▶ NEW: Full-width poster banner #2 (Founding 50 dramatic poster)
11. ▶ NEW: Founding 50 section
12. Platform Capabilities (existing)
13. FAQ (existing — ADD 2 new questions about pricing & Founding 50)
14. Reviews (existing)
15. Footer (existing — fix dead links)
```

Rationale: pricing comes after the user has seen value (How It Works + Advantage), and Founding 50 follows pricing as the natural "but wait, here's a deal" close. Poster banners frame the two new sections for emphasis.

## New components

All new content goes into separate files for clarity:

- `apps/web/src/components/landing/Pricing.tsx` — pricing section (two cards)
- `apps/web/src/components/landing/Founding50.tsx` — promo section
- `apps/web/src/components/landing/PosterBanner.tsx` — reusable full-width image banner with overlay text
- `apps/web/src/components/landing/landingImages.ts` — centralized image URL config (easy AI-image swap later)

`page.tsx` only imports and renders these — keeps the main file from growing further.

## Component specs

### `landingImages.ts`
Single export with all image URLs grouped:
```
export const LANDING_IMAGES = {
  posterAthletes: "<unsplash sports action shot>",
  posterFounding50: "<unsplash dramatic team/champion shot>",
  pricingAthlete: "<unsplash athlete training>",
  pricingTrainer: "<unsplash coach with stopwatch>",
  founding50Hero: "<unsplash close-up coaching moment>",
};
```
TODO comment at top: `// Replace with AI-generated brand posters when available.`

### `PosterBanner.tsx`
Props: `image`, `headline` (uppercase, italic accent on key word), `subheadline`, optional `cta` (label + href). Full viewport-width, ~400px tall on desktop / 280px on mobile, dark gradient overlay, centered text. Same styling DNA as the hero (var(--font-display), uppercase, primary color glow on accent word).

### `Pricing.tsx`
Two cards side-by-side (stack on mobile <968px):

**Card 1 — For Athletes**
- Header: "FOR ATHLETES"
- Big number: "FREE" / subtext: "to sign up & browse"
- Bullet checkmarks:
  - Browse 850+ verified coaches
  - Book sessions instantly
  - Only 3% platform fee per booking
  - Cancel anytime, no commitment
- CTA: "FIND A TRAINER" → `/dashboard/search`

**Card 2 — For Trainers** (visually emphasized: primary border, slightly larger, "MOST POPULAR" tag)
- Header: "FOR TRAINERS"
- Big numbers shown together: "$25/mo  ·  $250/yr" with "(save $50)" caption under yearly
- "Start with 7-day free trial" pill at top
- Bullet checkmarks:
  - Keep 100% of your hourly rate
  - Unlimited profile visibility to athletes
  - Smart scheduling & messaging tools
  - Cancel anytime
- CTA: "START FREE TRIAL" → `/auth/register?role=trainer`

Section heading above cards: "SIMPLE, FAIR PRICING" with the same `<div className="accent-bar" />` (60px primary line) treatment as other section headers.

### `Founding50.tsx`
Two-column layout (image left, content right; stacks on mobile):
- **Left:** image with offset/rotated frame style (similar to existing "Platform Capabilities" image card) + a floating badge card overlay reading "FOUNDING 50" in primary color.
- **Right:**
  - Eyebrow: "LIMITED OFFER" (primary color, small, uppercase)
  - Headline: "JOIN THE FOUNDING 50 COACHES"
  - Body: "We're hand-picking our first 50 trainers to shape AirTrainr. Founding members get a permanent **Founding 50** badge on their profile and **free subscription — forever**. No monthly fee, no yearly fee, ever."
  - Three perks with icons:
    - 🏅 Permanent "Founding 50" badge
    - 💸 Free subscription, lifetime
    - ⭐ Priority placement in search
  - CTA: "CLAIM YOUR FOUNDING SPOT" → `/auth/register?role=trainer&founding=1` (the `founding` query param is harmless if backend ignores it; it's a marker for future tracking — not a hard requirement for this spec)
  - Tiny disclaimer: "First 50 trainers to complete a verified profile. Subject to approval."

No counter, no timer per user's instruction.

## Updates to existing files

### `HowItWorks.tsx` (update copy only)
**Athletes step 3:** add `"...secure checkout — only 3% platform fee, no subscription."`
**Trainers step 1:** change to `"Set up your profile and start with a 7-day free trial. After that, $25/month or $250/year — keep 100% of your hourly rate."`

### `page.tsx` (FAQ section — append 2 questions)
- Q: "How much does it cost to use AirTrainr?"
  A: "Athletes pay nothing to sign up — we add a small 3% platform fee at checkout. Trainers get a 7-day free trial, then $25/month or $250/year (saving $50). Trainers keep 100% of their hourly rate."
- Q: "What is the Founding 50 program?"
  A: "Our first 50 verified trainers join as Founding Members — they get a permanent Founding 50 badge on their profile and a free lifetime subscription. No monthly or yearly fee, ever."

### `page.tsx` (footer Platform links — fix dead `href="#"`)
- "Find a Trainer" → `/dashboard/search`
- "Become a Trainer" → `/auth/register?role=trainer`
- "Browse Sports" → `#sports` (anchor exists)
- "Dashboard" → `/dashboard`

Add a fifth link: "Pricing" → `#pricing` (we'll give the new pricing section `id="pricing"`).

Other footer columns (Company, Legal) — out of scope for this change. Leave dead links as-is; client didn't ask.

## Browse-without-login flow (verification only, no code change)

- `/dashboard/search` — guest can land here directly. No redirect. ✓ Already works.
- Clicking a trainer card → `/dashboard/trainers/[id]` → `getSession()` returns null → `router.push("/auth/login")`. ✓ Already works.
- The hero "FIND A TRAINER" CTA already points to `/dashboard/search` for unauthenticated users (`page.tsx` line 457).

**No work needed here.** Just confirming during testing.

## Out of scope

- New `/pricing` route (everything inline on landing).
- Currency conversion (stays USD).
- Tier system / multiple plans beyond the existing single one.
- Real `founding=1` backend handling (hint param only, no DB changes).
- Counter or timer for Founding 50.
- Replacing Unsplash images with actual AI-generated assets — client will swap into `landingImages.ts` later.
- Stripe checkout flow changes.

## Testing plan

1. `npm run dev` in `apps/web`, visit `/` as a logged-out user.
2. Verify all new sections render and are responsive at 968px and 640px breakpoints.
3. Click "FIND A TRAINER" → lands on `/dashboard/search` without auth prompt.
4. Click any trainer card on `/dashboard/search` → redirects to `/auth/login`.
5. Click "START FREE TRIAL" / "CLAIM YOUR FOUNDING SPOT" → lands on `/auth/register` with correct query params.
6. Footer "Pricing" link → smooth scroll to pricing section.
7. FAQ — open the two new questions, confirm copy renders.
8. Run typecheck: `npm run typecheck` (or equivalent) — no new errors.
