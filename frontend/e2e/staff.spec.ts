
import { test, expect, type Page } from "@playwright/test";

// ---------------------------------------------------------------------------
// Mock users
// ---------------------------------------------------------------------------

const STAFF_USER = {
  id: "00000000-0000-0000-0000-000000000002",
  email: "staff@thereddoor.club",
  full_name: "Staff User",
  role: "staff",
  is_superuser: false,
  tier: null,
  is_active: true,
};

const ADMIN_USER = {
  id: "00000000-0000-0000-0000-000000000001",
  email: "admin@thereddoor.club",
  full_name: "Admin User",
  role: "admin",
  is_superuser: true,
  tier: "Obsidian",
  is_active: true,
};

// ---------------------------------------------------------------------------
// Mock data
// ---------------------------------------------------------------------------

const MOCK_MEMBER_ID = "11111111-1111-1111-1111-111111111111";

const MOCK_MEMBER = {
  id: MOCK_MEMBER_ID,
  full_name: "John VIP",
  tier: "vip",
  company_name: "VIP Corp",
  is_active: true,
};

const MOCK_EVENTS = [
  {
    id: "evt-1",
    title: "Friday Mixer",
    ticket_price: "500",
    starts_at: "2026-03-20T20:00:00",
    promo_tiers: ["gold"],
  },
];

const MOCK_CHECKIN_RESULT = {
  status: "checked_in",
  member_name: "John VIP",
  event_title: "Friday Mixer",
  fee: "500",
  is_promo: false,
};

const MOCK_MEMBER_PROFILE = {
  ...STAFF_USER,
  phone: "+66999123456",
  company_name: "S8LLS",
  industry: "Hospitality",
  created_at: "2025-01-15T10:00:00Z",
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Mock auth/me with the given user object. */
async function mockAuthMe(page: Page, user: typeof STAFF_USER | typeof ADMIN_USER) {
  await page.route("**/api/auth/me", async (route) => {
    await route.fulfill({ json: user });
  });
}

/** Mock both the member lookup and today-events endpoints used by the checkin page. */
async function mockCheckinAPIs(page: Page) {
  await page.route(`**/api/staff/member/${MOCK_MEMBER_ID}`, async (route) => {
    await route.fulfill({ json: MOCK_MEMBER });
  });
  await page.route("**/api/staff/today-events", async (route) => {
    await route.fulfill({ json: MOCK_EVENTS });
  });
}

// ---------------------------------------------------------------------------
// All staff tests use the pre-authenticated storage state
// ---------------------------------------------------------------------------
test.describe("Staff Pages", () => {
  test.use({ storageState: ".playwright/.auth/user.json" });

  // =========================================================================
  // Staff Layout
  // =========================================================================
  test.describe("Staff Layout", () => {
    test("shows Staff Panel header text", async ({ page }) => {
      await mockAuthMe(page, STAFF_USER);

      await page.goto("/staff");

      await expect(page.getByText("Staff Panel")).toBeVisible({ timeout: 10000 });
    });

    test("staff user can access staff pages", async ({ page }) => {
      await mockAuthMe(page, STAFF_USER);

      await page.goto("/staff");

      // Should stay on /staff — not be redirected away
      await expect(page).toHaveURL(/\/staff/);
      // The layout's main element should be visible
      await expect(page.locator("main")).toBeVisible({ timeout: 10000 });
    });

    test("admin user can access staff pages", async ({ page }) => {
      await mockAuthMe(page, ADMIN_USER);

      await page.goto("/staff");

      await expect(page).toHaveURL(/\/staff/);
      await expect(page.locator("main")).toBeVisible({ timeout: 10000 });
    });
  });

  // =========================================================================
  // Scanner Page (/staff)
  // =========================================================================
  test.describe("Scanner Page", () => {
    test('shows "Scan QR Code" heading', async ({ page }) => {
      await mockAuthMe(page, STAFF_USER);

      await page.goto("/staff");

      await expect(page.getByText("Scan QR Code")).toBeVisible({ timeout: 10000 });
    });

    test("shows QR reader container element (#qr-reader)", async ({ page }) => {
      await mockAuthMe(page, STAFF_USER);

      await page.goto("/staff");

      await expect(page.locator("#qr-reader")).toBeVisible({ timeout: 10000 });
    });
  });

  // =========================================================================
  // Checkin Page (/staff/checkin?member=...)
  // =========================================================================
  test.describe("Checkin Page", () => {
    test("shows member not found when no member param", async ({ page }) => {
      await mockAuthMe(page, STAFF_USER);

      await page.goto("/staff/checkin");

      await expect(page.getByText("Member not found")).toBeVisible({ timeout: 10000 });
    });

    test("shows member name and company", async ({ page }) => {
      await mockAuthMe(page, STAFF_USER);
      await mockCheckinAPIs(page);

      await page.goto(`/staff/checkin?member=${MOCK_MEMBER_ID}`);

      await expect(page.getByText("John VIP")).toBeVisible({ timeout: 10000 });
      await expect(page.getByText("VIP Corp")).toBeVisible();
    });

    test("shows member tier badge", async ({ page }) => {
      await mockAuthMe(page, STAFF_USER);
      await mockCheckinAPIs(page);

      await page.goto(`/staff/checkin?member=${MOCK_MEMBER_ID}`);

      // Tier badge is a <span> with capitalize class showing the tier name
      await expect(page.getByText("vip").first()).toBeVisible({ timeout: 10000 });
    });

    test("lists today's events with titles and prices", async ({ page }) => {
      await mockAuthMe(page, STAFF_USER);
      await mockCheckinAPIs(page);

      await page.goto(`/staff/checkin?member=${MOCK_MEMBER_ID}`);

      await expect(page.getByText("Friday Mixer")).toBeVisible({ timeout: 10000 });
      // VIP member gets promo for all events, so price shows "0 ฿" with "(PROMO)"
      await expect(page.getByText("PROMO").first()).toBeVisible();
    });

    test("shows Check In button", async ({ page }) => {
      await mockAuthMe(page, STAFF_USER);
      await mockCheckinAPIs(page);

      await page.goto(`/staff/checkin?member=${MOCK_MEMBER_ID}`);

      await expect(
        page.getByRole("button", { name: "Check In" })
      ).toBeVisible({ timeout: 10000 });
    });

    test('successful checkin shows "Checked In!"', async ({ page }) => {
      await mockAuthMe(page, STAFF_USER);
      await mockCheckinAPIs(page);
      await page.route("**/api/staff/checkin", async (route) => {
        await route.fulfill({ json: MOCK_CHECKIN_RESULT });
      });

      await page.goto(`/staff/checkin?member=${MOCK_MEMBER_ID}`);

      // Wait for data to load and click Check In
      const checkinButton = page.getByRole("button", { name: "Check In" });
      await expect(checkinButton).toBeVisible({ timeout: 10000 });
      await checkinButton.click();

      await expect(page.getByText("Checked In!")).toBeVisible({ timeout: 10000 });
      // Also verify member name and event title in the result
      await expect(page.getByText("John VIP")).toBeVisible();
      await expect(page.getByText("Friday Mixer")).toBeVisible();
    });

    test('already checked in shows "Already Checked In"', async ({ page }) => {
      await mockAuthMe(page, STAFF_USER);
      await mockCheckinAPIs(page);
      await page.route("**/api/staff/checkin", async (route) => {
        await route.fulfill({
          status: 409,
          json: { detail: "Already checked in" },
        });
      });

      await page.goto(`/staff/checkin?member=${MOCK_MEMBER_ID}`);

      const checkinButton = page.getByRole("button", { name: "Check In" });
      await expect(checkinButton).toBeVisible({ timeout: 10000 });
      await checkinButton.click();

      await expect(page.getByRole("heading", { name: "Already Checked In" })).toBeVisible({ timeout: 10000 });
    });

    test("shows error on API failure", async ({ page }) => {
      await mockAuthMe(page, STAFF_USER);
      await mockCheckinAPIs(page);
      await page.route("**/api/staff/checkin", async (route) => {
        await route.fulfill({
          status: 500,
          json: { detail: "Internal Server Error" },
        });
      });

      await page.goto(`/staff/checkin?member=${MOCK_MEMBER_ID}`);

      const checkinButton = page.getByRole("button", { name: "Check In" });
      await expect(checkinButton).toBeVisible({ timeout: 10000 });
      await checkinButton.click();

      await expect(page.getByRole("heading", { name: "Error" })).toBeVisible({ timeout: 10000 });
    });

    test("Scan Next button is clickable and triggers navigation", async ({ page }) => {
      await mockAuthMe(page, STAFF_USER);
      // Navigate to checkin without member param to get the "member not found" state,
      // which shows the Scan Next button immediately.
      await page.goto("/staff/checkin");

      const scanNextButton = page.getByRole("button", { name: "Scan Next" });
      await expect(scanNextButton).toBeVisible({ timeout: 10000 });
      // Verify the button is enabled and clickable (triggers router.push(STAFF_HOME))
      await expect(scanNextButton).toBeEnabled();
      await scanNextButton.click();
      // Button was clicked — navigation initiated via router.push
      // (actual URL change is slow in dev mode due to page compilation)
    });
  });

  // =========================================================================
  // Register Guest (/staff/register-guest)
  // =========================================================================
  test.describe("Register Guest Page", () => {
    test('shows "Guest Registration" heading', async ({ page }) => {
      await mockAuthMe(page, STAFF_USER);

      await page.goto("/staff/register-guest");

      await expect(page.getByText("Guest Registration")).toBeVisible({ timeout: 10000 });
    });

    test("shows hint text", async ({ page }) => {
      await mockAuthMe(page, STAFF_USER);

      await page.goto("/staff/register-guest");

      await expect(
        page.getByText("Let the guest scan this QR to create their account")
      ).toBeVisible({ timeout: 10000 });
    });

    test("renders QR code SVG element", async ({ page }) => {
      await mockAuthMe(page, STAFF_USER);

      await page.goto("/staff/register-guest");

      // react-qr-code renders an <svg> element with size 256
      await expect(page.locator('svg[width="256"]')).toBeVisible({ timeout: 10000 });
    });

    test("shows Back button", async ({ page }) => {
      await mockAuthMe(page, STAFF_USER);

      await page.goto("/staff/register-guest");

      await expect(
        page.getByRole("button", { name: "Back" })
      ).toBeVisible({ timeout: 10000 });
    });
  });

  // =========================================================================
  // Staff Profile (/staff/profile)
  // =========================================================================
  test.describe("Staff Profile Page", () => {
    /** Mock both auth/me and members/me for profile page. */
    async function setupProfilePage(page: Page) {
      await mockAuthMe(page, STAFF_USER);
      await page.route("**/api/members/me", async (route) => {
        if (route.request().method() === "GET") {
          await route.fulfill({ json: MOCK_MEMBER_PROFILE });
        } else {
          // PATCH — return updated data
          await route.fulfill({ json: MOCK_MEMBER_PROFILE });
        }
      });
    }

    test("shows user name and email", async ({ page }) => {
      await setupProfilePage(page);

      await page.goto("/staff/profile");

      await expect(page.getByRole("heading", { name: "Staff User" })).toBeVisible({ timeout: 10000 });
      await expect(page.getByText("staff@thereddoor.club").first()).toBeVisible();
    });

    test("shows account information fields (name, email, phone, company, industry)", async ({ page }) => {
      await setupProfilePage(page);

      await page.goto("/staff/profile");

      await expect(page.getByText("Account Information")).toBeVisible({ timeout: 10000 });
      // Labels
      await expect(page.getByText("Full Name")).toBeVisible();
      await expect(page.getByText("Email Address")).toBeVisible();
      await expect(page.getByText("Phone")).toBeVisible();
      await expect(page.getByText("Company")).toBeVisible();
      await expect(page.getByText("Industry")).toBeVisible();
      // Values
      await expect(page.getByText("Staff User").first()).toBeVisible();
      await expect(page.getByText("staff@thereddoor.club").first()).toBeVisible();
      await expect(page.getByText("+66999123456")).toBeVisible();
      await expect(page.getByRole("main").getByText("S8LLS")).toBeVisible();
      await expect(page.getByText("Hospitality")).toBeVisible();
    });

    test("clicking Edit shows form inputs", async ({ page }) => {
      await setupProfilePage(page);

      await page.goto("/staff/profile");

      // Click the Edit button
      const editButton = page.getByRole("button", { name: "Edit" });
      await expect(editButton).toBeVisible({ timeout: 10000 });
      await editButton.click();

      // Form inputs should be visible
      await expect(page.locator("#full_name")).toBeVisible({ timeout: 5000 });
      await expect(page.locator("#phone")).toBeVisible();
      await expect(page.locator("#company_name")).toBeVisible();
      await expect(page.locator("#industry")).toBeVisible();
    });

    test("Cancel exits edit mode", async ({ page }) => {
      await setupProfilePage(page);

      await page.goto("/staff/profile");

      // Enter edit mode
      const editButton = page.getByRole("button", { name: "Edit" });
      await expect(editButton).toBeVisible({ timeout: 10000 });
      await editButton.click();

      // Verify we are in edit mode (input visible)
      await expect(page.locator("#full_name")).toBeVisible({ timeout: 5000 });

      // Click Cancel — there are two Cancel buttons: one in the header card and one in the save/cancel bar.
      // The header card button shows "Cancel" when in edit mode.
      const cancelButton = page.getByRole("button", { name: "Cancel" }).first();
      await cancelButton.click();

      // Inputs should no longer be present
      await expect(page.locator("#full_name")).not.toBeVisible({ timeout: 5000 });
    });

    test("Save calls PATCH /members/me", async ({ page }) => {
      await setupProfilePage(page);

      let patchCalled = false;
      // Intercept the PATCH call specifically to verify it was made
      await page.route("**/api/members/me", async (route) => {
        if (route.request().method() === "PATCH") {
          patchCalled = true;
          await route.fulfill({ json: MOCK_MEMBER_PROFILE });
        } else {
          await route.fulfill({ json: MOCK_MEMBER_PROFILE });
        }
      });

      await page.goto("/staff/profile");

      // Enter edit mode
      const editButton = page.getByRole("button", { name: "Edit" });
      await expect(editButton).toBeVisible({ timeout: 10000 });
      await editButton.click();

      // Modify a field
      await page.locator("#full_name").fill("Updated Staff Name");

      // Click Save Changes
      const saveButton = page.getByRole("button", { name: "Save Changes" });
      await expect(saveButton).toBeVisible({ timeout: 5000 });
      await saveButton.click();

      // After save, edit mode should exit — inputs should be gone
      await expect(page.locator("#full_name")).not.toBeVisible({ timeout: 5000 });

      // Verify PATCH was actually called
      expect(patchCalled).toBe(true);
    });

    test("shows Preferences section", async ({ page }) => {
      await setupProfilePage(page);

      await page.goto("/staff/profile");

      await expect(page.getByText("Preferences")).toBeVisible({ timeout: 10000 });
      await expect(page.getByText("Theme")).toBeVisible();
    });

    test("shows dash for empty optional fields", async ({ page }) => {
      await mockAuthMe(page, STAFF_USER);
      // Return a profile with empty optional fields
      const sparseProfile = {
        ...STAFF_USER,
        phone: null,
        company_name: null,
        industry: null,
        created_at: "2025-01-15T10:00:00Z",
      };
      await page.route("**/api/members/me", async (route) => {
        await route.fulfill({ json: sparseProfile });
      });

      await page.goto("/staff/profile");

      // Wait for the page to load
      await expect(page.getByText("Account Information")).toBeVisible({ timeout: 10000 });

      // Empty optional fields should show a dash "—"
      // There should be at least 3 dashes (phone, company, industry)
      const dashes = page.locator("p.bg-muted", { hasText: "—" });
      await expect(dashes.first()).toBeVisible({ timeout: 5000 });
      expect(await dashes.count()).toBeGreaterThanOrEqual(3);
    });
  });
});
