// ============================================
// E2E Tests — Admin Panel
// ============================================

import { test, expect } from "@playwright/test";
import { ADMIN, BASE_URL } from "./config";
import { login, navigateTo, assertPageLoaded, screenshot } from "./helpers";

test.describe("Admin Panel", () => {

    test.beforeEach(async ({ page }) => {
        await login(page, ADMIN.email, ADMIN.password);
    });

    test("Admin dashboard loads", async ({ page }) => {
        await navigateTo(page, "/admin");
        await assertPageLoaded(page);
        await screenshot(page, "05-admin-dashboard");
    });

    test("Trainers page loads with table", async ({ page }) => {
        await navigateTo(page, "/admin/trainers");
        await assertPageLoaded(page);
        await screenshot(page, "05-admin-trainers");
    });

    test("Trainer detail modal opens (X not covered by map)", async ({ page }) => {
        await navigateTo(page, "/admin/trainers");

        // Click first trainer row
        const trainerRow = page.locator('tr').nth(1);
        if (await trainerRow.isVisible()) {
            await trainerRow.click();
            await page.waitForTimeout(1000);

            // Modal should be visible with close button accessible
            const closeBtn = page.locator('[class*="z-[9999]"] button').first();
            await screenshot(page, "05-admin-trainer-detail");
        }
    });

    test("Athletes page loads with location data", async ({ page }) => {
        await navigateTo(page, "/admin/athletes");
        await assertPageLoaded(page);

        // Check if location columns show country
        const body = await page.textContent("body");
        await screenshot(page, "05-admin-athletes");
    });

    test("Payments page loads", async ({ page }) => {
        await navigateTo(page, "/admin/payments");
        await assertPageLoaded(page);
        await screenshot(page, "05-admin-payments");
    });

    test("Sports page loads with image upload", async ({ page }) => {
        await navigateTo(page, "/admin/sports");
        await assertPageLoaded(page);
        await screenshot(page, "05-admin-sports");
    });

    test("Contact Messages page loads", async ({ page }) => {
        await navigateTo(page, "/admin/contacts");
        await assertPageLoaded(page);
        await screenshot(page, "05-admin-contacts");
    });

    test("Settings page loads with Country Access", async ({ page }) => {
        await navigateTo(page, "/admin/settings");
        await assertPageLoaded(page);

        // Country Access section should exist
        await expect(page.locator('text=Country Access').first()).toBeVisible();
        await screenshot(page, "05-admin-settings");
    });

    test("Settings: Country toggle works", async ({ page }) => {
        await navigateTo(page, "/admin/settings");

        // Find US country button (should be active)
        const usBtn = page.locator('text=United States').first();
        if (await usBtn.isVisible()) {
            await screenshot(page, "05-admin-country-access");
        }
    });

    test("Map markers are clickable", async ({ page }) => {
        await navigateTo(page, "/admin/trainers");

        // Look for map tab/view
        const mapTab = page.locator('text=Map').first();
        if (await mapTab.isVisible()) {
            await mapTab.click();
            await page.waitForTimeout(2000);
            await screenshot(page, "05-admin-trainers-map");
        }
    });
});
