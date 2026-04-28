# Trainer Audit — 2026-04-28

Web-side audit only. Each item flagged as a candidate to fix on web first, then mirror on mobile in a follow-up batch.

> **Scope**: Trainer onboarding/profile, bookings/availability, payments/payouts/earnings, messages/notifications/reviews, subscription/offers/sub-accounts.

> **Reading**: `[CRITICAL]` = ship-blocking, money/security/data-loss; `[HIGH]` = real user-facing damage; `[MEDIUM]` = UX or correctness drift; `[LOW]` = cosmetic.

---

## ROOT CAUSE — read first

**The biggest finding across every agent's report is the same root cause:**

The web client uses a **localStorage-based custom session** (`airtrainer_session` JSON blob), and all data calls go through a Supabase client initialized with the **anon key**. This means:

- No JWT is sent on Supabase queries → `auth.uid()` in RLS policies returns `null` → policies that gate by `auth.uid() = user_id` cannot fire correctly.
- Most API routes read `userId` straight from the request body and trust it (`/api/stripe/connect`, `/api/stripe/connect-status`, `/api/stripe/refund-booking`, `/api/stripe/verify-subscription`, `/api/stripe/create-checkout`, `/api/stripe/create-offer-payment`).
- A logged-in user can therefore mutate other users' rows from the browser console, trigger refunds for bookings they don't own, mint Stripe Connect onboarding links bound to other trainers' profiles, etc.

We added `requireAdmin()` for admin routes; we have **no equivalent `requireSession()` for athlete/trainer routes**. Every "user-can-only-touch-their-own" guarantee currently rests on RLS that doesn't actually fire, or on UI buttons that DevTools bypasses.

**Strategic fix**: introduce `requireSession(req)` server-helper (returns `{ userId, role }` from a signed cookie or the supabase auth JWT), wire it into every `/api/*` route that mutates state or reads non-public data, and stop trusting body-supplied user IDs. Pair with proper RLS so direct Supabase client calls from the browser actually enforce ownership.

---

## CRITICAL — fix before next prod ship

### Authentication / authorization

1. **Refund endpoint has zero auth** — `apps/web/src/app/api/stripe/refund-booking/route.ts:9-23`.  
   Any user with a `bookingId` can trigger a refund + transfer reversal. **Repro**: `curl -X POST /api/stripe/refund-booking -d '{"bookingId":"<any>","cancelledBy":"athlete"}'`.

2. **All booking mutations bypass authorization** — `apps/web/src/app/dashboard/bookings/page.tsx:136,145,188`.  
   Anon Supabase client + localStorage session = no JWT. Trainer can `update bookings set status='completed' where id=<other_trainer_booking>` from DevTools.

3. **`updateStatus` permits arbitrary status transitions** — `bookings/page.tsx:142-147`.  
   No state-machine check. `cancelled → confirmed`, `completed → confirmed`, etc. all allowed.

4. **`/api/stripe/connect` POST has no auth** — `connect/route.ts:19-87`.  
   Anyone can mint a Stripe Connect onboarding link bound to *another trainer's* profile by passing victim's `userId`. The route checks `role='trainer'` but not `userId === auth.uid()`.

5. **`/api/stripe/connect-status` GET has same flaw** — `connect-status/route.ts:171-176`.  
   Trainer A can read trainer B's Connect dashboard URL, bank last4, requirements list.

6. **`/api/stripe/verify-subscription` activates without proving ownership** — `verify-subscription/route.ts:33-69`.  
   Activates whichever userId is in Stripe metadata or body. A user landing on the success page can hijack another user's payment.

7. **`/api/stripe/create-checkout` has no "already subscribed" guard** — `create-checkout/route.ts:8-87`.  
   Trainer clicks Subscribe twice → two parallel Stripe subscriptions, double charge. UI hides the button when active but the API is open.

8. **`/api/stripe/create-offer-payment` trusts body-supplied `athleteId`** — `create-offer-payment/route.ts`.  
   Combined with metadata-trusted webhook, an attacker can pay $0.50 for a $500 camp.

### Money flow

9. **Webhook returns 200 on internal errors** — `webhook/route.ts:586-588`.  
   `catch { return {received:true,error}, status:200 }`. Stripe never retries. Athlete charged, no escrow row, no booking confirmation, no recovery.

10. **Webhook signature bypassed when env unset (any non-prod NODE_ENV)** — `webhook/route.ts:32-40`.  
    Preview deployments without `STRIPE_WEBHOOK_SECRET` accept forged JSON. Attacker grants themselves Pro / fakes payments.

11. **Webhook never confirms booking status** — `webhook/route.ts:92-105`.  
    Inserts `payment_transactions` but never `bookings.status='confirmed'`. Athlete pays, money escrowed against a `pending` booking; if booking was already cancelled, escrow row points at nothing.

12. **Trainer-cancel skips refund when `paidBookingIds` cache is stale** — `bookings/page.tsx:130-136`.  
    Trainer's page loaded → athlete pays in another tab → trainer hits Cancel → DB flips to `cancelled` without calling refund. Athlete loses money.

13. **Founding 50 grant via direct client UPDATE** — `subscription/page.tsx:160-163`.  
    Cap is purely a UI check. Two trainers race the 50th seat; neither path is in a server-side transaction. RLS doesn't enforce because no JWT.

14. **Founding 50 "active" status never granted** — `subscription/page.tsx:160-178`.  
    Sets `is_founding_50=true` but doesn't set `subscription_status='active'` or `subscription_expires_at`. Promised 6 months never delivered.

### Data integrity

15. **Auto-approve writes wrong status string** — `lib/auth.ts:252`.  
    Inserts `verification_status: 'approved'` but every gate compares against `'verified'`. Auto-approve is silently dead.

16. **Soft-deleted trainer can still log in** — `lib/auth.ts:58, 421-446 setup; profile`.  
    Account "deletion" only sets `deleted_at` on `public.users`. Auth row stays. localStorage session still valid. `airtrainr_uid` cookie still trusted by middleware.

17. **`/api/stripe/refund-booking` silently swallows existing-refund as success** — `bookings/page.tsx:131-136 + refund-booking/route.ts`.  
    Returns `{refunded:false}` with 200 when tx already refunded. Client treats as success and flips booking to `cancelled` regardless. Combined with #12, opens double-cancel/orphan windows.

18. **Profile-image / banner update doesn't reset `verification_status`** — `setup/page.tsx:573-580`.  
    A previously verified trainer can swap their photo for any image and remain `verified` in search until admin notices. Moderation gap.

19. **No user-scoped RLS on `trainer_profiles` for self-update**.  
    Recent migrations only added `Admins manage trainer_profiles`. Either older self-row policies were dropped (writes shouldn't work but currently do — meaning RLS is off on the table), or any authenticated client can update *any* trainer profile.

---

## HIGH

### Bookings / availability

20. **`Mark Complete` allowed any time after `scheduled_at`** — `bookings/page.tsx:637-643`.  
    `isPast = date < new Date()` ignores duration. 60-min session becomes "completable" 1 second after start.

21. **Reschedule accept hardcodes `confirmed`** — `bookings/page.tsx:189`.  
    Even declining sets status to `confirmed`. State machine is broken.

22. **Reschedule slot validation runs in browser local time** — `RescheduleDialog.tsx:143-147`.  
    Trainer in IST + athlete in UTC = wrong slot match.

23. **Reschedule conflict check is racey** — `RescheduleDialog.tsx:154-162`.  
    SELECT-then-INSERT, no DB unique constraint. Two parallel reschedule submissions both pass.

24. **Booked-slot detection in availability page is broken** — `availability/page.tsx:163-182`.  
    Filters by wrong trainer ID; mid-slot bookings don't match. Trainer can delete a slot that has an active booking inside it.

25. **Recurring availability silently overwrites per-slot** — `availability/page.tsx:298-300`.  
    Two separate sources of truth, no sync. Trainer toggles recurring; athletes still book stale per-slot rows.

### Payments / payouts

26. **Connect login link leaked cross-trainer** — `connect-status/route.ts:251`.  
    `dashboardUrl` is a one-time auth URL; combined with #5, trainer A can sign in as trainer B on Stripe.

27. **Hold count includes refunded/disputed bookings** — `webhook/route.ts:84-89`.  
    "Trainer with 10+ completed bookings gets 24h hold instead of 72h" — but the count doesn't filter out refunded/disputed history. New trainer with 10 refunds gets the short hold.

28. **No subscription check before Transfer** — `release-single-payout/route.ts:53-72`.  
    A trainer who cancelled their AirTrainr subscription still has held funds released. If policy is "no payouts to suspended trainers," there's a leak.

29. **Release allows transfer-then-DB-fail orphan** — `release-payouts/route.ts:212-222`.  
    Transfer succeeds, conditional `update eq("status","held")` returns 0 rows on race. Money sent, DB still `held`. No automatic compensating reversal.

30. **Stripe processing fee is approximation, not solver** — `lib/fees.ts:58-66`.  
    Comment says "solve for fee" but code does pass-through. Platform absorbs ~$0.03 per session — multiplied across thousands.

### Messages / reviews / notifications

31. **Realtime subscribed to ALL `messages` rows globally** — `messages/page.tsx:84-87`.  
    `event:"*"` with no `filter:` clause. RLS is the only choke; combined with the JWT-less anon client, this could silently leak other users' message payloads.

32. **`bookingIds.includes(...)` filter is a stale closure** — `messages/page.tsx:88-90`.  
    New bookings during session aren't in the list; legitimate inserts dropped silently.

33. **No authorization check on send** — `messages/page.tsx:194-196`.  
    Trainer can post on `cancelled`/`refunded`/`completed` bookings — or any spoofed bookingId.

34. **Read-receipts unreliable** — `messages/page.tsx:104-106, 182-183`.  
    `read_at` written on every realtime INSERT regardless of visibility. Backgrounded tab "reads" everything.

35. **No rate-limit, no abuse filter, no block** on messaging — entire `messages/page.tsx`.  
    Trainer can flood every athlete they've had a past booking with.

36. **Duplicate review by same athlete on same booking not prevented** — `reviews/page.tsx:24-28`.

37. **Rating not validated** — `reviews/page.tsx:57-66`.  
    `"★".repeat(review.rating)` throws RangeError on negative ratings; bad row crashes the whole list.

### Subscription / offers / sub-accounts

38. **Camp spots race / oversold** — `webhook/route.ts:322-364`.  
    Read-modify-write of `camp_offerings` jsonb without compare-and-swap. Two webhooks both read `spotsRemaining=1`, both write `0`. Booking already created → camp oversold.

39. **`customer.subscription.updated` doesn't handle `past_due`/`incomplete`** — `webhook/route.ts:559-580`.  
    Trainer in 3-day dunning still appears active, accepts bookings.

40. **Subscription lifecycle has zero notifications/emails** — webhook handles 5 events, none send any user-visible signal. Trainer's renewal fails → silently disappears from search next morning.

41. **No "Cancel subscription" UI/API** — entire subscription page.  
    Hurts churn signals and TOS compliance ("cancel anytime").

42. **Sub-account cap counted client-side only** — `sub-accounts/page.tsx:193-209`.  
    No DB constraint. Determined parent can insert >6.

### Onboarding / profile

43. **Registration race leaves orphan auth.users on trainer-profile insert failure** — `lib/auth.ts:264`.  
    Cleanup deletes `public.users` only. Auth row stays. Email locked, user can't retry.

44. **Athlete-profile insert error silently swallowed** — `lib/auth.ts:280-296`.  
    Athlete lands on `/dashboard` with `athleteProfile: null`. Booking flows expecting `skill_level` misbehave.

45. **`select('*')` from public.users leaks `password_hash` literal** — `setup/page.tsx:175, profile/page.tsx:133`.  
    Field stores `'auth_handled_by_supabase'`, but any future internal column is auto-leaked to localStorage.

46. **Sports array case mismatch** — `register/page.tsx:130-141` writes TitleCase, `setup/page.tsx` writes slugs. Trainer who registers then edits ends up with `["Hockey","hockey"]`.

47. **Setup page does NOT re-flip status on rejected re-edit** — A rejected trainer hits Save; row updated but status stays `rejected` — no re-queue notification to admin.

48. **`travel_radius_miles` in km accidentally stored as miles** — `setup/page.tsx:336`.  
    CA detection via postal code only. CA trainer without postal → km value stored as miles.

49. **`subscription_status` not set on signup** — `lib/auth.ts:251` only sets `trial_started_at`.  
    Gate requires `subscription_status IN ('trial','active')`. Fresh trainer is `null` → gate blocks them on day 1 of trial.

---

## MEDIUM

50. Validation drift on `years_experience` — `parseInt || 0` saves silent zero.
51. DOB ≥ 18 not re-checked on save.
52. Profile page upsert with `onConflict: 'user_id'` requires unique index — verify it exists.
53. Avatar/banner uploads to Cloudinary leak orphans on RLS denial; no `destroy()` call.
54. `fieldErrors` "first error" key reads previous render's value → wrong field scrolled to.
55. `verifySessionStatus` returns true on network error (defaults to "stay logged in"); suspended trainer keeps editing.
56. `is_approved` on `users` row never flipped — ambiguous gate signal.
57. Profile page trainer redirect happens after sports fetch — flash + wasted call.
58. No reason captured when trainer rejects a booking.
59. Booking notifications inserted only after status update; if notif fails, no retry.
60. Acceptance deadline computed entirely client-side; bypassable.
61. Reschedule weekend hardcoded as unavailable, ignoring trainer's own slots.
62. Reschedule "free slot" search ignores pending bookings.
63. `no_show` and `disputed` enum values present but no UI path.
64. Recurring availability `start_time/end_time` saved as plain HH:mm without timezone.
65. Currency env var read at module load — Vercel edge cache stale across deploys.
66. `price=0` slips through `fees.ts` — `stripeFee=$0.30` charged with $0 trainer payout.
67. `upcomingPaid.payment_transaction.trainer_payout` shown as "pending" even if booking was cancelled.
68. Earnings stats trust client-side aggregation (no security risk if RLS holds, but reporting integrity).
69. `offer_accept` retries can double-decrement camp spots.
70. `release-single-payout` has no DB transaction — crash mid-write requires manual reconcile.
71. Channel name collision: `all_messages:${user.id}` two tabs same account → one stops receiving.
72. `loadConversations` re-runs on every UPDATE event — N+1 storm.
73. Sidebar unread count includes cancelled/completed/archived threads.
74. `OfferModal` opens for any notification type; forged `data.offer_id` reaches Stripe.
75. `data.offer_status` overwritten only for terminal states — stale cache desync.
76. `alert(err.message)` leaks server error strings to user.
77. Reviewer-name fallback throws on missing `last_name`.
78. Founding 50 count includes pending/denied/cancelled applicants — pool exhausted prematurely.
79. Webhook doesn't distinguish `past_due`/`incomplete` from `active`.
80. Stripe Checkout abandoned cart leaves no DB row for telemetry/retry.
81. Offer expiry not enforced server-side; only fired from trainer's page (best-effort).
82. Offer cancel sets status to `expired` not `cancelled` — race window allows payment of cancelled offer.
83. Sub-account `MAX_SUB_ACCOUNTS=6` not centralized; mobile drift risk.

---

## LOW

84. UTF-8 mojibake in product names: `create-checkout/route.ts:43,57`, `create-offer-payment/route.ts:135`.
85. `verify-subscription` "alreadyActive" early-return doesn't recheck expiry.
86. Offers page reloads full data after every send.
87. Cancel-offer error swallowed silently.
88. Sub-account delete uses `confirm()` instead of project's modal pattern.
89. CSV review export — formula injection (`=cmd|...`).
90. Notification title transformer strips meaning from constants like `BOOKING_CANCELLED_BY_TRAINER`.
91. `searchParams.get("offer_paid")` setTimeout has no cleanup.
92. No empty-state for "you can't message anyone yet."
93. Document removal does not delete from Cloudinary.
94. `preferredTrainingTimes` column name uses camelCase — verify Postgres folding.
95. Realtime subscription uses anon client; filter is publicly observable.
96. Earnings CSV doesn't reflect `payment_transactions.trainer_payout` if fee model changes.

---

## Top-priority cluster (recommended fix sequence)

1. **Server-side session helper `requireSession(req)`** — fixes #1, #2, #4, #5, #6, #7, #8 in one change.
2. **Webhook hardening** — fail closed when secret missing, return 5xx on internal errors, signature always verified — fixes #9, #10.
3. **Booking state machine + refund flow tightening** — server-side guards on transitions, refund-before-cancel always reachable — fixes #3, #11, #12, #17.
4. **Founding 50 server route with row-locking** — fixes #13, #14.
5. **Auto-approve string fix + soft-delete real cleanup** — fixes #15, #16.

After these five clusters, the remaining HIGH/MEDIUM list is mostly UX/correctness, not money/security.
