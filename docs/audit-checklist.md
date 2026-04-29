# Audit Checklist

Tick each item once you've reproduced or confirmed it. One line per bug.

---

## P0 — Money / Security (test these first)

- [] **Refund without owning the booking**
  How to test: log in as any athlete → DevTools console → run
  `fetch('/api/stripe/refund-booking',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({bookingId:'<any-other-paid-booking-id>',cancelledBy:'athlete'})}).then(r=>r.json()).then(console.log)`.
  Expected (broken): 200 OK, refund issued.

- [ ] **Confirm someone else's booking using your own payment**
  How to test: pay for your own booking → on the success page, change the URL `booking_id` query param to a different pending booking → reload.
  Expected (broken): the OTHER booking flips to `confirmed`.
  File: `src/app/dashboard/bookings/payment-success/page.tsx`, `src/app/api/stripe/verify-booking-payment/route.ts`.

- [ ] **Underpay by tampering booking price in browser**
  How to test: on a trainer profile page, before clicking Book, in DevTools console run
  `supabase.from('bookings').insert({athlete_id:'<your-id>',trainer_id:'<trainer-id>',sport:'baseball',scheduled_at:'<future-iso>',duration_minutes:60,status:'confirmed',price:1,total_paid:1}).select()`
  → then trigger Pay Now flow.
  Expected (broken): Stripe charges $1 not $50.

- [ ] **Anyone can refund / release / dispute via direct Supabase calls**
  How to test: in DevTools, `supabase.from('bookings').update({status:'completed'}).eq('id','<any-other-booking-id>')`.
  Expected (broken): updates someone else's booking. (If RLS blocks → mark this OK.)

- [ ] **Admin spoof via cookie**
  How to test: log in as a regular user → DevTools → Application → Cookies → set `airtrainr_uid` to a known admin user_id → reload.
  Expected (broken): admin pages load.

- [ ] **Tamper trainer's average rating from console**
  How to test: log in as any athlete → DevTools →
  `supabase.from('trainer_profiles').update({average_rating:1.0,total_reviews:9999}).eq('user_id','<target-trainer-id>')`.
  Expected (broken): trainer's rating wiped.

---

## P1 — Real-money correctness (test next)

- [ ] **Stripe webhook signature bypass when secret env missing**
  How to test: deploy to a Vercel preview without `STRIPE_WEBHOOK_SECRET`. POST a forged checkout.session.completed body to `/api/stripe/webhook`.
  Expected (broken): platform processes the forged event, grants Pro / fakes payments.

- [ ] **Webhook returns 200 on internal error → no Stripe retry**
  How to test: point webhook at a state where DB insert will fail (e.g. duplicate key) → Stripe retries should fire but won't.
  File: `src/app/api/stripe/webhook/route.ts:586-588`.

- [ ] **Auto-approve writes wrong status string ("approved" vs "verified")**
  How to test: turn on `auto_approve_trainers` in admin settings → register a new trainer.
  Expected (broken): trainer's `verification_status` is `'approved'`, but search filter expects `'verified'` → trainer never publicly listed.
  File: `src/lib/auth.ts:252`.

- [ ] **Soft-deleted trainer can still log in**
  How to test: on a trainer account, click Delete Account → log out → log back in with same credentials.
  Expected (broken): login succeeds. Should fail.

- [ ] **Cancel a paid booking when refund API is failing**
  How to test: in DevTools intercept `/api/stripe/refund-booking` and force 500 → click Cancel on a paid booking.
  Expected (broken): booking flips to `cancelled` but no refund issued, athlete loses money.

- [ ] **Mark booking complete before session ends**
  How to test: book a session for tomorrow → trainer clicks Mark Complete now.
  Expected (broken): allowed. Should require time elapsed.

- [ ] **Camp spots oversold race**
  How to test: open camp checkout in two tabs simultaneously when `spotsRemaining=1` → pay both.
  Expected (broken): both succeed, `spotsRemaining` goes to 0 (or negative).

- [ ] **Subscribe twice → double charge**
  How to test: trainer with `subscription_status=active` → DevTools → POST `/api/stripe/create-checkout` again with `plan: 'monthly'`.
  Expected (broken): Stripe creates second subscription.

- [ ] **Founding 50 grant via direct Supabase UPDATE**
  How to test: any trainer in DevTools →
  `supabase.from('trainer_profiles').update({is_founding_50:true}).eq('user_id','<your-id>')`
  Expected (broken): succeeds even after 50 spots used.

---

## P2 — Functional bugs

- [ ] **Reschedule accepts AND declines both set status to `confirmed`**
  How to test: athlete sends reschedule request → trainer declines.
  Expected (broken): booking status stays `confirmed` instead of going to `decline-related state`.
  File: `src/app/dashboard/bookings/page.tsx:189`.

- [ ] **Sports array case mismatch (Hockey vs hockey)**
  How to test: register a trainer (TitleCase sports get saved) → edit profile in setup wizard (slug-case sports get added).
  Expected (broken): trainer's `sports` array contains both `["Hockey", "hockey"]`, search misses one.

- [ ] **Profile-image swap doesn't reset verification**
  How to test: verified trainer uploads a new face photo.
  Expected (broken): trainer stays `verified` until admin manually checks. Moderation gap.

- [ ] **CA trainer without postal code → km saved as miles**
  How to test: register CA trainer, leave postal code blank, enter travel radius "30" thinking km.
  Expected (broken): saved as 30 miles (~48 km).
  File: `src/app/dashboard/trainer/setup/page.tsx:336`.

- [ ] **Notification deep-links don't navigate properly**
  How to test: trigger BOOKING_REJECTED notification → tap on web notification.
  Expected (broken): only opens generic offer modal or no-ops.

- [ ] **Reviews — duplicate by same athlete on same booking**
  How to test: leave review → press back → leave review again.
  Expected (broken): two review rows insert, average doubled.

- [ ] **Admin "Resolve" dispute (payout trainer) does NOT fire Stripe transfer**
  How to test: open a dispute on a paid+held booking → admin clicks Resolve (payout trainer).
  Expected (broken): DB shows `released` but no Stripe transfer; check Stripe dashboard.
  File: `src/app/admin/disputes/page.tsx:121-123`.

- [ ] **Admin verify a profile that's not complete**
  How to test: admin opens a trainer with `profileComplete=false` → click Verify.
  Expected (broken): verification succeeds, trainer becomes searchable despite missing fields.

- [ ] **Reconcile-scan misses booking if >100 Stripe sessions newer**
  How to test: create a booking → run 100+ unrelated Stripe checkout sessions (test mode) → reconcile original booking.
  Expected (broken): diagnosis = `no_stripe_session_found` even though it was paid.

---

## P3 — UX / Cosmetic

- [ ] Sub-account delete uses native `confirm()` instead of project modal
- [ ] Random sport cover image flickers between renders
- [ ] UTF-8 mojibake (`â€”` instead of `—`) in Stripe Checkout product names
- [ ] CSV review export — formula injection (`=cmd|...`) not stripped
- [ ] No "Cancel subscription" button in UI
- [ ] No "trial expiring" / "renewal failed" emails or in-app notifications
- [ ] `verification_documents` storage links unsigned (anyone with URL fetches docs)

---

## How to use this list

1. Skip P3 — those are not blockers.
2. Spot-check 3-4 P0 items to confirm the root cause is real.
3. Once any P0 reproduces, the **single fix** (real Supabase JWT auth + server-side ownership checks) collapses most P0 + many P1 in one shot. Don't grind one-by-one.
4. P1 items are independent fixes — some need DB transaction (camp race), some just env hygiene (webhook secret).
5. P2 are quick targeted patches once P0/P1 settles.

**Stop after P0 if reproductions confirm the auth root cause is real** — that's the one architectural fix that unblocks everything else.
