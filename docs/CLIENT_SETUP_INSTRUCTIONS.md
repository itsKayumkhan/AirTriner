# AirTrainer — Client Setup & Testing Guide

Hi! This guide explains how to test the AirTrainer platform. It is written for non-technical users, so please just follow the numbered steps one at a time. If anything does not work, skip to the **Troubleshooting** section at the end.

---

## 1. Overview — What's Available

You have two ways to test AirTrainer right now:

1. **Web App (live)** — works on any computer or phone browser. No installation needed.
2. **Android Mobile App** — installed as an APK file on an Android phone (we will walk you through it).

> **Note:** The iPhone (iOS) version is not ready yet. For now, please use the web app on iPhone or use an Android phone for mobile testing.

---

## 2. Testing the Web App

### Step-by-step

1. Open any browser (Chrome, Safari, Edge, Firefox) on your laptop or phone.
2. Go to: **https://airtrainr.com** (or **https://www.airtrainr.com** — both work).
3. You will see the AirTrainer homepage. Click **Sign In** at the top right.

### Test Accounts

We have pre-created test accounts for you. The password is the same for all three and has been shared with you separately (please check the email/WhatsApp message we sent).

| Role | Email | What you can test |
|------|-------|-------------------|
| Athlete | (use your athlete test email) | Search for trainers, send offers, book sessions, chat, leave reviews |
| Trainer | (use your trainer test email) | Receive offers, accept/decline, chat with athletes, manage availability |
| Admin | kayum@gmail.com | See all users, bookings, payments, moderate content |

> **Tip:** You can also create your own fresh accounts by clicking **Sign Up**. This is the best way to experience what a brand-new user sees.

---

## 3. Installing the Android Mobile App

The Android app is shipped as an APK file (similar to an installer). Because it is not yet on the Google Play Store, you need to install it manually. This is safe — you are installing our build directly.

### Step 3.1 — Download the APK

1. On your **Android phone**, open Chrome (or any browser).
2. Go to this link:
   **https://expo.dev/accounts/kayumkhansayal/projects/AirTrainrApp/builds/6ab2e596-c378-40a3-8c14-047264706321**
3. You will see a page titled **"Build details"**.
4. Look for a button that says **"Install"** or **"Download"**. Tap it.
5. A file named something like `AirTrainrApp.apk` will start downloading.
6. Wait until the download finishes (usually 10–30 seconds).

> **If the page shows "Building..." or "In progress":** The build is not ready yet. Please wait 10–15 minutes and try again. Once it says **"Finished"**, you can download.

### Step 3.2 — Enable "Install from Unknown Sources"

Android blocks APK installs by default. You need to allow it once for your browser.

1. After tapping the downloaded APK, Android may show a warning: **"For your security, your phone is not allowed to install unknown apps from this source."**
2. Tap **Settings** on that warning popup.
3. Toggle **"Allow from this source"** to **ON** (the switch will turn blue/green).
4. Press the back button on your phone to return to the install screen.

> Different Android phones (Samsung, Xiaomi, OnePlus, etc.) word this slightly differently, but the flow is the same. Just follow whichever prompt appears.

### Step 3.3 — Install the APK

1. Tap the downloaded APK file again (either from the download notification, or open **Files / My Files** > **Downloads** > tap `AirTrainrApp.apk`).
2. Tap **Install**.
3. Wait 10–20 seconds.
4. When it finishes, tap **Open**.

### Step 3.4 — First Launch

When the app opens for the first time:

1. You will see the AirTrainer welcome screen.
2. You can either:
   - **Log in** with one of the test accounts (same credentials as the web app), OR
   - **Sign Up** fresh as a brand-new athlete or trainer.
3. Allow the permissions it asks for (location, camera, notifications) — these are needed for search and messaging.

---

## 4. What to Test — Checklist of Key Flows

Please test as many of these as possible, on both web and Android, and note down anything that feels broken, confusing, or slow.

### Sign-up & Profile
- [ ] Sign up as a new **athlete** (name, email, sport, location)
- [ ] Sign up as a new **trainer** (bio, sports, rate, photos)
- [ ] Upload a profile picture
- [ ] Edit your profile and save changes

### Search & Discovery
- [ ] As an athlete, search for trainers by sport
- [ ] Filter by location / radius
- [ ] Open a trainer profile and view their details

### Training Offers
- [ ] Send a training offer from athlete to a trainer (pick date, time, price)
- [ ] Log in as that trainer and see the incoming offer
- [ ] Accept the offer (or decline and see decline reason flow)
- [ ] Edit a sent offer before acceptance

### Booking & Payment
- [ ] Proceed to payment after offer is accepted
- [ ] Complete a test payment (use the test card info we shared)
- [ ] Confirm booking appears in both athlete and trainer dashboards

### Chat / Messages
- [ ] Open chat with the other party
- [ ] Send a message and confirm the other side receives it
- [ ] Send an image in chat

### Reviews
- [ ] After a completed session, leave a review for the trainer
- [ ] Check that the review appears on the trainer's public profile

### Notifications
- [ ] Check that push notifications arrive (Android) or email notifications (web) when a new offer / message comes in

---

## 5. Reporting Bugs

When you find something wrong, please report it like this. Even small things help — if something looked weird, tell us.

**Send an email to:** `support@digitalheroes.co.in`

Please include:

1. **What you were trying to do** — e.g., "I was trying to send a training offer."
2. **What happened instead** — e.g., "The app froze and showed a white screen."
3. **Screenshot or screen recording** — take a screenshot (on Android: power + volume down) and attach it.
4. **Device info** — phone model (e.g., "Samsung Galaxy S22") and Android version, OR browser name (Chrome, Safari) if web.
5. **Which account you used** — athlete / trainer / admin, and the email.
6. **Time** — roughly when it happened (we can check server logs).

> The more detail, the faster we can fix it. Do not worry about using technical words — just describe it in your own language.

---

## 6. Troubleshooting

### "The APK won't install — it says 'App not installed'"
- Make sure the download finished fully (file size should be around 60–100 MB).
- Uninstall any previous version of AirTrainer first, then try again.
- Restart your phone and re-install.
- Make sure you have at least 200 MB of free storage.

### "I can't log in — it says invalid credentials"
- Double-check the email and password (copy-paste from our message, watch for extra spaces).
- Try the web app first at https://airtrainr.com — if login works there, the mobile app should work too.
- If you forgot the password, use **Forgot Password** on the login screen and reset via email.

### "I can't see any trainers / athletes"
- Check that your location permission is granted (Android Settings > Apps > AirTrainer > Permissions > Location > Allow).
- Expand your search radius — by default it may be too narrow.
- Make sure there are test accounts in your area. You can always create another test trainer account on the web to populate results.

### "The payment failed"
- Use the test card details we shared (real cards should not be used in test mode).
- Check your internet connection.
- Try the web version — payment flows sometimes give clearer errors there.
- If it still fails, email us a screenshot of the error message.

### "The app crashes or closes by itself"
- Force-close the app (recent apps button > swipe away) and reopen.
- Restart the phone.
- Uninstall and reinstall the latest APK.
- Email us the device model and what you were doing when it crashed.

### "I did not receive notifications"
- On Android, open Settings > Apps > AirTrainer > Notifications > make sure everything is enabled.
- Check your email's spam/junk folder for email notifications.

### "The website looks broken"
- Try a different browser (Chrome works best).
- Clear the browser cache (Settings > Privacy > Clear browsing data).
- Try in incognito / private mode.

---

## Need Help?

If none of the troubleshooting steps work, just send an email to **support@digitalheroes.co.in** with a description of the problem and a screenshot. We will respond within 24 hours (usually much faster).

Thank you for testing AirTrainer! Your feedback is extremely valuable.
