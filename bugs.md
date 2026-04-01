## Bug Tracker

---

## ✅ FIXED BUGS

| # | Bug | Status |
|---|-----|--------|
| 1 | Browse Athletes / Sent Offers text center | ✅ Fixed |
| 2 | Send Offer button glow | ✅ Fixed |
| 3 | Availability time slots showing 24h format | ✅ Fixed → now 12h |
| 4 | MARK COMPLETE showing for completed sessions | ✅ Fixed |
| 5 | Earnings showing before admin releases funds | ✅ Fixed → escrow logic |
| 6 | Sport chip glow in coach profile | ✅ Fixed |
| 7 | a tags causing full page reload | ✅ Fixed → Link in bookings |
| 8 | Messages list slate highlight on unselected item | ✅ Fixed |
| 9 | Edit Profile Save Changes button wrapping on mobile | ✅ Fixed |
| 10 | Session Lengths & Training Locations not on public profile | ✅ Fixed |
| 11 | Booking completed notification going to trainer instead of athlete | ✅ Fixed |
| NEW-1 | Training Offers header/button style inconsistent | ✅ Fixed → standard text-2xl, no glow |
| NEW-2 | Booking confirmed → player not notified | ✅ Fixed → BOOKING_CONFIRMED notification inserted for athlete |
| NEW-3 | Sub-accounts / Family account logic | ✅ Fixed → full CRUD, soft-delete, migration added |
| NEW-4 | Glow fix on registration/profile chips | ✅ Fixed → CSS selector `button.bg-primary` not `[class*="bg-primary"]` |
| NEW-5 | Notification colors per type | ✅ Fixed → icon bg 15% opacity, unread dot matches type color |
| NEW-6 | Google / Apple OAuth login | ✅ Fixed → OAuth buttons on login/register + /auth/callback page |
| NEW-7 | Admin: Overview search bar + navbar sizing | ✅ Fixed → md:flex-row, search stacks on mobile |
| NEW-8 | Admin: Platform Growth chart sizing | ✅ Fixed → bg-white/20, min height 12%, taller container |
| NEW-9 | Admin: Recent Transactions table columns overlapping | ✅ Fixed → min-w + whitespace-nowrap |
| NEW-10 | Admin: Navbar notification + profile gap | ✅ Fixed → gap-2 sm:gap-3 |
| NEW-11 | Admin: Pagination sizing | ✅ Fixed → text-[10px], flex-col sm:flex-row on mobile |
| NEW-12 | Admin: Bookings sidebar z-index | ✅ Fixed → mobile overlay z-[200] |
| NEW-13 | Admin: Payment section heading overflow | ✅ Fixed → text-2xl sm:text-3xl md:text-4xl, flex-wrap |
| NEW-14 | Admin: Payment stats all red color | ✅ Fixed |
| NEW-15 | Admin: Expiry display style | ✅ Fixed → colored pill badge |
| NEW-16 | Coach subscription expiry action | ✅ Fixed → locked UI on offers page + amber banner in dashboard |
| NEW-17 | Admin settings global check | ✅ Fixed → platform_fee fetched fresh, maintenance_mode enforced via middleware |
| NEW-18 | Coach document verification not implemented | ✅ Fixed → PDF upload in setup, admin view/approve/reject modal |

---

_All bugs resolved as of 2026-04-01._
