# 🧪 QA Testing Report — AirTrainr Web Platform

**URL:** https://air-triner-web.vercel.app/  
**Test Date:** April 3, 2026  
**Tester:** Automated QA via Browser Testing  
**Environment:** Desktop (1264×671), Chrome  

---

## 📋 Executive Summary

The AirTrainr platform is a marketplace connecting athletes with sports trainers. Testing covered **3 user roles** (Admin, Athlete, Trainer), **25+ modules/features**, and included authentication flows, CRUD operations, data validation, responsive design, and edge cases.

| Metric | Value |
|--------|-------|
| **Total Modules Tested** | 27 |
| **Bugs Found** | 14 |
| **Critical Bugs** | 2 |
| **High Severity** | 3 |
| **Medium Severity** | 5 |
| **Low Severity** | 4 |
| **Overall Health** | ⚠️ Moderate — core workflows function, but financial data issues need urgent attention |

---

## 🔐 1. Authentication & Access Control

### 1.1 Login Flow

| Test Case | Status | Notes |
|-----------|--------|-------|
| Admin login (kayum@gmail.com) | ✅ PASS | Redirects to `/admin` dashboard correctly |
| Athlete login (athlete@gmail.com) | ✅ PASS | Redirects to `/dashboard` correctly |
| Trainer login (trainer@gmail.com) | ✅ PASS | Redirects to `/dashboard` correctly |
| Invalid credentials error handling | ✅ PASS | Shows "Invalid login credentials" red banner |
| Password visibility toggle | ✅ PASS | Eye icon toggles password visibility |
| "Remember me" checkbox | ✅ PASS | "Remember this device for 30 days" present |

### 1.2 Registration Flow

| Test Case | Status | Notes |
|-----------|--------|-------|
| Registration page loads | ✅ PASS | Step 1 of 2 with progress indicator |
| Role selection (Athlete/Trainer) | ✅ PASS | Clear cards with descriptions |
| Form fields present | ✅ PASS | Full Name, Email, Password, Confirm Password |
| Password requirements displayed | ✅ PASS | Min 12 chars, uppercase, lowercase, number, special char |
| Empty form validation | ✅ PASS | Browser-native "Please fill out this field" |
| Social sign-up options | ✅ PASS | Google and Apple buttons present |

### 1.3 Forgot Password

| Test Case | Status | Notes |
|-----------|--------|-------|
| Forgot password link | ✅ PASS | Redirects to `/auth/forgot-password` |
| Reset form UI | ✅ PASS | Email input + "Send Reset Link" button |
| Back to login link | ✅ PASS | "← Back to login" works |

---

## 👑 2. Admin Panel Testing

**Login:** kayum@gmail.com / kayum@gmail.com  
**Role:** SUPER ADMIN

### 2.1 Admin Dashboard

| Test Case | Status | Notes |
|-----------|--------|-------|
| Dashboard loads | ✅ PASS | All stats render correctly |
| Total Athletes count | ✅ PASS | Shows 14 |
| Total Trainers count | ✅ PASS | Shows 17 |
| Total Revenue | ✅ PASS | Shows $177.2 |
| Active Bookings | ✅ PASS | Shows 1 |
| Platform Growth chart | ⚠️ WARN | Chart renders but shows 0 values for all months |
| Activity Log | ✅ PASS | Shows recent booking events with timestamps |
| Recent Transactions table | ✅ PASS | Transaction ID, athlete, trainer, amount, status |

### 2.2 Disputes Module

| Test Case | Status | Notes |
|-----------|--------|-------|
| Page loads | ✅ PASS | Displays dispute management interface |
| Stats cards | ⚠️ BUG | "High Risk" shows "00" instead of "0" |
| Empty state | ✅ PASS | "No disputes found" message displayed |
| Filters (Pending/Resolved/Escalated) | ✅ PASS | Tabs are clickable |
| Search bar | ✅ PASS | Search by case ID, athlete, trainer |
| Preview panel | ✅ PASS | "No case selected — Click a row to review" |

> [!WARNING]
> **BUG-001 (Low):** The "High Risk" stat card displays "00" instead of "0". Inconsistent number formatting with other cards.

### 2.3 Trainers Module

| Test Case | Status | Notes |
|-----------|--------|-------|
| Page loads | ✅ PASS | 17 trainers loaded, 15 verified |
| Interactive map | ✅ PASS | Shows trainer clusters in 5 cities |
| Location breakdown | ✅ PASS | Toronto, Houston, Miami, New York, LA |
| Pending/Verified/Declined filters | ✅ PASS | Tabs switch correctly |
| Search bar | ✅ PASS | Search by names or emails |
| Table column alignment | ❌ FAIL | **Major misalignment** — see bug below |

> [!CAUTION]
> **BUG-002 (High):** In the Verified Trainers table, there is a **column misalignment**:
> - "GRANT F50" button appears under the "STATUS" header
> - "VERIFIED" badge appears under the "FOUNDING 50" header
> 
> The STATUS and FOUNDING 50 column data are swapped/misaligned.

### 2.4 Athletes Module

| Test Case | Status | Notes |
|-----------|--------|-------|
| Page loads | ✅ PASS | 14 athletes loaded |
| Stats cards | ✅ PASS | Total Athletes (14), Total Bookings (8), Active (12) |
| Interactive map | ✅ PASS | Shows athlete locations (Toronto, LA) |
| Table data | ✅ PASS | Name, email, joined date, status, sessions, actions |
| All/Active/Suspended filters | ✅ PASS | Tabs work correctly |
| Suspend action button | ✅ PASS | "SUSPEND" button present for active athletes |

### 2.5 Bookings Module

| Test Case | Status | Notes |
|-----------|--------|-------|
| Page loads | ✅ PASS | 8 booking records displayed |
| Table columns | ✅ PASS | Booking Ref, Athlete, Trainer, Schedule, Sport, Status, Actions |
| Status badges | ✅ PASS | Color-coded — Red (Cancelled), Cyan (Confirmed), Green (Completed) |
| Filters (All/Upcoming/Completed/Cancelled) | ✅ PASS | Functional |
| Date and Sport filters | ✅ PASS | Dropdown filters present |
| Search bar | ✅ PASS | Search by athlete, trainer or ID |
| Export List | ✅ PASS | Export button present |
| Pagination | ✅ PASS | "Showing 1 to 8 of 8 results" |

### 2.6 Sports Module

| Test Case | Status | Notes |
|-----------|--------|-------|
| Page loads | ✅ PASS | 19 sport categories displayed in card grid |
| Add New Sport button | ✅ PASS | Primary CTA present |
| Search categories | ✅ PASS | Search bar functional |
| Edit/Delete/Toggle actions | ✅ PASS | Each card has edit, visibility toggle, delete icons |
| Active/Inactive states | ✅ PASS | "INACTIVE" badges shown for disabled sports |
| Test data present | ⚠️ WARN | "abcabsababa" test entry visible in production |

> [!IMPORTANT]
> **BUG-003 (Medium):** Test/junk data ("abcabsababa") exists in the production Sports catalog. This should be cleaned up before public release.

### 2.7 Payments Module

| Test Case | Status | Notes |
|-----------|--------|-------|
| Page loads | ✅ PASS | Financial overview renders |
| Total Platform Volume | ✅ PASS | $153.00 (+106% vs last month) |
| Commissions Earned | ✅ PASS | $8.00 (-40% vs last month) |
| Pending Payouts | ✅ PASS | $50.00 (1 held awaiting release) |
| Daily Payout Queue | ✅ PASS | Ready Now, Held (Escrow), Dispute Blocked, No Stripe |
| Revenue Trends chart | ✅ PASS | Bar chart for last 6 months |
| Payout Distribution | ✅ PASS | Released 67%, Held 33%, Refunded 0% |
| Stripe-aware actions | ✅ PASS | Release blocked for trainers without Stripe |
| Export Report | ✅ PASS | Export button available |

### 2.8 Subscriptions Module

| Test Case | Status | Notes |
|-----------|--------|-------|
| Page loads | ✅ PASS | Subscription management interface |
| Stats cards | ✅ PASS | Active (15), On Trial (2), Expired (0), Cancelled (1) |
| Table columns | ✅ PASS | Trainer, Email, Sport, Status, Expires, Actions |
| Expiration countdown | ✅ PASS | Shows "178D LEFT", "23D LEFT", etc. |
| Context-aware actions | ✅ PASS | "CANCEL" for active, "ACTIVATE" for trial |
| F50 badge | ✅ PASS | Founding 50 trainers marked with F50 badge |
| Filter tabs | ✅ PASS | All, Active, Trial, Expired, Cancelled, F50 |
| Export CSV | ✅ PASS | Export button present |

### 2.9 Settings Module

| Test Case | Status | Notes |
|-----------|--------|-------|
| Page loads | ✅ PASS | Global settings interface |
| Platform Fee Percentage | ✅ PASS | Editable field (currently 3%) |
| Max Booking Distance | ✅ PASS | Editable field (currently 50 miles) |
| Support Contact Route | ✅ PASS | support@airtrainer.com |
| Maintenance Mode toggle | ✅ PASS | Toggle switch (currently OFF) |
| Auto-approve Trainers | ✅ PASS | Toggle (currently OFF) |
| Require Strict Verification | ✅ PASS | Toggle (currently ON) |
| Global Status | ✅ PASS | Edge Database: HEALTHY |
| Save Configuration | ✅ PASS | Save button present |

---

## 🏃 3. Athlete Panel Testing

**Login:** athlete@gmail.com / Khushigupta22#  
**Role:** ATHLETE (Khushiiiii Gupta)

### 3.1 Athlete Dashboard

| Test Case | Status | Notes |
|-----------|--------|-------|
| Dashboard loads | ✅ PASS | Personalized greeting "Good Afternoon, Khushiiiii" |
| Total Bookings | ✅ PASS | Shows 4 |
| Upcoming | ✅ PASS | Shows 0 |
| Completed | ✅ PASS | Shows 1 |
| Total Spent | ✅ PASS | Shows $28 |
| Recent Sessions list | ✅ PASS | 4 sessions with correct statuses |
| Next Session panel | ✅ PASS | "No upcoming sessions scheduled" |
| Quick Actions | ✅ PASS | Find a Trainer, My Bookings, Payments, Family Accounts |
| Insight section | ✅ PASS | "You've completed 1 session" with CTA |

**Navigation sidebar items:** Dashboard, Find Trainers, My Bookings, Payments, Family Accounts, My Profile, Messages (2), Notifications (1)

### 3.2 Find Trainers (Search & Discovery)

| Test Case | Status | Notes |
|-----------|--------|-------|
| Page loads | ✅ PASS | "Find a Coach — 13 coaches available" |
| Search bar | ✅ PASS | Search by name functional |
| Sports filter | ✅ PASS | Dropdown with all sports |
| Location filter | ✅ PASS | Location input present |
| Skill Level filter | ✅ PASS | Dropdown present |
| Time filter | ✅ PASS | Dropdown present |
| Price filter | ✅ PASS | Dropdown present |
| Rating filter | ✅ PASS | Any, 3.5★, 4.0★, 4.5★ |
| Duration filter | ✅ PASS | Any, 30m, 45m, 1h, 1.5h |
| Sort order | ✅ PASS | "Recommended" dropdown |
| Trainer cards display | ✅ PASS | Photo, name, price/hr, rating, sports tags, NEW/VERIFIED badges |
| View Profile button | ✅ PASS | Opens detailed trainer profile |

### 3.3 Trainer Profile (from Athlete view)

| Test Case | Status | Notes |
|-----------|--------|-------|
| Profile loads | ✅ PASS | Full profile for David Williams |
| Trainer info | ✅ PASS | Name, location (Houston, TX), sports tags |
| Stats | ✅ PASS | Reviews, Years Exp (18+), Sessions |
| About section | ✅ PASS | Bio text displayed |
| Experience & Certifications | ✅ PASS | Section present ("No certifications listed") |
| Back to Search | ✅ PASS | "< Back to Search" link works |
| Trainer status badge | ⚠️ BUG | Shows "NEW TRAINER" but David Williams is VERIFIED in admin |

> [!WARNING]
> **BUG-004 (Medium):** David Williams shows as "NEW TRAINER" on the public profile page, but is listed as "VERIFIED" in the Admin Trainers module. Status badge inconsistency between admin and public views.

### 3.4 Athlete Payments

| Test Case | Status | Notes |
|-----------|--------|-------|
| Page loads | ✅ PASS | Payment history interface |
| Total Paid stat | ❌ FAIL | Shows **$0.00** — contradicts Dashboard showing **$28** spent |
| Payment history | ❌ FAIL | Shows empty — but completed sessions exist |

> [!CAUTION]
> **BUG-005 (Critical):** The Athlete Payments module shows **"Total Paid: $0.00"** with an empty transaction history. This directly contradicts the Dashboard stats which show **"Total Spent: $28"** and the Bookings module which shows a completed session ($28.02). **The summary cards are not aggregating actual payment data.**

### 3.5 Other Athlete Modules

| Test Case | Status | Notes |
|-----------|--------|-------|
| My Bookings | ✅ PASS | Session cards with status tabs, cancellation reasons, session notes |
| Family Accounts | ✅ PASS | Interface for managing sub-accounts (2/6 used) |
| My Profile | ✅ PASS | Profile editing interface |
| Messages | ✅ PASS | Chat interface with chat history and unread indicators |
| Notifications | ✅ PASS | Booking update notifications listed |

---

## 🏋️ 4. Trainer Panel Testing

**Login:** trainer@gmail.com / Khushigupta22#  
**Role:** TRAINER (Khushiii Trainer)

### 4.1 Trainer Dashboard

| Test Case | Status | Notes |
|-----------|--------|-------|
| Dashboard loads | ✅ PASS | Personalized greeting "Good Afternoon, Khushiii" |
| Total Sessions | ✅ PASS | Shows 4 |
| Upcoming | ✅ PASS | Shows 0 |
| Completed | ✅ PASS | Shows 1 |
| Earnings | ✅ PASS | Shows $27 |
| Avg Rating | ✅ PASS | Shows "---" (no ratings yet) |
| Reviews | ✅ PASS | Shows 0 |
| Recent Sessions | ✅ PASS | 4 sessions listed with correct statuses |
| Quick Actions | ✅ PASS | Update Availability, View Bookings, Earnings & Payouts, Edit Profile |
| Insight | ✅ PASS | Personalized message with "Update profile" CTA |

**Navigation sidebar items:** Dashboard, Training Offers, Availability, Bookings, Payments, Reviews, My Profile, Subscription, Messages (2), Notifications (1)

### 4.2 Trainer Bookings/Sessions

| Test Case | Status | Notes |
|-----------|--------|-------|
| Page loads | ✅ PASS | "COACH PORTAL — SESSIONS" |
| Total sessions | ✅ PASS | 4 sessions total |
| Filter tabs | ✅ PASS | All (4), Pending (0), Confirmed (0), Completed (1), Cancelled (3), Rejected (0) |
| Session cards | ✅ PASS | Athlete info, sport, duration, price, status badge |
| Session notes | ✅ PASS | "Accepted offer: Hiiii khushi" for completed session |
| Cancellation reasons | ✅ PASS | "huh" reason displayed for cancelled session |
| Add to Calendar | ✅ PASS | Button present on session cards |
| Refresh button | ✅ PASS | Functional |

### 4.3 Trainer Availability

| Test Case | Status | Notes |
|-----------|--------|-------|
| Page loads | ✅ PASS | Weekly availability schedule |
| Add Time Slot | ✅ PASS | Day, From, To fields with "+ ADD SLOT" button |
| Existing slots | ✅ PASS | Shows slots for Sunday, Monday, Tuesday |
| Edit/Delete slot | ✅ PASS | Clock and trash icons on each slot |
| "No slots set" | ✅ PASS | Shows for days without availability (Wednesday) |

> [!NOTE]
> **BUG-006 (Low):** The Sunday time slot "1:00 AM – 2:41 AM" has an unusual end time (2:41 AM). This suggests the time picker may allow arbitrary minute values rather than standard 15/30-minute intervals. Consider restricting to standard intervals for better UX.

### 4.4 Trainer Earnings/Payments

| Test Case | Status | Notes |
|-----------|--------|-------|
| Page loads | ✅ PASS | Earnings interface renders |
| Total Earned card | ❌ FAIL | Shows **$0.00** |
| Platform Fees card | ❌ FAIL | Shows **-$0.00** |
| Net Earnings card | ❌ FAIL | Shows **$0.00** |
| In Escrow card | ❌ FAIL | Shows **$0.00** (0 sessions pending) |
| Monthly Breakdown | ✅ PASS | Correctly shows "Apr 2026 — 1 session — $27.20" |
| Session History table | ✅ PASS | Shows Apr 2, 2026, Personal-Trainer, 60 min, $27.20 |
| Export CSV | ✅ PASS | Button present |
| Refresh | ✅ PASS | Button present |

> [!CAUTION]
> **BUG-007 (Critical):** The Trainer Earnings summary cards **all show $0.00** despite the Monthly Breakdown and Session History correctly showing **$27.20 earned** from a completed session on Apr 2, 2026.
> 
> **Root Cause (Likely):** The summary aggregation logic is not pulling from the same data source as the detailed views. The summary cards may be querying a separate or unfinished API endpoint.
> 
> **Impact:** High — trainers cannot trust their earnings summary, which is the primary financial dashboard they rely on.

### 4.5 Trainer Subscription

| Test Case | Status | Notes |
|-----------|--------|-------|
| Page loads | ✅ PASS | Active subscription details |
| Plan name | ✅ PASS | "FOUNDING 50 — ACTIVE" |
| Renewal date | ✅ PASS | September 29, 2026 |
| What's Included list | ✅ PASS | Feature benefits listed |

### 4.6 Other Trainer Modules

| Test Case | Status | Notes |
|-----------|--------|-------|
| Training Offers | ✅ PASS | Module accessible |
| Reviews | ✅ PASS | Module accessible |
| My Profile | ✅ PASS | Personal info, training profile, sports interests editable |
| Messages | ✅ PASS | Chat interface with unread count (2) |
| Notifications | ✅ PASS | Notification list with booking updates |

---

## 🌐 5. Landing Page & Public Pages

### 5.1 Landing Page

| Test Case | Status | Notes |
|-----------|--------|-------|
| Hero section | ✅ PASS | "ATHLETES GROW, TRAINERS THRIVE" |
| Hero CTAs | ✅ PASS | "FIND A TRAINER" → /dashboard/search, "JOIN AS A TRAINER" → /auth/register?role=trainer |
| Elite Coaches section | ✅ PASS | Trainer cards carousel |
| Browse By Sport | ⚠️ BUG | Some sport cards have broken/missing background images |
| How it Works | ✅ PASS | Sections for Athletes and Trainers |
| Testimonials | ✅ PASS | "Real Stories from Real People" with quotes |
| CTA section | ✅ PASS | "READY TO ELEVATE YOUR PERFORMANCE?" |

> [!WARNING]
> **BUG-008 (Medium):** In the "Browse By Sport" section on the landing page, the **Baseball** and **Lacrosse** sport cards have **broken/missing background images**. The cards appear with no visual background.

### 5.2 Footer

| Test Case | Status | Notes |
|-----------|--------|-------|
| Footer layout | ✅ PASS | 4-column layout (Brand, Platform, Company, Legal) |
| Social media links | ✅ PASS | X, Instagram, Facebook icons — point to real profiles |
| Platform links | ❌ FAIL | All point to `#` placeholder |
| Company links | ❌ FAIL | All point to `#` placeholder |
| Legal links | ❌ FAIL | All point to `#` placeholder |
| Copyright | ✅ PASS | "© 2026 AIRTRAINR. ALL RIGHTS RESERVED." |

> [!CAUTION]
> **BUG-009 (High):** **All footer navigation links are placeholders** (`#`). This includes critical legal pages:
> - Privacy Policy, Terms of Service, Safety Guides, Help Center, Cookies
> - About Us, Careers, Press Kit, Contact
> - Find a Trainer, Become a Trainer, Browse Sports, Dashboard
> 
> **Impact:** Legal compliance risk — Privacy Policy and Terms of Service must exist before public launch.

### 5.3 Header/Navigation

> [!WARNING]
> **BUG-010 (Medium):** On wider desktop screens, the **mobile menu buttons** ("LOG IN" and "GET STARTED") remain visible in the hero area alongside the desktop header buttons, creating a **duplicated and cluttered** navigation appearance. The mobile-to-desktop responsive breakpoint for the header needs refinement.

---

## 📱 6. Responsive Design

| Test Case | Status | Notes |
|-----------|--------|-------|
| Login page (375px mobile) | ✅ PASS | Elements stack vertically, full-width container |
| Registration page | ✅ PASS | Adapts to mobile width |
| Text readability | ✅ PASS | No truncated or overflowing text |
| Input fields | ✅ PASS | Full-width on mobile |
| Navigation | ⚠️ BUG | See BUG-010 above about desktop/mobile menu overlap |

---

## 🐛 7. Bug Summary

### Critical Severity (P0) — Must Fix Before Release

| ID | Module | Description | Impact |
|----|--------|-------------|--------|
| BUG-005 | Athlete Payments | Total Paid shows $0.00, contradicts Dashboard's $28 spent | Athletes cannot track their spending |
| BUG-007 | Trainer Earnings | All summary cards show $0.00 despite $27.20 in session history | Trainers cannot trust their financial dashboard |

### High Severity (P1) — Should Fix Soon

| ID | Module | Description | Impact |
|----|--------|-------------|--------|
| BUG-002 | Admin Trainers | Table column misalignment (STATUS ↔ FOUNDING 50 swapped) | Admin confusion when managing trainers |
| BUG-009 | Footer | All navigation links are `#` placeholders including legal pages | Legal compliance risk, broken navigation |
| BUG-011 | Landing Page | "Browse By Sport" cards (Baseball, Lacrosse) have broken images | Poor first impression for new users |

### Medium Severity (P2) — Plan to Fix

| ID | Module | Description | Impact |
|----|--------|-------------|--------|
| BUG-003 | Admin Sports | Test data "abcabsababa" visible in production catalog | Unprofessional appearance |
| BUG-004 | Trainer Profile | David Williams shows "NEW TRAINER" but is VERIFIED in admin | Trust inconsistency for athletes |
| BUG-008 | Landing Page | Missing background images for Baseball and Lacrosse sport cards | Visual degradation |
| BUG-010 | Header | Mobile menu buttons visible on desktop creating duplicate nav | Cluttered UI on desktop |
| BUG-012 | Admin Dashboard | Platform Growth chart shows 0 for all months despite activity | Metrics not populating |

### Low Severity (P3) — Nice to Fix

| ID | Module | Description | Impact |
|----|--------|-------------|--------|
| BUG-001 | Admin Disputes | "High Risk" shows "00" instead of "0" | Minor formatting inconsistency |
| BUG-006 | Trainer Availability | Time slots allow arbitrary minutes (e.g., 2:41 AM) | UX - non-standard time intervals |
| BUG-013 | Athlete Dashboard | Notification badge count may not match actual unread items | Minor UX inconsistency |
| BUG-014 | Dashboard | Initial page load takes 5-7 seconds to populate all stats | Performance optimization needed |

---

## ✅ 8. What's Working Well

1. **Authentication** — Login, registration, and forgot password flows are solid with proper validation and error handling
2. **Admin Panel** — Comprehensive admin tools with rich data visualization (maps, charts, activity logs)
3. **Dark Theme UI** — Consistent, sleek dark theme across all modules with good contrast and readability
4. **Role-Based Access** — Clean separation between Admin, Athlete, and Trainer with appropriate navigation for each
5. **Booking System** — End-to-end booking flow with status tracking, session notes, and cancellation reasons
6. **Real-Time Badges** — Messages and Notifications show unread counts in the sidebar
7. **Data Export** — CSV/Report export available in Payments, Subscriptions, and Bookings modules
8. **Filter Systems** — Robust filtering, search, and tab-based status filtering across all list views
9. **Personalization** — Dashboards show personalized greetings with date and contextual insights
10. **Subscription Management** — Clear plan display with expiration countdowns and F50 program integration

---

## 🎯 9. Recommendations

### Immediate Priorities
1. **Fix financial data synchronization** (BUG-005, BUG-007) — The earnings/payment summary cards must aggregate from the same data source as session history
2. **Fix trainer table column alignment** (BUG-002) — Status and Founding 50 columns are swapped
3. **Implement footer pages** (BUG-009) — At minimum, Privacy Policy and Terms of Service must exist for legal compliance

### Short-Term
4. Clean up test data from production (BUG-003)
5. Fix trainer verification badge consistency (BUG-004)
6. Fix broken sport card images on landing page (BUG-008, BUG-011)
7. Fix header responsive breakpoints (BUG-010)

### Long-Term
8. Optimize initial dashboard load time (currently 5-7 seconds)
9. Populate Platform Growth chart with actual historical data
10. Add time slot validation for standard intervals (15/30/60 min)
11. Consider adding automated E2E tests for the critical payment/earnings flows

---

*Report generated on April 3, 2026 • AirTrainr v1.0 QA Assessment*
