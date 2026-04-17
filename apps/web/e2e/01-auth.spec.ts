// ============================================
// E2E Tests — Authentication Flows
// ============================================

import { test, expect } from "@playwright/test";
import { ADMIN, ATHLETE, TRAINER, BASE_URL } from "./config";
import { login, navigateTo, assertPageLoaded, screenshot } from "./helpers";

test.describe("Authentication", () => {

    test("Login page loads", async ({ page }) => {
        await page.goto(`${BASE_URL}/auth/login`);
        await assertPageLoaded(page);
        await expect(page.locator('input[type="email"]')).toBeVisible();
        await expect(page.locator('input[type="password"]')).toBeVisible();
        await screenshot(page, "01-login-page");
    });

    test("Register page loads (no Apple login)", async ({ page }) => {
        await page.goto(`${BASE_URL}/auth/register`);
        await assertPageLoaded(page);
        // Apple login should be removed
        const body = await page.textContent("body");
        expect(body).not.toContain("Apple");
        await screenshot(page, "01-register-page");
    });

    test("Athlete can login", async ({ page }) => {
        await login(page, ATHLETE.email, ATHLETE.password);
        await expect(page).toHaveURL(/\/dashboard/);
        await screenshot(page, "01-athlete-dashboard");
    });

    test("Trainer can login", async ({ page }) => {
        await login(page, TRAINER.email, TRAINER.password);
        await expect(page).toHaveURL(/\/dashboard/);
        await screenshot(page, "01-trainer-dashboard");
    });

    test("Admin can login", async ({ page }) => {
        await login(page, ADMIN.email, ADMIN.password);
        await expect(page).toHaveURL(/\/dashboard/);
        await screenshot(page, "01-admin-dashboard");
    });
});
