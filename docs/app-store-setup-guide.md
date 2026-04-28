# AirTrainr — App Store Setup Guide

This guide walks you through everything you need to do to get the AirTrainr mobile app live on the **Apple App Store** and **Google Play Store**.

You will create the developer accounts, hand the access details to our team, and we will handle the technical submission, testing, and review work.

---

## Why we need both

- **Apple App Store** — required for iPhone / iPad users.
- **Google Play Store** — required for Android users.

Each store needs its own paid developer account in **your business name**. The accounts must be owned by you (the business), not by us — this is an Apple and Google rule, and it also means you keep ownership of the app forever.

---

## Apple App Store — Step by Step

### 1. Choose the account type
Pick one of:

| Type | Cost | Who it's for |
|---|---|---|
| **Individual** | US $99 / year | Sole proprietor, name shows as your personal name on the store |
| **Organization (recommended)** | US $99 / year | Registered business, name shows as your company name on the store |

We recommend **Organization** so the app is listed under "AirTrainr Inc." (or whatever the business name is) instead of your personal name.

### 2. Get a D-U-N-S Number (Organization only — skip if Individual)

Apple requires every Organization to have a free **D-U-N-S Number** — a 9-digit business identifier from Dun & Bradstreet.

- Go to https://developer.apple.com/enroll/duns-lookup/
- Search for your business; if not found, request a new one
- Free, takes **3 - 14 business days** to be issued
- Save the D-U-N-S Number for step 3

### 3. Sign up for Apple Developer Program

1. Go to https://developer.apple.com/programs/enroll/
2. Sign in with your **Apple ID** (create a fresh one for the business if you don't already have one — use a permanent business email like `apple@yourcompany.com`)
3. Choose Individual or Organization
4. Fill in the legal entity name (must match your business registration exactly)
5. Enter the D-U-N-S Number (Organization only)
6. Pay the **US $99** annual fee with a card
7. Wait for Apple to verify (Individual: ~24 hours, Organization: 2 - 7 days)

### 4. Set up payments and tax (so you get paid from in-app revenue)

After enrollment, sign in to https://appstoreconnect.apple.com → **Agreements, Tax, and Banking**.

You will need:
- **Bank account details** (account number, routing/SWIFT, currency — match the country you registered the business in)
- **Tax forms** — Apple will guide you through the relevant W-8/W-9 form depending on country
- **Contact people** — your name + email for finance and legal contacts

### 5. What to send us

Once your account is approved:

- The **email address** you used to sign up (your Apple ID)
- Add our team email as a user under **Users and Access** with the **Admin** role (we'll send the email to invite)
- Apple Team ID (visible in your Apple Developer account membership page)

That's it — we handle the rest: certificates, provisioning, app upload, screenshots, app description, review submission.

---

## Google Play Store — Step by Step

### 1. Sign up for Google Play Console

1. Go to https://play.google.com/console/signup
2. Sign in with a **Google account** (use a permanent business email like `play@yourcompany.com`)
3. Choose **Organization** (or **Personal** if you don't have a business yet — you can switch later)
4. Pay the **one-time US $25** fee with a card
5. Fill in business details:
   - Legal business name (must match registration)
   - Business address
   - Phone number
   - Website (https://airtrainr.com)
   - Contact email

### 2. Identity verification

Google requires:
- A scanned **government-issued ID** of an authorized representative
- For Organization accounts: **proof of business registration** (incorporation certificate, GST/VAT number, etc.)

Verification takes **1 - 3 business days** for Personal accounts and up to **2 weeks** for Organizations.

### 3. Set up payments (Merchant Account)

For accepting payments through the Play Store:
1. In Play Console, go to **Setup → Payments profile**
2. Add your **bank account** (same currency rules as Apple)
3. Complete **tax forms** (Google will prompt the correct form based on your country)

### 4. What to send us

Once your account is approved:

- The **email address** you used to sign up
- Add our team email as a user under **Users and Permissions** with the **Admin** role
- Google Cloud Project linked to the Play Console (we'll help you create one if needed for push notifications and Firebase)

---

## Things you should keep on file (forever)

These details belong to you and you should keep them safe — not just send to us once and forget.

| Item | Why it matters |
|---|---|
| Apple ID + password | Owns the app |
| Apple Team ID | Required for every build we ship |
| D-U-N-S Number | Reused if you ever change Apple agreements |
| Google Play Console email | Owns the Android listing |
| Bank account details on file with both stores | Where revenue lands |
| Business legal name + registration documents | Both stores will re-verify yearly |

Keep these in a password manager (1Password, Bitwarden, Apple iCloud Keychain) so you and your accountant can find them later.

---

## Timeline at a glance

| Step | Apple | Google |
|---|---|---|
| Get D-U-N-S | 3 - 14 days | n/a |
| Sign up + pay fee | 1 day | Same day |
| Identity / business verification | 2 - 7 days | 1 - 14 days |
| Bank + tax setup | 1 - 2 days | 1 - 2 days |
| First test build live (after we submit) | 24 - 48 hrs review | 2 - 24 hrs review |
| First public launch | Same day after approval | Same day after approval |

So plan for **2 - 4 weeks total** from "I want to start" to "App is live", driven mostly by Apple's verification.

---

## Costs at a glance (year 1)

| Item | Apple | Google |
|---|---|---|
| Developer fee | US $99/year | US $25 one-time |
| D-U-N-S Number | Free | n/a |
| Identity verification | Free | Free |
| **Total year 1** | **US $99** | **US $25** |
| Year 2+ | US $99/year | $0 (one-time) |

In-app revenue commission (separate from above):
- Apple: 15% (small business program, < $1M/year) or 30% standard
- Google: 15% (first $1M/year per developer) or 30% standard

This commission is taken automatically — you don't pay it separately.

---

## What we will give you when accounts are ready

Once you share the access:

1. We register the app under your team
2. We upload TestFlight (Apple) and Internal Testing (Google) builds for you to install on your own phone
3. After your sign-off, we submit for public review
4. We give you a maintenance handover doc so you know how future updates flow

---

## Questions you might get from Apple / Google during signup

- **"Why do you want to publish an app?"** — Marketplace connecting athletes with sports trainers for in-person and virtual sessions.
- **"What payments will be processed?"** — Trainer session bookings, processed via Stripe (web/payment processor) — the apps themselves do not sell digital goods, so Apple/Google in-app purchase rules do not apply.
- **"Privacy policy URL?"** — https://airtrainr.com/privacy (we will share the final URL once live).
- **"Support email?"** — Use a real email you check, e.g. `support@airtrainr.com`.

---

## Need help?

If anything is unclear during signup, save the screen / error you got and send it to our team. Most issues during signup are about business name mismatch (your legal name on file must EXACTLY match the name you type into Apple/Google) — we have seen this trip up many clients.
