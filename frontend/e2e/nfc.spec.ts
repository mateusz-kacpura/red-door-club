
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

async function mockAuth(page: Page) {
  await page.route("**/api/auth/me", async (route) => {
    await route.fulfill({ json: ADMIN_USER });
  });
  await page.route("**/api/auth/ws-token", async (route) => {
    await route.fulfill({ json: { token: "fake-ws-token" } });
  });
}

// ---------------------------------------------------------------------------
// Setup Page — NFC Card Activation (/setup?cid=...)
// ---------------------------------------------------------------------------
test.describe("Setup — NFC Card Activation", () => {
  test("shows Card Activation heading and NFC Card Setup title", async ({ page }) => {
    // Unauthenticated
    await page.route("**/api/auth/me", async (route) => {
      await route.fulfill({ status: 401, json: { detail: "Not authenticated" } });
    });
    await page.route("**/api/auth/refresh", async (route) => {
      await route.fulfill({ status: 401, json: { detail: "Not authenticated" } });
    });

    await page.goto("/setup?cid=NFC-TEST-001");

    await expect(page.getByText("Card Activation")).toBeVisible({ timeout: 5000 });
    await expect(page.getByText("NFC Card Setup")).toBeVisible({ timeout: 5000 });
  });

  test("shows card ID from query param", async ({ page }) => {
    await page.route("**/api/auth/me", async (route) => {
      await route.fulfill({ status: 401, json: { detail: "Not authenticated" } });
    });
    await page.route("**/api/auth/refresh", async (route) => {
      await route.fulfill({ status: 401, json: { detail: "Not authenticated" } });
    });

    await page.goto("/setup?cid=NFC-ABC-999");

    await expect(page.getByText("NFC-ABC-999")).toBeVisible({ timeout: 5000 });
  });

  test("unauthenticated user sees Log In and Register buttons", async ({ page }) => {
    await page.route("**/api/auth/me", async (route) => {
      await route.fulfill({ status: 401, json: { detail: "Not authenticated" } });
    });
    await page.route("**/api/auth/refresh", async (route) => {
      await route.fulfill({ status: 401, json: { detail: "Not authenticated" } });
    });

    await page.goto("/setup?cid=NFC-TEST-001");

    await expect(page.getByText("To activate your NFC card")).toBeVisible({ timeout: 5000 });
    await expect(page.getByRole("button", { name: "Log In" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Register" })).toBeVisible();
  });

  test.describe("Authenticated", () => {
    test.use({ storageState: ".playwright/.auth/user.json" });

    test("auto-binds card and shows success state", async ({ page }) => {
      await mockAuth(page);
      await page.route("**/api/nfc/bind", async (route) => {
        await route.fulfill({ json: { status: "bound" } });
      });

      await page.goto("/setup?cid=NFC-TEST-001");

      await expect(page.getByText("Card activated!")).toBeVisible({ timeout: 10000 });
      await expect(page.getByText("Redirecting to your dashboard")).toBeVisible();
    });

    test("shows error state and Try Again button on bind failure", async ({ page }) => {
      await mockAuth(page);
      await page.route("**/api/nfc/bind", async (route) => {
        await route.fulfill({ status: 400, json: { detail: "Card already bound to another member" } });
      });

      await page.goto("/setup?cid=NFC-TEST-001");

      await expect(page.getByText("Card already bound to another member")).toBeVisible({ timeout: 10000 });
      await expect(page.getByRole("button", { name: "Try Again" })).toBeVisible();
    });

    test("shows fallback error on network failure", async ({ page }) => {
      await mockAuth(page);
      await page.route("**/api/nfc/bind", async (route) => {
        await route.abort("failed");
      });

      await page.goto("/setup?cid=NFC-TEST-001");

      await expect(page.getByText("Failed to activate card")).toBeVisible({ timeout: 10000 });
    });
  });
});

// ---------------------------------------------------------------------------
// Tap Page — NFC Tap Results (/tap?cid=...)
// ---------------------------------------------------------------------------
test.describe("Tap — NFC Tap Results", () => {
  test("shows error when no cid param", async ({ page }) => {
    await page.goto("/tap");

    await expect(page.getByText("Something went wrong")).toBeVisible({ timeout: 5000 });
    await expect(page.getByText("Invalid card")).toBeVisible();
  });

  test("shows loading spinner while reading card", async ({ page }) => {
    await page.route("**/api/nfc/tap**", async (route) => {
      await new Promise((r) => setTimeout(r, 3000));
      await route.fulfill({ json: { action: "welcome", message: null, member_name: "Test", redirect_url: null } });
    });

    await page.goto("/tap?cid=NFC-001");

    await expect(page.getByText("Reading card...")).toBeVisible({ timeout: 3000 });
  });

  test("welcome action shows welcome message and Go to Dashboard button", async ({ page }) => {
    await page.route("**/api/nfc/tap**", async (route) => {
      await route.fulfill({
        json: { action: "welcome", message: "Enjoy your evening", member_name: "Alice", redirect_url: null },
      });
    });

    await page.goto("/tap?cid=NFC-001");

    await expect(page.getByText("Welcome back, Alice")).toBeVisible({ timeout: 5000 });
    await expect(page.getByText("Enjoy your evening")).toBeVisible();
    await expect(page.getByRole("button", { name: "Go to Dashboard" })).toBeVisible();
  });

  test("welcome action without member name shows generic welcome", async ({ page }) => {
    await page.route("**/api/nfc/tap**", async (route) => {
      await route.fulfill({
        json: { action: "welcome", message: null, member_name: null, redirect_url: null },
      });
    });

    await page.goto("/tap?cid=NFC-001");

    await expect(page.getByText("Welcome back")).toBeVisible({ timeout: 5000 });
  });

  test("card_suspended action shows Card Deactivated", async ({ page }) => {
    await page.route("**/api/nfc/tap**", async (route) => {
      await route.fulfill({
        json: { action: "card_suspended", message: "This card has been deactivated.", member_name: null, redirect_url: null },
      });
    });

    await page.goto("/tap?cid=NFC-001");

    await expect(page.getByText("Card Deactivated")).toBeVisible({ timeout: 5000 });
    await expect(page.getByText("This card has been deactivated.")).toBeVisible();
    await expect(page.getByText("Please contact club staff")).toBeVisible();
  });

  test("connection_made action shows Connected! and View Connections button", async ({ page }) => {
    await page.route("**/api/nfc/tap**", async (route) => {
      await route.fulfill({
        json: { action: "connection_made", message: null, member_name: "Bob", redirect_url: null },
      });
    });

    await page.goto("/tap?cid=NFC-001");

    await expect(page.getByText("Connected!")).toBeVisible({ timeout: 5000 });
    await expect(page.getByText("You are now connected with Bob.")).toBeVisible();
    await expect(page.getByRole("button", { name: "View Connections" })).toBeVisible();
  });

  test("payment_added action shows Added to Tab and View Tab button", async ({ page }) => {
    await page.route("**/api/nfc/tap**", async (route) => {
      await route.fulfill({
        json: { action: "payment_added", message: "฿350 added to your tab", member_name: null, redirect_url: null },
      });
    });

    await page.goto("/tap?cid=NFC-001");

    await expect(page.getByText("Added to Tab")).toBeVisible({ timeout: 5000 });
    await expect(page.getByText("฿350 added to your tab")).toBeVisible();
    await expect(page.getByRole("button", { name: "View Tab" })).toBeVisible();
  });

  test("locker_assigned action shows Locker Assigned and View Locker button", async ({ page }) => {
    await page.route("**/api/nfc/tap**", async (route) => {
      await route.fulfill({
        json: { action: "locker_assigned", message: "Locker A07 assigned", member_name: null, redirect_url: null },
      });
    });

    await page.goto("/tap?cid=NFC-001");

    await expect(page.getByText("Locker Assigned")).toBeVisible({ timeout: 5000 });
    await expect(page.getByText("Locker A07 assigned")).toBeVisible();
    await expect(page.getByRole("button", { name: "View Locker" })).toBeVisible();
  });

  test("locker_released action shows Locker Released", async ({ page }) => {
    await page.route("**/api/nfc/tap**", async (route) => {
      await route.fulfill({
        json: { action: "locker_released", message: "Your locker has been released", member_name: null, redirect_url: null },
      });
    });

    await page.goto("/tap?cid=NFC-001");

    await expect(page.getByText("Locker Released")).toBeVisible({ timeout: 5000 });
    await expect(page.getByText("Your locker has been released")).toBeVisible();
  });

  test("locker_occupied action shows Locker Unavailable", async ({ page }) => {
    await page.route("**/api/nfc/tap**", async (route) => {
      await route.fulfill({
        json: { action: "locker_occupied", message: "This locker is already in use", member_name: null, redirect_url: null },
      });
    });

    await page.goto("/tap?cid=NFC-001");

    await expect(page.getByText("Locker Unavailable")).toBeVisible({ timeout: 5000 });
    await expect(page.getByText("This locker is already in use")).toBeVisible();
  });

  test("locker_already_assigned shows Already Assigned", async ({ page }) => {
    await page.route("**/api/nfc/tap**", async (route) => {
      await route.fulfill({
        json: { action: "locker_already_assigned", message: "You already have a locker", member_name: null, redirect_url: null },
      });
    });

    await page.goto("/tap?cid=NFC-001");

    await expect(page.getByText("Already Assigned")).toBeVisible({ timeout: 5000 });
    await expect(page.getByText("You already have a locker")).toBeVisible();
  });

  test("API error shows Something went wrong", async ({ page }) => {
    await page.route("**/api/nfc/tap**", async (route) => {
      await route.fulfill({ status: 500, json: { detail: "Internal server error" } });
    });

    await page.goto("/tap?cid=NFC-001");

    await expect(page.getByText("Something went wrong")).toBeVisible({ timeout: 5000 });
    await expect(page.getByText("Internal server error")).toBeVisible();
  });

  test("setup action redirects to /setup page", async ({ page }) => {
    await page.route("**/api/nfc/tap**", async (route) => {
      await route.fulfill({
        json: { action: "setup", message: null, member_name: null, redirect_url: "/setup?cid=NFC-NEW" },
      });
    });

    await page.goto("/tap?cid=NFC-NEW", { waitUntil: "commit" });

    await expect(page).toHaveURL(/\/setup\?cid=NFC-NEW/, { timeout: 10000 });
  });
});
