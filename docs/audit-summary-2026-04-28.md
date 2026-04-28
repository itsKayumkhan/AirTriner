# Audit Summary — 2026-04-28

Three deep audits run in parallel: trainer, athlete, admin. Findings spread across `audit-trainer-2026-04-28.md`, `audit-athlete-2026-04-28.md`, `audit-admin-2026-04-28.md`.

## The single highest-priority finding

**localStorage-based session + anon Supabase client + body-trusted `userId` in API routes = no real authorization on most paths.**

This one architectural issue spawns ~80% of the CRITICALs across all three audits. Specifically:

- The web client uses a custom `airtrainr_session` JSON blob in localStorage (set by `lib/auth.ts`). It never hands a real Supabase JWT to the Supabase client (which is initialized with the anon key only).
- Most `/api/*` routes read `userId` / `athleteId` / `bookingId` from the request body and trust those values without a server-side session check.
- Most dashboard pages call `supabase.from(...).insert/update/delete` directly from the browser.
- RLS policies of the form `WHERE auth.uid() = user_id` cannot fire because `auth.uid()` is null without a JWT.
- The `airtrainr_uid` cookie is unsigned — anyone can forge it (admin spoof + caller-identity bypass).

Result: any authenticated user can refund another user's booking, confirm a victim's pending booking using their own card, mutate any `trainer_profiles` row, leave fake reviews, tamper booking `price`, spoof admin and release payouts, etc.

## Recommended fix sequence (in order — each enables the next)

### Phase A — Authentication foundation (1-2 days)
1. Replace localStorage session with a real Supabase JWT-based session (use `signInWithPassword` and let `@supabase/ssr` manage the cookie).
2. Build `requireSession(req)` server helper that returns `{ userId, role }` from the supabase auth cookie. Pair with `requireAdmin` (already exists).
3. HMAC-sign `airtrainr_uid` cookie OR retire it in favor of the supabase auth cookie.
4. Audit RLS policies on `bookings`, `messages`, `reviews`, `trainer_profiles`, `users` — every table where browser writes happen.

### Phase B — Money path hardening (1 day, blocks Phase A)
5. Webhook fail-closed when `STRIPE_WEBHOOK_SECRET` missing in any environment; return 5xx on internal errors so Stripe retries.
6. Webhook becomes the source of truth for `payment_transactions` and `bookings.status='confirmed'`. Make payment-success page idempotent UI-only.
7. `verify-booking-payment` must verify `session.metadata.bookingId === bookingId` AND `session.metadata.athleteId === caller`.
8. `refund-booking`, `release-single-payout`, `release-payouts` all use `requireAdmin` + caller ownership check.
9. Booking insert moved to `/api/booking/create` route that derives actor from cookie, computes `price` server-side via `priceFor(trainer.session_pricing, durationMinutes)`, validates self-booking, double-booking, and `trainerPublicGate`.

### Phase C — State machine + integrity (0.5 day)
10. Booking state-machine helper with allowed transitions. Reject impossible flips at the API layer.
11. Review insert via authenticated route with booking ownership + `status='completed'` + `reviewer_id = caller` + duplicate guard.
12. Disputes "Resolve" path moved to API route with `requireAdmin` + transfer reversal when `released`.

### Phase D — Mobile mirror (1 day)
Once web is hardened, mirror the same patterns to mobile (`airtrainerapp/`):
- Use `supabase.auth.signInWithPassword` properly and persist the session via SecureStore.
- Replace direct Supabase mutations with calls to the new `/api/*` routes from web.
- Mirror gate helpers + price computation.

## Per-audit drill-down

- **Trainer**: 96 items found. Top clusters: auto-approve string mismatch silently dead, soft-delete login leak, profile-image moderation gap, sports array case mismatch, founding-50 cap race, Stripe webhook signature bypass on missing env, camp spots oversold race.
- **Athlete**: 28 items found. Top clusters: payment-success cross-booking confirmation, browser-tampered booking price, anon UPDATE on `trainer_profiles.average_rating`, message/review insert without ownership check.
- **Admin**: 19 items found. Top clusters: unsigned admin cookie spoof, disputes "Resolve" bypasses API entirely, reconcile global-recent-N session paging, founding-50 grant via direct UPDATE.

## What this means for production

The web app is currently shipping with material money-path holes. Anyone willing to open DevTools can:

- Refund any booking
- Confirm someone else's booking with their own card
- Manipulate trainer ratings
- Forge admin and release payouts
- Underpay for sessions

These are not theoretical — each has a one-line repro listed in the per-role doc.

## What this means for App Store / Play Store

Mobile app cannot ship to stores in current shape — many of the same client-side trust patterns exist in mobile (e.g. price computed in mobile UI, posted to anon API). Apple/Google will not flag these (they don't audit business logic) but real users will.

## Files

- `docs/audit-trainer-2026-04-28.md`
- `docs/audit-athlete-2026-04-28.md`
- `docs/audit-admin-2026-04-28.md`
- `docs/audit-summary-2026-04-28.md` (this)
- Memory: `project_auth_root_cause.md` (carries across sessions)
