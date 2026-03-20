
import { test, expect, type Page } from "@playwright/test";

const PROMOTER_USER = {
  id: "00000000-0000-0000-0000-000000000099",
  email: "promo@thereddoor.club",
  full_name: "Promo User",
  role: "member",
  is_superuser: false,
  is_promoter: true,
  user_type: "promoter",
  tier: "Silver",
  is_active: true,
};

async function mockAuth(page: Page) {
  await page.route("**/api/auth/me", (route) =>
    route.fulfill({ json: PROMOTER_USER })
  );
  await page.route("**/api/auth/ws-token", (route) =>
    route.fulfill({ json: { token: "fake-ws-token" } })
  );
}

// ─── Promoter Dashboard ──────────────────────────────────────────────────────

const DASHBOARD_STATS = {
  total_codes: 5,
  total_uses: 42,
  total_revenue: 128000,
  commission_earned: 19200,
  pending_payout: 4800,
};

test.describe("Promoter — Dashboard", () => {
  test.use({ storageState: ".playwright/.auth/user.json" });

  test("shows 'Promoter Dashboard' heading", async ({ page }) => {
    await mockAuth(page);
    await page.route("**/api/promoters/dashboard", (route) =>
      route.fulfill({ json: DASHBOARD_STATS })
    );

    await page.goto("/promoter/dashboard");

    await expect(
      page.getByText("Promoter Dashboard")
    ).toBeVisible({ timeout: 5000 });
  });

  test("shows subtitle text", async ({ page }) => {
    await mockAuth(page);
    await page.route("**/api/promoters/dashboard", (route) =>
      route.fulfill({ json: DASHBOARD_STATS })
    );

    await page.goto("/promoter/dashboard");

    await expect(
      page.getByText("Track your referrals and commissions")
    ).toBeVisible({ timeout: 5000 });
  });

  test("displays stat cards with correct values", async ({ page }) => {
    await mockAuth(page);
    await page.route("**/api/promoters/dashboard", (route) =>
      route.fulfill({ json: DASHBOARD_STATS })
    );

    await page.goto("/promoter/dashboard");

    // Total Codes: 5
    await expect(page.getByText("Total Codes")).toBeVisible({ timeout: 5000 });
    await expect(page.getByText("5")).toBeVisible();

    // Total Conversions: 42
    await expect(page.getByText("Total Conversions")).toBeVisible();
    await expect(page.getByText("42")).toBeVisible();
  });

  test("shows formatted currency for revenue and commission", async ({ page }) => {
    await mockAuth(page);
    await page.route("**/api/promoters/dashboard", (route) =>
      route.fulfill({ json: DASHBOARD_STATS })
    );

    await page.goto("/promoter/dashboard");

    // Revenue Attributed: ฿128,000
    await expect(page.getByText("Revenue Attributed")).toBeVisible({ timeout: 5000 });
    await expect(page.getByText("฿128,000")).toBeVisible();

    // Commission Earned: ฿19,200
    await expect(page.getByText("Commission Earned")).toBeVisible();
    await expect(page.getByText("฿19,200")).toBeVisible();

    // Pending Payout: ฿4,800
    await expect(page.getByText("Pending Payout")).toBeVisible();
    await expect(page.getByText("฿4,800")).toBeVisible();
  });

  test("shows Manage QR Codes and Payout Requests quick-link buttons", async ({ page }) => {
    await mockAuth(page);
    await page.route("**/api/promoters/dashboard", (route) =>
      route.fulfill({ json: DASHBOARD_STATS })
    );

    await page.goto("/promoter/dashboard");

    await expect(
      page.getByRole("button", { name: /Manage QR Codes/i })
    ).toBeVisible({ timeout: 5000 });
    await expect(
      page.getByRole("button", { name: /Payout Requests/i })
    ).toBeVisible();
  });

  test("shows zero values when API returns error", async ({ page }) => {
    await mockAuth(page);
    await page.route("**/api/promoters/dashboard", (route) =>
      route.fulfill({ status: 500, body: "Internal Server Error" })
    );

    await page.goto("/promoter/dashboard");

    // When API fails, stats is null, and all values fall back to ?? 0
    await expect(page.getByText("Promoter Dashboard")).toBeVisible({ timeout: 5000 });
    // All stat values should be "0" or "฿0"
    const zeroValues = page.getByText("0", { exact: true });
    await expect(zeroValues.first()).toBeVisible();
  });
});

// ─── Promo Codes ─────────────────────────────────────────────────────────────

const PROMO_CODES = [
  {
    id: "code-uuid-1",
    code: "VIP2024",
    tier_grant: "Gold",
    quota: 100,
    uses_count: 15,
    reg_commission: 500,
    checkin_commission_flat: 100,
    checkin_commission_pct: null,
    is_active: true,
    created_at: "2024-06-01T10:00:00",
  },
  {
    id: "code-uuid-2",
    code: "SUMMER",
    tier_grant: null,
    quota: 0,
    uses_count: 3,
    reg_commission: 200,
    checkin_commission_flat: null,
    checkin_commission_pct: 5,
    is_active: false,
    created_at: "2024-07-01T10:00:00",
  },
];

test.describe("Promoter — Promo Codes", () => {
  test.use({ storageState: ".playwright/.auth/user.json" });

  test("shows 'QR Promo Codes' heading", async ({ page }) => {
    await mockAuth(page);
    await page.route("**/api/promoters/codes", (route) =>
      route.fulfill({ json: PROMO_CODES })
    );

    await page.goto("/promoter/codes");

    await expect(
      page.getByText("QR Promo Codes")
    ).toBeVisible({ timeout: 5000 });
  });

  test("shows empty state when no codes", async ({ page }) => {
    await mockAuth(page);
    await page.route("**/api/promoters/codes", (route) =>
      route.fulfill({ json: [] })
    );

    await page.goto("/promoter/codes");

    await expect(
      page.getByText("No promo codes yet")
    ).toBeVisible({ timeout: 5000 });
  });

  test("displays code names", async ({ page }) => {
    await mockAuth(page);
    await page.route("**/api/promoters/codes", (route) =>
      route.fulfill({ json: PROMO_CODES })
    );

    await page.goto("/promoter/codes");

    await expect(page.getByText("VIP2024").first()).toBeVisible({ timeout: 5000 });
    await expect(page.getByText("SUMMER").first()).toBeVisible();
  });

  test("shows uses count", async ({ page }) => {
    await mockAuth(page);
    await page.route("**/api/promoters/codes", (route) =>
      route.fulfill({ json: PROMO_CODES })
    );

    await page.goto("/promoter/codes");

    // "15 uses" and "3 uses"
    await expect(page.getByText("15 uses")).toBeVisible({ timeout: 5000 });
    await expect(page.getByText("3 uses")).toBeVisible();
  });

  test("shows commission amount", async ({ page }) => {
    await mockAuth(page);
    await page.route("**/api/promoters/codes", (route) =>
      route.fulfill({ json: PROMO_CODES })
    );

    await page.goto("/promoter/codes");

    // ฿500 commission displayed for first code
    await expect(page.getByText("฿500")).toBeVisible({ timeout: 5000 });
    // "commission" label
    await expect(page.getByText("commission").first()).toBeVisible();
  });

  test("shows QR URL hint", async ({ page }) => {
    await mockAuth(page);
    await page.route("**/api/promoters/codes", (route) =>
      route.fulfill({ json: PROMO_CODES })
    );

    await page.goto("/promoter/codes");

    // URL hint contains "/qr-register?promo=VIP2024"
    await expect(
      page.getByText(/qr-register\?promo=VIP2024/)
    ).toBeVisible({ timeout: 5000 });
  });

  test("clicking 'New Code' opens creation form", async ({ page }) => {
    await mockAuth(page);
    await page.route("**/api/promoters/codes", (route) =>
      route.fulfill({ json: PROMO_CODES })
    );

    await page.goto("/promoter/codes");

    const newCodeButton = page.getByRole("button", { name: /New Code/i });
    await expect(newCodeButton).toBeVisible({ timeout: 5000 });
    await newCodeButton.click();

    // Form should now be visible with "Create Promo Code" title
    await expect(page.getByText("Create Promo Code")).toBeVisible();
  });

  test("creation form has input and Create/Cancel buttons", async ({ page }) => {
    await mockAuth(page);
    await page.route("**/api/promoters/codes", (route) =>
      route.fulfill({ json: [] })
    );

    await page.goto("/promoter/codes");

    await page.getByRole("button", { name: /New Code/i }).click();

    // Input with placeholder
    await expect(page.getByPlaceholder("e.g. PRO-07")).toBeVisible();

    // Create and Cancel buttons
    await expect(
      page.getByRole("button", { name: "Create" })
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Cancel" })
    ).toBeVisible();
  });

  test("successfully creating a code shows success toast", async ({ page }) => {
    await mockAuth(page);
    await page.route("**/api/promoters/codes", (route) => {
      if (route.request().method() === "GET") {
        return route.fulfill({ json: [] });
      }
      // POST — successful creation
      return route.fulfill({
        status: 200,
        json: {
          id: "new-code-uuid",
          code: "NEWCODE",
          tier_grant: null,
          quota: 0,
          uses_count: 0,
          reg_commission: 300,
          checkin_commission_flat: null,
          checkin_commission_pct: null,
          is_active: true,
          created_at: "2024-08-01T10:00:00",
        },
      });
    });

    await page.goto("/promoter/codes");

    await page.getByRole("button", { name: /New Code/i }).click();
    await page.getByPlaceholder("e.g. PRO-07").fill("NEWCODE");
    await page.getByRole("button", { name: "Create" }).click();

    // Success toast: "Code created"
    await expect(page.getByText("Code created")).toBeVisible({ timeout: 5000 });
  });

  test("failed creation shows error toast", async ({ page }) => {
    await mockAuth(page);
    await page.route("**/api/promoters/codes", (route) => {
      if (route.request().method() === "GET") {
        return route.fulfill({ json: [] });
      }
      // POST — failure
      return route.fulfill({
        status: 400,
        json: { detail: "Code already exists" },
      });
    });

    await page.goto("/promoter/codes");

    await page.getByRole("button", { name: /New Code/i }).click();
    await page.getByPlaceholder("e.g. PRO-07").fill("DUPLICATE");
    await page.getByRole("button", { name: "Create" }).click();

    // Error toast: "Failed"
    await expect(page.getByText("Failed")).toBeVisible({ timeout: 5000 });
  });

  test("Cancel hides the creation form", async ({ page }) => {
    await mockAuth(page);
    await page.route("**/api/promoters/codes", (route) =>
      route.fulfill({ json: [] })
    );

    await page.goto("/promoter/codes");

    // Open form
    await page.getByRole("button", { name: /New Code/i }).click();
    await expect(page.getByText("Create Promo Code")).toBeVisible({ timeout: 5000 });

    // Cancel
    await page.getByRole("button", { name: "Cancel" }).click();

    // Form should be hidden
    await expect(page.getByText("Create Promo Code")).not.toBeVisible();
  });
});

// ─── Payouts ─────────────────────────────────────────────────────────────────

const PAYOUT_REQUESTS = [
  {
    id: "payout-uuid-1",
    amount: 5000,
    status: "pending",
    notes: null,
    created_at: "2024-08-01T12:00:00",
    processed_at: null,
  },
  {
    id: "payout-uuid-2",
    amount: 12000,
    status: "approved",
    notes: "Approved by manager",
    created_at: "2024-07-15T10:00:00",
    processed_at: null,
  },
  {
    id: "payout-uuid-3",
    amount: 8000,
    status: "paid",
    notes: null,
    created_at: "2024-07-01T09:00:00",
    processed_at: "2024-07-10T14:00:00",
  },
];

test.describe("Promoter — Payouts", () => {
  test.use({ storageState: ".playwright/.auth/user.json" });

  test("shows 'Payout Requests' heading", async ({ page }) => {
    await mockAuth(page);
    await page.route("**/api/promoters/payouts", (route) =>
      route.fulfill({ json: PAYOUT_REQUESTS })
    );

    await page.goto("/promoter/payouts");

    await expect(
      page.getByText("Payout Requests", { exact: false })
    ).toBeVisible({ timeout: 5000 });
  });

  test("shows empty state when no payouts", async ({ page }) => {
    await mockAuth(page);
    await page.route("**/api/promoters/payouts", (route) =>
      route.fulfill({ json: [] })
    );

    await page.goto("/promoter/payouts");

    await expect(
      page.getByText("No payout requests yet")
    ).toBeVisible({ timeout: 5000 });
  });

  test("displays payout amounts", async ({ page }) => {
    await mockAuth(page);
    await page.route("**/api/promoters/payouts", (route) =>
      route.fulfill({ json: PAYOUT_REQUESTS })
    );

    await page.goto("/promoter/payouts");

    await expect(page.getByText("฿5,000")).toBeVisible({ timeout: 5000 });
    await expect(page.getByText("฿12,000")).toBeVisible();
    await expect(page.getByText("฿8,000")).toBeVisible();
  });

  test("shows status badge for pending (yellow styling)", async ({ page }) => {
    await mockAuth(page);
    await page.route("**/api/promoters/payouts", (route) =>
      route.fulfill({
        json: [PAYOUT_REQUESTS[0]], // pending
      })
    );

    await page.goto("/promoter/payouts");

    const badge = page.getByText("pending", { exact: true });
    await expect(badge).toBeVisible({ timeout: 5000 });
    // Badge has yellow class applied via statusColor map
    await expect(badge).toHaveClass(/yellow/);
  });

  test("shows status badge for approved (blue styling)", async ({ page }) => {
    await mockAuth(page);
    await page.route("**/api/promoters/payouts", (route) =>
      route.fulfill({
        json: [PAYOUT_REQUESTS[1]], // approved
      })
    );

    await page.goto("/promoter/payouts");

    const badge = page.getByText("approved", { exact: true });
    await expect(badge).toBeVisible({ timeout: 5000 });
    await expect(badge).toHaveClass(/blue/);
  });

  test("shows status badge for paid (green styling)", async ({ page }) => {
    await mockAuth(page);
    await page.route("**/api/promoters/payouts", (route) =>
      route.fulfill({
        json: [PAYOUT_REQUESTS[2]], // paid
      })
    );

    await page.goto("/promoter/payouts");

    const badge = page.getByText("paid", { exact: true });
    await expect(badge).toBeVisible({ timeout: 5000 });
    await expect(badge).toHaveClass(/emerald/);
  });

  test("clicking 'Request Payout' opens form", async ({ page }) => {
    await mockAuth(page);
    await page.route("**/api/promoters/payouts", (route) =>
      route.fulfill({ json: [] })
    );

    await page.goto("/promoter/payouts");

    const requestButton = page.getByRole("button", { name: /Request Payout/i });
    await expect(requestButton).toBeVisible({ timeout: 5000 });
    await requestButton.click();

    // Form should appear with "New Payout Request" title
    await expect(page.getByText("New Payout Request")).toBeVisible();
  });

  test("submitting valid amount calls POST", async ({ page }) => {
    let postCalled = false;
    await mockAuth(page);
    await page.route("**/api/promoters/payouts", (route) => {
      if (route.request().method() === "GET") {
        return route.fulfill({ json: [] });
      }
      // POST
      postCalled = true;
      return route.fulfill({
        status: 200,
        json: {
          id: "new-payout-uuid",
          amount: 3000,
          status: "pending",
          notes: null,
          created_at: "2024-08-15T12:00:00",
          processed_at: null,
        },
      });
    });

    await page.goto("/promoter/payouts");

    await page.getByRole("button", { name: /Request Payout/i }).click();
    await page.getByPlaceholder("Amount (฿)").fill("3000");
    await page.getByRole("button", { name: "Submit" }).click();

    // Success toast
    await expect(page.getByText("Payout requested")).toBeVisible({ timeout: 5000 });
    expect(postCalled).toBe(true);
  });

  test("Cancel closes the payout form", async ({ page }) => {
    await mockAuth(page);
    await page.route("**/api/promoters/payouts", (route) =>
      route.fulfill({ json: [] })
    );

    await page.goto("/promoter/payouts");

    await page.getByRole("button", { name: /Request Payout/i }).click();
    await expect(page.getByText("New Payout Request")).toBeVisible({ timeout: 5000 });

    await page.getByRole("button", { name: "Cancel" }).click();
    await expect(page.getByText("New Payout Request")).not.toBeVisible();
  });
});

// ─── Referrals ───────────────────────────────────────────────────────────────

const REFERRALS = [
  {
    user_full_name: "Alice Johnson",
    promo_code: "VIP2024",
    registered_at: "2024-08-10T14:30:00",
  },
  {
    user_full_name: null,
    promo_code: "SUMMER",
    registered_at: "2024-08-12T09:15:00",
  },
  {
    user_full_name: "Bob Smith",
    promo_code: "VIP2024",
    registered_at: "2024-08-14T18:45:00",
  },
];

test.describe("Promoter — Referrals", () => {
  test.use({ storageState: ".playwright/.auth/user.json" });

  test("shows 'Referrals' heading", async ({ page }) => {
    await mockAuth(page);
    await page.route("**/api/promoters/referrals", (route) =>
      route.fulfill({ json: REFERRALS })
    );

    await page.goto("/promoter/referrals");

    await expect(
      page.getByRole("heading", { name: "Referrals" })
    ).toBeVisible({ timeout: 5000 });
  });

  test("shows empty state when no referrals", async ({ page }) => {
    await mockAuth(page);
    await page.route("**/api/promoters/referrals", (route) =>
      route.fulfill({ json: [] })
    );

    await page.goto("/promoter/referrals");

    await expect(
      page.getByText("No referrals yet")
    ).toBeVisible({ timeout: 5000 });
  });

  test("displays referral names", async ({ page }) => {
    await mockAuth(page);
    await page.route("**/api/promoters/referrals", (route) =>
      route.fulfill({ json: REFERRALS })
    );

    await page.goto("/promoter/referrals");

    await expect(page.getByText("Alice Johnson")).toBeVisible({ timeout: 5000 });
    await expect(page.getByText("Bob Smith")).toBeVisible();
  });

  test("shows 'Anonymous' for null names", async ({ page }) => {
    await mockAuth(page);
    await page.route("**/api/promoters/referrals", (route) =>
      route.fulfill({ json: REFERRALS })
    );

    await page.goto("/promoter/referrals");

    // Second referral has user_full_name: null → "Anonymous"
    await expect(page.getByText("Anonymous")).toBeVisible({ timeout: 5000 });
  });

  test("shows promo code for each referral", async ({ page }) => {
    await mockAuth(page);
    await page.route("**/api/promoters/referrals", (route) =>
      route.fulfill({ json: REFERRALS })
    );

    await page.goto("/promoter/referrals");

    // VIP2024 appears for two referrals, SUMMER for one
    const vipCodes = page.getByText("VIP2024");
    await expect(vipCodes.first()).toBeVisible({ timeout: 5000 });

    await expect(page.getByText("SUMMER")).toBeVisible();
  });
});
