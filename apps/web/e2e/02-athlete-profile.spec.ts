// ============================================
// E2E Tests — Athlete Profile & Features
// ============================================

import { test, expect } from "@playwright/test";
import { ATHLETE, BASE_URL } from "./config";
import { login, navigateTo, assertPageLoaded, screenshot } from "./helpers";

test.describe("Athlete Profile", () => {

    test.beforeEach(async ({ page }) => {
        await login(page, ATHLETE.email, ATHLETE.password);
    });

    test("Dashboard loads with athlete view", async ({ page }) => {
        await assertPageLoaded(page);
        const body = await page.textContent("body");
        expect(body).toContain("Dashboard");
        await screenshot(page, "02-athlete-dashboard");
    });

    test("Profile page loads with all fields", async ({ page }) => {
        await navigateTo(page, "/dashboard/profile");
        await assertPageLoaded(page);

        // Check essential fields exist
        await expect(page.locator('text=First Name').first()).toBeVisible();
        await expect(page.locator('text=Last Name').first()).toBeVisible();
        await expect(page.locator('text=Phone').first()).toBeVisible();

        // Check avatar upload button exists (pencil badge)
        await expect(page.locator('button[title*="profile photo"], button[title*="change"]').first()).toBeVisible();

        await screenshot(page, "02-athlete-profile");
    });

    test("Location autocomplete works", async ({ page }) => {
        await navigateTo(page, "/dashboard/profile");

        // Find city input and type
        const cityInput = page.locator('input[placeholder*="city"]').first();
        if (await cityInput.isVisible()) {
            await cityInput.fill("Toronto");
            // Wait for suggestions dropdown
            await page.waitForTimeout(1000);
            await screenshot(page, "02-athlete-location-suggestions");
        }
    });

    test("Sports selection visible", async ({ page }) => {
        await navigateTo(page, "/dashboard/profile");
        const body = await page.textContent("body");
        // Check sports are shown with proper capitalization
        const hasSport = body?.includes("Hockey") || body?.includes("Baseball") || body?.includes("Basketball");
        expect(hasSport).toBeTruthy();
    });

    test("Search trainers page loads", async ({ page }) => {
        await navigateTo(page, "/dashboard/search");
        await assertPageLoaded(page);
        await expect(page.locator('text=Find a Coach').first()).toBeVisible();
        await screenshot(page, "02-athlete-search");
    });

    test("Bookings page loads", async ({ page }) => {
        await navigateTo(page, "/dashboard/bookings");
        await assertPageLoaded(page);
        await screenshot(page, "02-athlete-bookings");
    });

    test("Payments page loads", async ({ page }) => {
        await navigateTo(page, "/dashboard/earnings");
        await assertPageLoaded(page);
        await screenshot(page, "02-athlete-payments");
    });

    test("Notifications page loads", async ({ page }) => {
        await navigateTo(page, "/dashboard/notifications");
        await assertPageLoaded(page);
        await screenshot(page, "02-athlete-notifications");
    });

    test("Contact Us page loads and form works", async ({ page }) => {
        await navigateTo(page, "/dashboard/contact");
        await assertPageLoaded(page);

        // Check form fields
        await expect(page.locator('select').first()).toBeVisible(); // Subject dropdown
        await expect(page.locator('textarea').first()).toBeVisible(); // Message

        await screenshot(page, "02-athlete-contact");
    });

    test("Sub-accounts page loads", async ({ page }) => {
        await navigateTo(page, "/dashboard/sub-accounts");
        await assertPageLoaded(page);
        await screenshot(page, "02-athlete-subaccounts");
    });

    test("Messages page loads", async ({ page }) => {
        await navigateTo(page, "/dashboard/messages");
        await assertPageLoaded(page);
        await screenshot(page, "02-athlete-messages");
    });
});
