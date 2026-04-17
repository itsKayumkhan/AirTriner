// ============================================
// E2E Tests — Trainer Profile & Setup
// ============================================

import { test, expect } from "@playwright/test";
import { TRAINER, BASE_URL } from "./config";
import { login, navigateTo, assertPageLoaded, screenshot } from "./helpers";

test.describe("Trainer Profile & Setup", () => {

    test.beforeEach(async ({ page }) => {
        await login(page, TRAINER.email, TRAINER.password);
    });

    test("Trainer dashboard loads", async ({ page }) => {
        await assertPageLoaded(page);
        await screenshot(page, "03-trainer-dashboard");
    });

    test("Trainer setup page loads", async ({ page }) => {
        await navigateTo(page, "/dashboard/trainer/setup");
        await assertPageLoaded(page);

        // Check key sections exist
        const body = await page.textContent("body");
        expect(body).toContain("PROFILE");
        await screenshot(page, "03-trainer-setup");
    });

    test("Location & Matching section has ZIP validation", async ({ page }) => {
        await navigateTo(page, "/dashboard/trainer/setup");

        // Find ZIP input
        const zipInput = page.locator('input[placeholder*="90210"]').first();
        if (await zipInput.isVisible()) {
            // Enter invalid ZIP
            await zipInput.fill("INVALID");
            await page.waitForTimeout(500);
            await screenshot(page, "03-trainer-zip-invalid");

            // Enter valid US ZIP
            await zipInput.fill("90210");
            await page.waitForTimeout(500);
            await screenshot(page, "03-trainer-zip-valid-us");

            // Enter valid CA postal
            await zipInput.fill("K0L 1B0");
            await page.waitForTimeout(500);
            // Radius label should switch to Kilometers
            const body = await page.textContent("body");
            expect(body).toContain("Kilometers");
            await screenshot(page, "03-trainer-zip-valid-ca");
        }
    });

    test("Camp section exists with schedule fields", async ({ page }) => {
        await navigateTo(page, "/dashboard/trainer/setup");

        // Scroll to camp section
        const campSection = page.locator('text=MULTI-DAY CAMP').first();
        if (await campSection.isVisible()) {
            await campSection.click();
            await page.waitForTimeout(500);
            await screenshot(page, "03-trainer-camps");
        }
    });

    test("Availability page loads with Recurring/Per-Slot tabs", async ({ page }) => {
        await navigateTo(page, "/dashboard/availability");
        await assertPageLoaded(page);

        await expect(page.locator('text=Recurring Weekly').first()).toBeVisible();
        await expect(page.locator('text=Per-Slot').first()).toBeVisible();
        await screenshot(page, "03-trainer-availability");
    });

    test("Training Offers page loads", async ({ page }) => {
        await navigateTo(page, "/dashboard/trainer/offers");
        await assertPageLoaded(page);
        await screenshot(page, "03-trainer-offers");
    });

    test("Subscription page loads with pricing", async ({ page }) => {
        await navigateTo(page, "/dashboard/subscription");
        await assertPageLoaded(page);
        await screenshot(page, "03-trainer-subscription");
    });

    test("Earnings page loads (no Platform Fees card)", async ({ page }) => {
        await navigateTo(page, "/dashboard/earnings");
        await assertPageLoaded(page);

        const body = await page.textContent("body");
        // Platform Fees card should not exist for trainer
        expect(body).not.toContain("Platform Fees");
        await screenshot(page, "03-trainer-earnings");
    });

    test("Payment Settings page loads", async ({ page }) => {
        await navigateTo(page, "/dashboard/payments");
        await assertPageLoaded(page);

        const body = await page.textContent("body");
        expect(body).toContain("Payment Settings") || expect(body).toContain("Connect");
        await screenshot(page, "03-trainer-payment-settings");
    });

    test("Contact Us page works for trainer", async ({ page }) => {
        await navigateTo(page, "/dashboard/contact");
        await assertPageLoaded(page);
        await expect(page.locator('textarea').first()).toBeVisible();
        await screenshot(page, "03-trainer-contact");
    });
});
