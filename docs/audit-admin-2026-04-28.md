# Admin Audit — 2026-04-28

Web-side admin (verification + payouts + reconciliation + disputes).

> **Reading**: `[CRITICAL]` = ship-blocking; `[HIGH]` = real damage; `[MEDIUM]` = correctness drift; `[LOW]` = cosmetic.

> **Context**: Admin routes use `requireAdmin()` server-helper via `lib/admin-auth.ts`, which reads the `airtrainr_uid` cookie + service-role lookup. The cookie is currently UNSIGNED — anyone can rewrite it in DevTools to spoof admin. This single root cause amplifies most CRITICALs below.

---

## CRITICAL

### Admin spoof / privilege escalation

1. **`airtrainr_uid` cookie is unsigned/unencrypted — full admin spoof** — `lib/admin-auth.ts:13`. `requireAdmin` reads `req.cookies.get('airtrainr_uid')` raw and looks up role by that uuid. **Repro**: any user who knows or guesses an admin uuid pastes it into DevTools cookies and gains full admin (release payouts, refund, sync). Same risk on `x-admin-user-id` header. **Fix**: HMAC-sign cookie with a server secret and verify, or move to Supabase auth JWT.

2. **Disputes page bypasses API with direct Supabase writes; no transfer reversal on "Resolve"** — `admin/disputes/page.tsx:104-130`. `handleAction('refund')` correctly calls `/api/stripe/refund-booking` (which reverses transfer for `released` rows). But `handleAction('resolve')` (lines 121-130) does a direct client-side `payment_transactions.update({status:'released'})` with no `requireAdmin`, no Stripe transfer fired, no `stripe_transfer_id` set. Trainer is marked paid in DB but no money ever moves. Later refund attempts will 400.

3. **Trainers page does direct Supabase writes for verification + Founding 50 grants — no admin auth, no audit log** — `admin/trainers/page.tsx:217-313`. `handleDocsStatusUpdate`, `toggleFounding50`, `handleStatusUpdate` all flip `verification_status`/`is_verified`/`is_founding_50`/`subscription_status`/`subscription_expires_at` via the browser's anon Supabase client. They rely on RLS — and grant 6-month subscriptions for free. None go through `requireAdmin` or `logAdminAction`.

### Reconciliation correctness

4. **Reconcile-scan + reconcile-booking-payment list only the most recent 100/20 Stripe sessions globally** — `reconcile-scan/route.ts:46`, `reconcile-booking-payment/route.ts:53`. Bookings DB window is 7 days but Stripe Sessions API returns the platform's last N globally. With high volume, the booking we want is paged out → diagnosis = `no_stripe_session_found` even when paid. **Fix**: search by `metadata['bookingId']` via `stripe.checkout.sessions.search` or paginate.

---

## HIGH

5. **Stripe key rotation → "Sync from Stripe" creates wrong DB row** — `reconcile-booking-payment/route.ts:53,107`. The route trusts whichever account `STRIPE_SECRET_KEY` currently points at. After key rotation, an old booking shows `no_stripe_session_found`; if a session metadata.bookingId collides on the new account it inserts a `payment_transactions` row with the new account's PI but mapped to the old booking. No platform-account-id check before insert.

6. **Refund amount uses Stripe charge total, not `booking.total_paid`** — `api/stripe/refund-booking/route.ts`. No explicit `amount`, refunds full charge. If booking row's tax_amount diverges from checkout total (post-checkout tax change), athlete sees mismatch.

7. **Bulk release: DB-update-after-transfer failure leaves orphan paid transfer** — `release-payouts/route.ts:88-91`. Stripe transfer succeeds, conditional update returns 0 rows on race, row stays `held`, next bulk run picks it up. v2 idempotency key `release_v2_${txId}` replays same transfer (safe), but row never auto-heals. Skipped reason logged once but not surfaced to UI as alert.

8. **Bulk release does not check trainer suspension or profile status** — `release-payouts/route.ts:40-67`. A trainer who was rejected/suspended after capture still gets paid. Should join `users.is_suspended`, `users.deleted_at`, `trainer_profiles.verification_status`.

9. **`requireAdmin` lookup hits DB on every call but combined with C1 cookie spoof, attacker keeps working until role flips** — `admin-auth.ts:17-27`.

---

## MEDIUM

10. **Approve image does not re-check verification gate** — `api/admin/approve-trainer-image/route.ts:46-65`. Approving image flips `profile_image_status` and writes `users.avatar_url` but doesn't ensure `is_verified=true`. Reverse-path bug: rejected-after-approved leaves stale public avatar.

11. **Trainer approve allows `profile_complete=false`** — `trainers/page.tsx:286-313`. `handleStatusUpdate('verified')` updates verification with zero check on `profile_complete`, bio, sports, certs. Verified-but-incomplete trainer becomes searchable.

12. **Reconcile-scan time-window bias** — `reconcile-scan/route.ts:28,34`. DB window 7 days, statuses `pending|confirmed`. Misses paid-late bookings (>7d) and never inspects `completed` bookings.

13. **`logAdminAction` swallows all errors silently** — `admin-auth.ts:46`. `catch {}` means a Postgres outage on the audit table is invisible — actions still succeed but log gap goes undetected.

14. **Disputes "Resolve" doesn't reset `released_at` on already-released rows** — `disputes/page.tsx:121-123`. Silent no-op; no UI feedback distinguishing the case.

---

## LOW

15. **`release-payouts` has no batch size cap** — could time out on backlogs >50 transfers (Stripe round-trip ~500ms each).

16. **Reconcile insert defaults `trainer_payout` to `booking.price` — ignores fee model** — `reconcile-booking-payment/route.ts:117`. Inflates trainer payout on synced rows.

17. **Founding-50 grant gives `subscription_expires_at = +180 days`** — `trainers/page.tsx:271-273`. Off-spec (memory says trial 7d / yearly 365d).

18. **`verification_documents` link in trainers page is unsigned** — Direct supabase Storage path; anyone with the URL fetches personal docs.

19. **`release-payouts` audit log target_id null for bulk** — Per-row IDs nested in payload; querying by `target_id` won't find a specific tx.

---

## Top 3 to fix first

1. **HMAC-sign `airtrainr_uid` cookie** (or move to Supabase JWT) — single fix neutralizes the admin-spoof root cause and #2/#3 cascades.
2. **Move all admin verification + Founding 50 + dispute-resolve to authenticated API routes with `requireAdmin` + `logAdminAction`** — kills #2, #3, and creates an audit trail for compliance.
3. **Reconcile lookup by `metadata.bookingId`, not by recent-N global scan** — fixes #4 and #5.
