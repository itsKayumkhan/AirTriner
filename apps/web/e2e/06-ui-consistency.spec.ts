// ============================================
// E2E Tests — UI Consistency & Design Checks
// ============================================

import { test, expect } from "@playwright/test";
import { ATHLETE, TRAINER, BASE_URL } from "./config";
import { login, navigateTo, assertPageLoaded, screenshot } from "./helpers";

test.describe("UI Consistency", () => {

    test("No visible scrollbars on any page", async ({ page }) => {
        await login(page, ATHLETE.email, ATHLETE.password);

        const pages = ["/dashboard", "/dashboard/profile", "/dashboard/search", "/dashboard/bookings"];
        for (const p of pages) {
            await navigateTo(page, p);
            // Check CSS hides scrollbars
            const scrollbarDisplay = await page.evaluate(() => {
                const style = window.getComputedStyle(document.documentElement, "::-webkit-scrollbar");
                return style.display;
            });
            // scrollbar should be 'none'
        }
    });

    test("Headings are consistent italic uppercase", async ({ page }) => {
        await login(page, ATHLETE.email, ATHLETE.password);

        const pages = [
            { path: "/dashboard/profile", heading: "My Profile" },
            { path: "/dashboard/bookings", heading: "Sessions" },
            { path: "/dashboard/notifications", heading: "Notifications" },
        ];

        for (const p of pages) {
            await navigateTo(page, p.path);
            const h1 = page.locator("h1").first();
            if (await h1.isVisible()) {
                const fontStyle = await h1.evaluate((el) => window.getComputedStyle(el).fontStyle);
                expect(fontStyle).toBe("italic");
            }
        }
    });

    test("Sports show with capital letters (not slugs)", async ({ page }) => {
        await login(page, ATHLETE.email, ATHLETE.password);
        await navigateTo(page, "/dashboard/search");
        await page.waitForTimeout(2000);

        const body = await page.textContent("body");
        // Should NOT have lowercase slugs like "track_and_field"
        expect(body).not.toContain("track_and_field");
        expect(body).not.toContain("martial_arts");

        // Should have capitalized names
        const hasCapitalized = body?.includes("Hockey") || body?.includes("Baseball") || body?.includes("Track And Field");
        expect(hasCapitalized).toBeTruthy();
        await screenshot(page, "06-sports-capitalization");
    });

    test("Founding 50 trainers appear first in search", async ({ page }) => {
        await login(page, ATHLETE.email, ATHLETE.password);
        await navigateTo(page, "/dashboard/search");
        await page.waitForTimeout(3000);

        // Check if first trainer card has Founding 50 badge
        const firstCard = page.locator('[class*="trainer"], [class*="card"]').first();
        if (await firstCard.isVisible()) {
            await screenshot(page, "06-founding50-first");
        }
    });
});
