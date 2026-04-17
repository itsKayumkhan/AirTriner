// ============================================
// E2E Test Helpers — Login, Navigation, Assertions
// ============================================

import { Page, expect } from "@playwright/test";
import { BASE_URL } from "./config";

/**
 * Login as a specific user
 */
export async function login(page: Page, email: string, password: string) {
    await page.goto(`${BASE_URL}/auth/login`);
    await page.waitForLoadState("networkidle");

    // Fill email
    const emailInput = page.locator('input[type="email"]');
    await emailInput.fill(email);

    // Fill password
    const passwordInput = page.locator('input[type="password"]');
    await passwordInput.fill(password);

    // Click login button
    const loginBtn = page.locator('button[type="submit"]');
    await loginBtn.click();

    // Wait for redirect to dashboard
    await page.waitForURL(/\/dashboard/, { timeout: 15000 });
}

/**
 * Navigate to a dashboard page
 */
export async function navigateTo(page: Page, path: string) {
    await page.goto(`${BASE_URL}${path}`);
    await page.waitForLoadState("networkidle");
}

/**
 * Check page has loaded (no 404, no error)
 */
export async function assertPageLoaded(page: Page) {
    // Check the visible page title/heading — not raw body (which includes Next.js internals)
    const title = await page.title();
    expect(title).not.toBe("");
    // Check no error overlay visible
    const errorOverlay = page.locator('[id="__next-build-error"], [class*="nextjs-error"]');
    expect(await errorOverlay.count()).toBe(0);
}

/**
 * Wait for toast notification
 */
export async function waitForToast(page: Page, text?: string) {
    const toast = page.locator('[class*="toast"], [role="alert"]').first();
    await toast.waitFor({ timeout: 10000 });
    if (text) {
        await expect(toast).toContainText(text);
    }
}

/**
 * Take screenshot with descriptive name
 */
export async function screenshot(page: Page, name: string) {
    await page.screenshot({ path: `e2e/screenshots/${name}.png`, fullPage: true });
}
