
import { test as setup } from "@playwright/test";
import path from "path";
import fs from "fs";

const authFile = path.join(__dirname, "../.playwright/.auth/user.json");

const ADMIN_USER = {
  id: "00000000-0000-0000-0000-000000000001",
  email: "admin@thereddoor.club",
  full_name: "Admin User",
  role: "admin",
  is_superuser: true,
  tier: "Obsidian",
  is_active: true,
  segment_groups: ["Finance & Investors", "Tech & Founders"],
  company_name: "The Red Door",
  industry: "Hospitality",
};

/**
 * Authentication setup — runs before all tests.
 *
 * Creates an authenticated session by:
 * 1. Adding fake auth cookies (all API calls in tests are mocked via page.route())
 * 2. Populating the Zustand auth store in localStorage
 *
 * No real backend required for setup.
 */
setup("authenticate", async ({ page, context }) => {
  // Ensure the auth directory exists before saving the state
  fs.mkdirSync(path.dirname(authFile), { recursive: true });

  // Add fake auth cookies (values don't matter — all API calls are mocked in tests)
  await context.addCookies([
    {
      name: "access_token",
      value: "e2e-test-access-token",
      url: "http://localhost:3001",
      httpOnly: true,
      sameSite: "Lax",
    },
    {
      name: "refresh_token",
      value: "e2e-test-refresh-token",
      url: "http://localhost:3001",
      httpOnly: true,
      sameSite: "Lax",
    },
  ]);

  // Mock auth/me so any page that calls it gets a valid user
  await page.route("**/api/auth/me", async (route) => {
    await route.fulfill({ json: ADMIN_USER });
  });

  // Load a page to access localStorage
  await page.goto("/");

  // Populate Zustand persist store so sidebar shows admin links immediately
  await page.evaluate((user) => {
    localStorage.setItem(
      "auth-storage",
      JSON.stringify({ state: { user, isAuthenticated: true }, version: 0 })
    );
  }, ADMIN_USER);

  await context.storageState({ path: authFile });
});
