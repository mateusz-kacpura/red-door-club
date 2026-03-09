
import { test, expect, type Page } from "@playwright/test";

const ADMIN_USER = {
  id: "00000000-0000-0000-0000-000000000001",
  email: "admin@thereddoor.club",
  full_name: "Admin User",
  role: "admin",
  is_superuser: true,
  tier: "Obsidian",
  is_active: true,
};

async function mockAuthAndDashboard(page: Page) {
  // Catch-all routes registered FIRST (lower priority — Playwright last-registered-wins)
  await page.route("**/api/members/**", (route) => route.fulfill({ json: {} }));
  await page.route("**/api/admin/**", (route) => route.fulfill({ json: {} }));
  // Specific routes registered LAST (highest priority — override the catch-alls above)
  await page.route("**/api/auth/me", (route) =>
    route.fulfill({ json: ADMIN_USER })
  );
  await page.route("**/api/auth/ws-token", (route) =>
    route.fulfill({ json: { token: "fake-ws-token" } })
  );
  await page.route("**/api/members/networking-report", (route) =>
    route.fulfill({
      json: {
        connections_count: 0,
        events_attended: 0,
        total_spent: 0,
        match_score_count: 0,
        top_segments: [],
        suggested_next_steps: [],
      },
    })
  );
  await page.route("**/api/members/suggestions**", (route) =>
    route.fulfill({ json: [] })
  );
  await page.route("**/api/members/points", (route) =>
    route.fulfill({ json: { balance: 0, lifetime_total: 0 } })
  );
  await page.route("**/api/members/engagement-health", (route) =>
    route.fulfill({ json: { risk_level: "healthy", tips: [] } })
  );
}

test.describe("Home — Unauthenticated", () => {
  test("/ shows the home landing page with login link", async ({ page }) => {
    // No storageState — user is anonymous
    await page.goto("/");

    // The home page shows links to Login and Register (it's a landing page, not a redirect)
    await expect(page.getByRole("link", { name: "Login" }).first()).toBeVisible({
      timeout: 5000,
    });
  });

  test("/login page renders heading and form", async ({ page }) => {
    await page.goto("/login");

    // CardTitle renders as <div class="text-2xl text-center">, not a heading element
    await expect(page.locator("div.text-2xl.text-center")).toBeVisible();
    await expect(page.locator("#email")).toBeVisible();
    await expect(page.locator("#password")).toBeVisible();
  });
});

test.describe("Home — Authenticated", () => {
  test.use({ storageState: ".playwright/.auth/user.json" });

  test("dashboard page loads with main content area", async ({ page }) => {
    await mockAuthAndDashboard(page);

    await page.goto("/dashboard");

    await expect(page.getByRole("main")).toBeVisible();
    await expect(page.locator("h1")).toBeVisible();
  });

  test("admin sidebar shows Smart Matching and Churn Risk links", async ({ page }) => {
    await mockAuthAndDashboard(page);
    await page.route("**/api/admin/**", (route) => route.fulfill({ json: {} }));

    await page.goto("/dashboard");

    // Both Smart Matching and Churn Risk are in adminNavigation — rendered together
    await expect(
      page.getByRole("link", { name: "Smart Matching" })
    ).toBeVisible({ timeout: 5000 });
    // Once Smart Matching is visible the whole admin section is in the DOM
    await expect(
      page.getByRole("link", { name: "Churn Risk" })
    ).toBeVisible({ timeout: 3000 });
  });

  test("member sidebar links are visible", async ({ page }) => {
    await mockAuthAndDashboard(page);

    await page.goto("/dashboard");

    await expect(
      page.getByRole("link", { name: "Connections" }).first()
    ).toBeVisible({ timeout: 5000 });
    await expect(
      page.getByRole("link", { name: "Networking" }).first()
    ).toBeVisible({ timeout: 5000 });
    await expect(
      page.getByRole("link", { name: "Loyalty" }).first()
    ).toBeVisible({ timeout: 5000 });
  });

  test("mobile viewport: dashboard accessible", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await mockAuthAndDashboard(page);

    await page.goto("/dashboard");

    await expect(page.getByRole("main")).toBeVisible();
  });

  test("tablet viewport: dashboard accessible", async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await mockAuthAndDashboard(page);

    await page.goto("/dashboard");

    await expect(page.getByRole("main")).toBeVisible();
  });
});
