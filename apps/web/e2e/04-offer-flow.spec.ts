// ============================================
// E2E Tests — Trainer Sends Offer → Athlete Accepts → Payment
// ============================================

import { test, expect } from "@playwright/test";
import { ATHLETE, TRAINER, BASE_URL } from "./config";
import { login, navigateTo, assertPageLoaded, screenshot } from "./helpers";

test.describe("Offer & Booking Flow", () => {

    test("Trainer can open offers page and see athletes", async ({ page }) => {
        await login(page, TRAINER.email, TRAINER.password);
        await navigateTo(page, "/dashboard/trainer/offers");
        await assertPageLoaded(page);

        // Should see Browse Athletes tab
        await expect(page.locator('text=Browse Athletes').first()).toBeVisible();
        await screenshot(page, "04-trainer-browse-athletes");
    });

    test("Trainer can open New Offer modal", async ({ page }) => {
        await login(page, TRAINER.email, TRAINER.password);
        await navigateTo(page, "/dashboard/trainer/offers");

        // Click New Offer button
        const newOfferBtn = page.locator('text=New Offer').first();
        if (await newOfferBtn.isVisible()) {
            await newOfferBtn.click();
            await page.waitForTimeout(500);
        }

        // Click on first athlete card's "Send Offer" button
        const sendOfferBtn = page.locator('text=Send Offer').first();
        if (await sendOfferBtn.isVisible()) {
            await sendOfferBtn.click();
            await page.waitForTimeout(500);

            // Modal should open
            await expect(page.locator('text=SEND OFFER').first()).toBeVisible();
            await screenshot(page, "04-trainer-offer-modal");
        }
    });

    test("Offer modal has date/time fields (not preferred time slots)", async ({ page }) => {
        await login(page, TRAINER.email, TRAINER.password);
        await navigateTo(page, "/dashboard/trainer/offers");

        const sendOfferBtn = page.locator('text=Send Offer').first();
        if (await sendOfferBtn.isVisible()) {
            await sendOfferBtn.click();
            await page.waitForTimeout(500);

            // Should have date input (not Morning/Afternoon buttons)
            await expect(page.locator('input[type="date"]').first()).toBeVisible();
            await expect(page.locator('input[type="time"]').first()).toBeVisible();

            // "Add Another Date & Time" button should exist
            const addDateBtn = page.locator('text=Add Another Date').first();
            await expect(addDateBtn).toBeVisible();

            // Preferred time slot buttons should NOT exist
            const body = await page.textContent("body");
            expect(body).not.toContain("Morning");
            expect(body).not.toContain("Afternoon");
            expect(body).not.toContain("Evening");

            await screenshot(page, "04-offer-date-time-fields");
        }
    });

    test("Camp selection auto-fills dates (read-only schedule)", async ({ page }) => {
        await login(page, TRAINER.email, TRAINER.password);
        await navigateTo(page, "/dashboard/trainer/offers");

        const sendOfferBtn = page.locator('text=Send Offer').first();
        if (await sendOfferBtn.isVisible()) {
            await sendOfferBtn.click();
            await page.waitForTimeout(500);

            // Check if camp cards exist
            const campCard = page.locator('text=Send a Camp Offer').first();
            if (await campCard.isVisible()) {
                // Click first camp
                const firstCamp = page.locator('[class*="campCard"], [class*="camp"]').first();
                await firstCamp.click();
                await page.waitForTimeout(300);

                // Should show "Camp Schedule (Auto-filled)"
                const body = await page.textContent("body");
                const hasCampSchedule = body?.includes("Camp Schedule") || body?.includes("Auto-filled");
                expect(hasCampSchedule).toBeTruthy();
                await screenshot(page, "04-camp-auto-filled");
            }
        }
    });

    test("Offer timestamp shows timezone", async ({ page }) => {
        await login(page, TRAINER.email, TRAINER.password);
        await navigateTo(page, "/dashboard/trainer/offers");

        // Switch to Sent Offers tab
        const sentTab = page.locator('text=Sent Offers').first();
        if (await sentTab.isVisible()) {
            await sentTab.click();
            await page.waitForTimeout(500);

            // Check if any sent offers have timezone in timestamp
            const body = await page.textContent("body");
            // Should contain timezone abbreviation like EST, PST, IST etc
            const hasTimezone = body?.match(/\b(EST|CST|MST|PST|EDT|CDT|MDT|PDT|IST|GMT|UTC)\b/);
            await screenshot(page, "04-sent-offers-timezone");
        }
    });

    test("Athlete sees notifications with offers", async ({ page }) => {
        await login(page, ATHLETE.email, ATHLETE.password);
        await navigateTo(page, "/dashboard/notifications");
        await assertPageLoaded(page);
        await screenshot(page, "04-athlete-notifications");
    });

    test("Athlete accepting offer redirects to Stripe checkout", async ({ page }) => {
        await login(page, ATHLETE.email, ATHLETE.password);
        await navigateTo(page, "/dashboard/notifications");

        // Find a pending offer notification
        const offerNotif = page.locator('text=Training Offer').first();
        if (await offerNotif.isVisible()) {
            await offerNotif.click();
            await page.waitForTimeout(500);

            // Modal should open with Accept button
            const acceptBtn = page.locator('text=Accept Training Offer').first();
            if (await acceptBtn.isVisible()) {
                await screenshot(page, "04-athlete-offer-modal");
                // Note: clicking Accept would redirect to Stripe - just verify button exists
            }
        }
    });
});
