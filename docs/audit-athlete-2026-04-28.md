# Athlete Audit — 2026-04-28

Web-side audit only. Mirror to mobile after web fixes ship.

> **Reading**: `[CRITICAL]` = ship-blocking, money/security/data-loss; `[HIGH]` = real damage; `[MEDIUM]` = UX/correctness drift; `[LOW]` = cosmetic.

> **Root cause to read first**: `docs/audit-trainer-2026-04-28.md` opens with the auth-root-cause explanation. Most CRITICALs below are the same root cause manifesting on athlete-side surfaces.

---

## CRITICAL

### Money flow

1. **payment-success page confirms ANY booking for ANY session_id** — `bookings/payment-success/page.tsx:14-21` + `verify-booking-payment/route.ts:20-90`. Route accepts `{sessionId, bookingId}` from body, never checks the caller, never verifies that `session.metadata.bookingId === bookingId`. **Repro**: athlete A pays for own booking, gets `cs_xxx`. Then crafts URL `?session_id=cs_xxx&booking_id=<victim_pending_id>`. Victim's pending booking flips to `confirmed` and a `payment_transactions` row is created against attacker's payment_intent. Trainer is notified, escrow timer starts on a session athlete A didn't pay for.

2. **`/api/stripe/refund-booking` accepts only bookingId; no auth** — `refund-booking/route.ts:21-30`. Any logged-in user can refund any paid booking from DevTools.

3. **`/api/stripe/create-booking-payment` body-trusted `athleteId`** — `create-booking-payment/route.ts:35-52`. Combined with #1, attacker confirms victim's booking using their own card; or sets `athleteId = victim` and pays anyway.

4. **`booking.price`, `total_paid`, `platform_fee` are written from the browser via direct Supabase insert** — `dashboard/trainers/[id]/page.tsx:683-705`. **Repro**: in DevTools, override fees → insert booking with `price: 1, total_paid: 1`. `create-booking-payment` recomputes from the booking row, so attacker pays $1 for a $50 session.

### Booking authorization

5. **All booking mutations bypass authorization** — `dashboard/bookings/page.tsx:128-145`. Anon Supabase client + localStorage session = no JWT. Athlete A can `update bookings set status='completed' where id=<victim_booking>` from DevTools.

6. **Reviews insert is browser-side; reviewer_id pulled from localStorage** — `bookings/page.tsx:188-205`. No server check that booking belongs to reviewer or that status is `completed`. **Repro**: tank a trainer you've never trained with by inserting a 1-star review. Duplicate-review check is a JS race.

7. **`trainer_profiles.average_rating` recomputed client-side** — `bookings/page.tsx:209-214`. Direct UPDATE from athlete's anon client. Competing trainers can boost or sabotage each other.

8. **Messages insert has no booking ownership check** — `messages/page.tsx:185-192`. Repro: insert `messages` row with any `booking_id`. Realtime subscription `event:"*"` with no filter — if RLS SELECT isn't tight, every athlete receives every INSERT.

---

## HIGH

9. **State-machine drift** — `bookings/page.tsx` cancel/reschedule/review on terminal/past sessions. Athlete can cancel a `completed` booking → refund fires on already-released funds (combined with admin-side bug). No transition guard.

10. **No webhook fallback verification** — `verify-booking-payment` is the only path that creates `payment_transactions`. If athlete closes the tab after Stripe redirect but before the page mounts, payment captured at Stripe but no DB row. Trainer not notified, hold timer never starts.

11. **Duplicate-payment trap** — `create-booking-payment/route.ts:62-70` rejects if `payment_transactions` already exists, but verify-booking-payment is the only creator of that row. Tab-close-mid-flow → second Pay Now creates second checkout, athlete double-charged, first capture orphaned.

12. **Notification body interpolates booking.sport raw** — `bookings/page.tsx:165-180`. Athletes write `sport` at booking insert. **Repro**: insert booking with `sport: '<script>alert(1)</script>'` — current renderers escape but any future HTML render path XSSes the trainer.

13. **`bookings.cancellation_reason` propagates verbatim into trainer notification body** — `refund-booking/route.ts:118`. Same XSS / phishing surface.

14. **`/dashboard/trainer/[id]` (singular) gating inconsistent with `/dashboard/trainers/[id]` (plural)** — singular reads `require_trainer_verification` flag, plural doesn't. If admin disables the flag, plural route exposes profiles the singular route also exposes — different gates per URL.

15. **`trainerPublicGate` runs only at payment submit, not at `bookings.insert`** — Athletes can create `pending` booking against a suspended/unsubscribed trainer; only payment is blocked. Junk pending rows accumulate.

16. **Self-booking guard is client-only** — `trainers/[id]/page.tsx:558-562`. `supabase.from('bookings').insert({athlete_id: me, trainer_id: me})` from console succeeds if RLS allows.

17. **Double-booking guard is client-only and races** — `trainers/[id]/page.tsx:631-655`. SELECT-then-INSERT, no DB unique constraint. Two athletes booking same slot in parallel both pass.

18. **`getSession()` doesn't check `verifySessionStatus`** — `lib/auth.ts:54`. Suspended athletes keep using the app until logout/login.

---

## MEDIUM

19. **Trainer profile loads athlete-visible PII** — `trainers/[id]/page.tsx:496-502` selects `phone, date_of_birth, is_suspended, deleted_at`. Athletes see trainer's phone + DOB via network tab even though UI doesn't render them.

20. **Messages realtime channel `event:"*"` no filter** — `messages/page.tsx:84-86`. If RLS SELECT not tight, every athlete receives every INSERT.

21. **No anti-replay on Stripe `session_id`** — `verify-booking-payment` doesn't bind `session.metadata.bookingId` to URL `bookingId`. Two-checkout in two-tabs swap → confirm wrong booking against right session.

22. **`booking.status_history` overwritten to 2-element array** — `verify-booking-payment/route.ts:80-86`. Audit trail lost.

23. **`email_verified` defaulted to false, never re-checked** — `lib/auth.ts:202`. Unverified accounts can book and pay.

24. **Sub-accounts soft-delete leaves PII** — Children name/age remains in DB indefinitely with no purge.

25. **CalendarDate window hard-coded 60 days** — `trainers/[id]/page.tsx`. Long-lead bookings invisible.

---

## LOW

26. Refund failure leaves UI/state inconsistent — `bookings/page.tsx:130-134`. Optimistic update doesn't roll back on error.
27. Random sport cover image on every render flickers — `getSportCover`/`getSportImage`.
28. Sub-accounts schema CREATE TABLE blob in client UI when DB not migrated — `sub-accounts/page.tsx:280-300`.

---

## Top 5 to fix first

1. **Lock down `/api/stripe/verify-booking-payment` and `/refund-booking`**: require server-side auth, verify `session.metadata.bookingId === bookingId`, verify session.metadata.athleteId === caller, verify booking ownership before refund. Single highest-leverage fix.
2. **Add real Supabase JWT auth on the web client** (use `signInWithPassword` session, not a localStorage shim) so RLS can actually protect `bookings`, `reviews`, `messages`, `trainer_profiles`, `users`. Collapses 6+ CRITICALs.
3. **Move booking creation, cancel, reschedule, and review writes to authenticated `/api/*` routes** that derive the actor from cookie/JWT, validate state-machine transitions, reject athlete-supplied `price`/`total_paid`/`status`.
4. **Add Stripe webhook as the source of truth** for `payment_transactions` and booking confirmation; make the success page idempotent UI-only. Removes the abandoned-checkout and double-charge holes.
5. **Server-side gate on `bookings.insert`**: enforce `trainerPublicGate`, self-booking block, double-booking, and `price = priceFor(trainer.session_pricing, durationMinutes)` server-side so athletes can never write `price`.
