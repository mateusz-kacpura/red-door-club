
import { test, expect } from "@playwright/test";

const ADMIN_USER = {
  id: "00000000-0000-0000-0000-000000000001",
  email: "admin@thereddoor.club",
  full_name: "Admin User",
  role: "admin",
  is_superuser: true,
  tier: "Obsidian",
  is_active: true,
};

const PUBLIC_PROFILE = {
  id: "member-uuid-123",
  full_name: "Jane Smith",
  company_name: "Acme Corp",
  industry: "Technology",
};

// ---------------------------------------------------------------------------
// Register Form (/register)
// ---------------------------------------------------------------------------
test.describe("Register Form", () => {
  test("shows register form with name, email, password, confirm password inputs and Register button", async ({
    page,
  }) => {
    await page.goto("/register");

    await expect(page.locator("#name")).toBeVisible({ timeout: 5000 });
    await expect(page.locator("#email")).toBeVisible({ timeout: 5000 });
    await expect(page.locator("#password")).toBeVisible({ timeout: 5000 });
    await expect(page.locator("#confirmPassword")).toBeVisible({ timeout: 5000 });
    await expect(page.getByRole("button", { name: /register/i })).toBeVisible({ timeout: 5000 });
  });

  test("shows Login link", async ({ page }) => {
    await page.goto("/register");

    const loginLink = page.getByRole("link", { name: /login/i });
    await expect(loginLink).toBeVisible({ timeout: 5000 });
  });

  test("shows password mismatch error when passwords differ", async ({ page }) => {
    await page.goto("/register");

    await page.locator("#name").fill("Test User");
    await page.locator("#email").fill("test@example.com");
    await page.locator("#password").fill("password123");
    await page.locator("#confirmPassword").fill("differentpassword");
    await page.getByRole("button", { name: /register/i }).click();

    await expect(page.getByText(/passwords do not match/i)).toBeVisible({ timeout: 5000 });
  });

  test("redirects to /login?registered=true on successful registration", async ({ page }) => {
    await page.route("**/api/auth/register", async (route) => {
      await route.fulfill({
        status: 200,
        json: { id: "new-user-id", email: "newuser@example.com" },
      });
    });

    // Mock auth/me to prevent auth check interference (returns 401 = not logged in)
    await page.route("**/api/auth/me", async (route) => {
      await route.fulfill({ status: 401, json: { detail: "Not authenticated" } });
    });
    await page.route("**/api/auth/refresh", async (route) => {
      await route.fulfill({ status: 401, json: { detail: "Not authenticated" } });
    });

    await page.goto("/register");

    await page.locator("#name").fill("New User");
    await page.locator("#email").fill("newuser@example.com");
    await page.locator("#password").fill("password123");
    await page.locator("#confirmPassword").fill("password123");

    // Verify the registration API is called (form submitted successfully → router.push to /login)
    const responsePromise = page.waitForResponse("**/api/auth/register");
    await page.getByRole("button", { name: /register/i }).click();
    const response = await responsePromise;
    expect(response.status()).toBe(200);
  });

  test("shows error on duplicate email (422)", async ({ page }) => {
    await page.route("**/api/auth/register", async (route) => {
      await route.fulfill({
        status: 422,
        json: { detail: "Email already registered" },
      });
    });

    await page.route("**/api/auth/me", async (route) => {
      await route.fulfill({ status: 401, json: { detail: "Not authenticated" } });
    });
    await page.route("**/api/auth/refresh", async (route) => {
      await route.fulfill({ status: 401, json: { detail: "Not authenticated" } });
    });

    await page.goto("/register");

    await page.locator("#name").fill("Existing User");
    await page.locator("#email").fill("existing@example.com");
    await page.locator("#password").fill("password123");
    await page.locator("#confirmPassword").fill("password123");
    await page.getByRole("button", { name: /register/i }).click();

    await expect(page.getByText(/email already registered/i)).toBeVisible({ timeout: 5000 });
  });

  test("shows fallback error on network failure", async ({ page }) => {
    await page.route("**/api/auth/register", async (route) => {
      await route.abort("failed");
    });

    await page.route("**/api/auth/me", async (route) => {
      await route.fulfill({ status: 401, json: { detail: "Not authenticated" } });
    });
    await page.route("**/api/auth/refresh", async (route) => {
      await route.fulfill({ status: 401, json: { detail: "Not authenticated" } });
    });

    await page.goto("/register");

    await page.locator("#name").fill("Test User");
    await page.locator("#email").fill("test@example.com");
    await page.locator("#password").fill("password123");
    await page.locator("#confirmPassword").fill("password123");
    await page.getByRole("button", { name: /register/i }).click();

    // Should show error text via the .text-destructive class
    await expect(page.locator(".text-destructive")).toBeVisible({ timeout: 5000 });
  });

  test("inputs are disabled while submitting", async ({ page }) => {
    // Mock a delayed response so we can observe the loading state
    await page.route("**/api/auth/register", async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 3000));
      await route.fulfill({
        status: 200,
        json: { id: "new-user-id", email: "test@example.com" },
      });
    });

    await page.route("**/api/auth/me", async (route) => {
      await route.fulfill({ status: 401, json: { detail: "Not authenticated" } });
    });
    await page.route("**/api/auth/refresh", async (route) => {
      await route.fulfill({ status: 401, json: { detail: "Not authenticated" } });
    });

    await page.goto("/register");

    await page.locator("#name").fill("Test User");
    await page.locator("#email").fill("test@example.com");
    await page.locator("#password").fill("password123");
    await page.locator("#confirmPassword").fill("password123");
    await page.getByRole("button", { name: /register/i }).click();

    // While the request is in-flight, inputs should be disabled
    await expect(page.locator("#name")).toBeDisabled({ timeout: 5000 });
    await expect(page.locator("#email")).toBeDisabled({ timeout: 5000 });
    await expect(page.locator("#password")).toBeDisabled({ timeout: 5000 });
    await expect(page.locator("#confirmPassword")).toBeDisabled({ timeout: 5000 });
  });
});

// ---------------------------------------------------------------------------
// QR Register Form (/qr-register) — Multi-step wizard
// ---------------------------------------------------------------------------
test.describe("QR Register Form", () => {
  test("Step 1 shows full_name, email, phone, nationality inputs", async ({ page }) => {
    await page.goto("/qr-register");

    // Step 1 heading
    await expect(page.getByText("Step 1 — Identity")).toBeVisible({ timeout: 5000 });

    // All Step 1 fields
    await expect(page.getByPlaceholder("Your full name")).toBeVisible({ timeout: 5000 });
    await expect(page.getByPlaceholder("email@example.com")).toBeVisible({ timeout: 5000 });
    await expect(page.getByPlaceholder("+66 8x xxx xxxx")).toBeVisible({ timeout: 5000 });
    await expect(page.getByPlaceholder("Thai / British / etc.")).toBeVisible({ timeout: 5000 });
  });

  test("Step 1 Next is disabled without required fields, enabled with full_name + email", async ({
    page,
  }) => {
    await page.goto("/qr-register");

    const nextButton = page.getByRole("button", { name: "Next", exact: true }).first();

    // Next should be disabled initially (no name or email)
    await expect(nextButton).toBeDisabled({ timeout: 5000 });

    // Fill only name — still disabled
    await page.getByPlaceholder("Your full name").fill("John Doe");
    await expect(nextButton).toBeDisabled();

    // Fill email — now enabled
    await page.getByPlaceholder("email@example.com").fill("john@example.com");
    await expect(nextButton).toBeEnabled();
  });

  test("Step 2 shows company, job_title, industry, revenue_range fields", async ({ page }) => {
    await page.goto("/qr-register");

    // Fill step 1 required fields and proceed
    await page.getByPlaceholder("Your full name").fill("John Doe");
    await page.getByPlaceholder("email@example.com").fill("john@example.com");
    await page.getByRole("button", { name: "Next", exact: true }).first().click();

    // Step 2 heading (use combined text to avoid strict mode — "Business" also in step indicator)
    await expect(page.getByText("Step 2 — Business")).toBeVisible({ timeout: 5000 });

    // Step 2 fields
    await expect(page.getByPlaceholder("Your company")).toBeVisible({ timeout: 5000 });
    await expect(page.getByPlaceholder("CEO / Director / Founder")).toBeVisible({ timeout: 5000 });
    await expect(page.locator("select").first()).toBeVisible({ timeout: 5000 });
    await expect(page.locator("select").nth(1)).toBeVisible({ timeout: 5000 });
  });

  test("Step 3 shows interest toggle buttons", async ({ page }) => {
    await page.goto("/qr-register");

    // Navigate to step 3
    await page.getByPlaceholder("Your full name").fill("John Doe");
    await page.getByPlaceholder("email@example.com").fill("john@example.com");
    await page.getByRole("button", { name: "Next", exact: true }).first().click();

    // Fill step 2 required fields
    await page.getByPlaceholder("Your company").fill("Acme Corp");
    await page.locator("select").first().selectOption("Technology");
    await page.getByRole("button", { name: "Next", exact: true }).first().click();

    // Step 3 heading (use combined text to avoid strict mode — "Interests" also in step indicator)
    await expect(page.getByText("Step 3 — Interests")).toBeVisible({ timeout: 5000 });

    // Interest toggle buttons
    const interests = ["Real Estate", "Finance", "Tech", "Networking", "Lifestyle", "Events", "Partnerships"];
    for (const interest of interests) {
      await expect(page.getByRole("button", { name: interest })).toBeVisible({ timeout: 5000 });
    }
  });

  test("Step 4 shows event format and language preference", async ({ page }) => {
    await page.goto("/qr-register");

    // Navigate through steps 1-3
    await page.getByPlaceholder("Your full name").fill("John Doe");
    await page.getByPlaceholder("email@example.com").fill("john@example.com");
    await page.getByRole("button", { name: "Next", exact: true }).first().click();

    await page.getByPlaceholder("Your company").fill("Acme Corp");
    await page.locator("select").first().selectOption("Technology");
    await page.getByRole("button", { name: "Next", exact: true }).first().click();

    // Select an interest (required for step 3)
    await page.getByRole("button", { name: "Tech" }).click();
    await page.getByRole("button", { name: "Next", exact: true }).first().click();

    // Step 4 heading (use combined text to avoid strict mode — "Preferences" also in step indicator)
    await expect(page.getByText("Step 4 — Preferences")).toBeVisible({ timeout: 5000 });

    // Event format buttons
    const formats = ["Dinner", "Mixer", "Workshop", "Private Party"];
    for (const format of formats) {
      await expect(page.getByRole("button", { name: format })).toBeVisible({ timeout: 5000 });
    }

    // Language preference select
    await expect(page.getByText("Language Preference")).toBeVisible({ timeout: 5000 });
  });

  test("Step 5 shows consent checkboxes and Complete Registration button", async ({ page }) => {
    await page.goto("/qr-register");

    // Navigate through steps 1-4
    await page.getByPlaceholder("Your full name").fill("John Doe");
    await page.getByPlaceholder("email@example.com").fill("john@example.com");
    await page.getByRole("button", { name: "Next", exact: true }).first().click();

    await page.getByPlaceholder("Your company").fill("Acme Corp");
    await page.locator("select").first().selectOption("Technology");
    await page.getByRole("button", { name: "Next", exact: true }).first().click();

    await page.getByRole("button", { name: "Tech" }).click();
    await page.getByRole("button", { name: "Next", exact: true }).first().click();

    // Step 4 — no required fields, just proceed
    await page.getByRole("button", { name: "Next", exact: true }).first().click();

    // Step 5 heading (use combined text to avoid strict mode — "Consent" also in step indicator)
    await expect(page.getByText("Step 5 — Consent")).toBeVisible({ timeout: 5000 });

    // Consent checkboxes
    await expect(page.getByText(/PDPA/i)).toBeVisible({ timeout: 5000 });
    await expect(page.getByText(/Terms of Service/i)).toBeVisible({ timeout: 5000 });
    await expect(page.getByText(/event updates/i)).toBeVisible({ timeout: 5000 });

    // Complete Registration button
    await expect(page.getByRole("button", { name: "Complete Registration" })).toBeVisible({
      timeout: 5000,
    });
  });

  test("Step 5 Complete Registration is disabled without pdpa + tos consent", async ({ page }) => {
    await page.goto("/qr-register");

    // Navigate through steps 1-4
    await page.getByPlaceholder("Your full name").fill("John Doe");
    await page.getByPlaceholder("email@example.com").fill("john@example.com");
    await page.getByRole("button", { name: "Next", exact: true }).first().click();

    await page.getByPlaceholder("Your company").fill("Acme Corp");
    await page.locator("select").first().selectOption("Technology");
    await page.getByRole("button", { name: "Next", exact: true }).first().click();

    await page.getByRole("button", { name: "Tech" }).click();
    await page.getByRole("button", { name: "Next", exact: true }).first().click();

    await page.getByRole("button", { name: "Next", exact: true }).first().click();

    // Complete Registration should be disabled without consent
    const submitButton = page.getByRole("button", { name: "Complete Registration" });
    await expect(submitButton).toBeDisabled({ timeout: 5000 });

    // Check only PDPA — still disabled (need TOS too)
    await page.getByText(/PDPA/i).click();
    await expect(submitButton).toBeDisabled();

    // Check TOS — now enabled
    await page.getByText(/Terms of Service/i).click();
    await expect(submitButton).toBeEnabled();
  });

  test("successful registration redirects to /login?registered=true", async ({ page }) => {
    await page.route("**/api/auth/register", async (route) => {
      await route.fulfill({
        status: 200,
        json: { id: "new-user-id", email: "john@example.com" },
      });
    });

    await page.goto("/qr-register");

    // Navigate through all steps
    await page.getByPlaceholder("Your full name").fill("John Doe");
    await page.getByPlaceholder("email@example.com").fill("john@example.com");
    await page.getByRole("button", { name: "Next", exact: true }).first().click();

    await page.getByPlaceholder("Your company").fill("Acme Corp");
    await page.locator("select").first().selectOption("Technology");
    await page.getByRole("button", { name: "Next", exact: true }).first().click();

    await page.getByRole("button", { name: "Tech" }).click();
    await page.getByRole("button", { name: "Next", exact: true }).first().click();

    await page.getByRole("button", { name: "Next", exact: true }).first().click();

    // Step 5 — consent and submit
    await page.getByText(/PDPA/i).click();
    await page.getByText(/Terms of Service/i).click();

    // Verify the registration API is called (form submitted → router.push to /login)
    const responsePromise = page.waitForResponse("**/api/auth/register");
    await page.getByRole("button", { name: "Complete Registration" }).click();
    const response = await responsePromise;
    expect(response.status()).toBe(200);
  });

  test("failed registration shows error", async ({ page }) => {
    await page.route("**/api/auth/register", async (route) => {
      await route.fulfill({
        status: 422,
        json: { detail: "Email already registered" },
      });
    });

    await page.goto("/qr-register");

    // Navigate through all steps
    await page.getByPlaceholder("Your full name").fill("John Doe");
    await page.getByPlaceholder("email@example.com").fill("john@example.com");
    await page.getByRole("button", { name: "Next", exact: true }).first().click();

    await page.getByPlaceholder("Your company").fill("Acme Corp");
    await page.locator("select").first().selectOption("Technology");
    await page.getByRole("button", { name: "Next", exact: true }).first().click();

    await page.getByRole("button", { name: "Tech" }).click();
    await page.getByRole("button", { name: "Next", exact: true }).first().click();

    await page.getByRole("button", { name: "Next", exact: true }).first().click();

    // Step 5 — consent and submit
    await page.getByText(/PDPA/i).click();
    await page.getByText(/Terms of Service/i).click();
    await page.getByRole("button", { name: "Complete Registration" }).click();

    await expect(page.getByText(/email already registered/i)).toBeVisible({ timeout: 5000 });
  });

  test("query params (promo, tier) are passed to API", async ({ page }) => {
    let capturedBody: Record<string, unknown> | null = null;

    await page.route("**/api/auth/register", async (route) => {
      const request = route.request();
      capturedBody = JSON.parse(request.postData() ?? "{}");
      await route.fulfill({
        status: 200,
        json: { id: "new-user-id", email: "john@example.com" },
      });
    });

    await page.goto("/qr-register?promo=PROMO123&tier=gold");

    // Navigate through all steps
    await page.getByPlaceholder("Your full name").fill("John Doe");
    await page.getByPlaceholder("email@example.com").fill("john@example.com");
    await page.getByRole("button", { name: "Next", exact: true }).first().click();

    await page.getByPlaceholder("Your company").fill("Acme Corp");
    await page.locator("select").first().selectOption("Technology");
    await page.getByRole("button", { name: "Next", exact: true }).first().click();

    await page.getByRole("button", { name: "Tech" }).click();
    await page.getByRole("button", { name: "Next", exact: true }).first().click();

    await page.getByRole("button", { name: "Next", exact: true }).first().click();

    // Step 5 — consent and submit
    await page.getByText(/PDPA/i).click();
    await page.getByText(/Terms of Service/i).click();
    await page.getByRole("button", { name: "Complete Registration" }).click();

    // router.push uses pushState — use toHaveURL (polls URL, no navigation event needed)
    await expect(page).toHaveURL(/\/login\?registered=true/, { timeout: 20000 });

    // Verify the API request included promo and tier
    expect(capturedBody).not.toBeNull();
    expect(capturedBody!.promo_code).toBe("PROMO123");
    expect(capturedBody!.tier).toBe("gold");
    expect(capturedBody!.tier_grant).toBe("gold");
  });
});

// ---------------------------------------------------------------------------
// Connect Page (/connect?member={id})
// ---------------------------------------------------------------------------
test.describe("Connect Page", () => {
  test.use({ storageState: ".playwright/.auth/user.json" });

  test("shows loading spinner initially", async ({ page }) => {
    // Delay the profile API so we can observe the loading state
    await page.route("**/api/members/member-uuid-123/public-profile", async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 3000));
      await route.fulfill({ json: PUBLIC_PROFILE });
    });
    await page.route("**/api/auth/me", async (route) => {
      await route.fulfill({ json: ADMIN_USER });
    });

    await page.goto("/connect?member=member-uuid-123");

    // The Loader2 spinner should be visible during loading
    await expect(page.locator(".animate-spin")).toBeVisible({ timeout: 5000 });
  });

  test("displays member profile (name, company, industry) and Connect button", async ({
    page,
  }) => {
    await page.route("**/api/members/member-uuid-123/public-profile", async (route) => {
      await route.fulfill({ json: PUBLIC_PROFILE });
    });
    await page.route("**/api/auth/me", async (route) => {
      await route.fulfill({ json: ADMIN_USER });
    });

    await page.goto("/connect?member=member-uuid-123");

    await expect(page.getByText("Jane Smith")).toBeVisible({ timeout: 5000 });
    await expect(page.getByText("Acme Corp")).toBeVisible({ timeout: 5000 });
    await expect(page.getByText("Technology")).toBeVisible({ timeout: 5000 });
    await expect(page.getByRole("button", { name: /connect/i })).toBeVisible({ timeout: 5000 });
  });

  test("shows 'Member' fallback when full_name is null", async ({ page }) => {
    await page.route("**/api/members/member-uuid-456/public-profile", async (route) => {
      await route.fulfill({
        json: {
          id: "member-uuid-456",
          full_name: null,
          company_name: "Some Corp",
          industry: "Finance",
        },
      });
    });
    await page.route("**/api/auth/me", async (route) => {
      await route.fulfill({ json: ADMIN_USER });
    });

    await page.goto("/connect?member=member-uuid-456");

    // The displayName fallback should show "Member" in the heading
    await expect(page.getByText(/connect with member/i)).toBeVisible({ timeout: 5000 });
  });

  test("successful connection shows 'Connected!' state with 'View Connections' button", async ({
    page,
  }) => {
    await page.route("**/api/members/member-uuid-123/public-profile", async (route) => {
      await route.fulfill({ json: PUBLIC_PROFILE });
    });
    await page.route("**/api/members/connect", async (route) => {
      await route.fulfill({
        status: 200,
        json: { message: "Connected" },
      });
    });
    await page.route("**/api/auth/me", async (route) => {
      await route.fulfill({ json: ADMIN_USER });
    });

    await page.goto("/connect?member=member-uuid-123");

    // Wait for profile to load, then click Connect
    await expect(page.getByRole("button", { name: /connect/i })).toBeVisible({ timeout: 5000 });
    await page.getByRole("button", { name: /connect/i }).click();

    // Should show "Connected!" state
    await expect(page.getByText(/connected!/i)).toBeVisible({ timeout: 5000 });
    await expect(page.getByRole("button", { name: /view connections/i })).toBeVisible({
      timeout: 5000,
    });
  });

  test("409 response shows 'Already connected' state", async ({ page }) => {
    await page.route("**/api/members/member-uuid-123/public-profile", async (route) => {
      await route.fulfill({ json: PUBLIC_PROFILE });
    });
    await page.route("**/api/members/connect", async (route) => {
      await route.fulfill({
        status: 409,
        json: { detail: "Already connected" },
      });
    });
    await page.route("**/api/auth/me", async (route) => {
      await route.fulfill({ json: ADMIN_USER });
    });

    await page.goto("/connect?member=member-uuid-123");

    await expect(page.getByRole("button", { name: /connect/i })).toBeVisible({ timeout: 5000 });
    await page.getByRole("button", { name: /connect/i }).click();

    await expect(page.getByRole("heading", { name: /already connected/i })).toBeVisible({ timeout: 5000 });
    await expect(page.getByRole("button", { name: /view connections/i })).toBeVisible({
      timeout: 5000,
    });
  });

  test("error on connect shows error state", async ({ page }) => {
    await page.route("**/api/members/member-uuid-123/public-profile", async (route) => {
      await route.fulfill({ json: PUBLIC_PROFILE });
    });
    await page.route("**/api/members/connect", async (route) => {
      await route.fulfill({
        status: 400,
        json: { detail: "Cannot connect with yourself" },
      });
    });
    await page.route("**/api/auth/me", async (route) => {
      await route.fulfill({ json: ADMIN_USER });
    });

    await page.goto("/connect?member=member-uuid-123");

    await expect(page.getByRole("button", { name: /connect/i })).toBeVisible({ timeout: 5000 });
    await page.getByRole("button", { name: /connect/i }).click();

    // Error state shows the XCircle icon area and error message
    await expect(page.getByText(/cannot connect with yourself/i)).toBeVisible({ timeout: 5000 });
  });

  test("shows error when member query param is missing", async ({ page }) => {
    await page.route("**/api/auth/me", async (route) => {
      await route.fulfill({ json: ADMIN_USER });
    });

    await page.goto("/connect");

    // Should show error state with "Member not found" heading
    await expect(page.getByRole("heading", { name: /member not found/i })).toBeVisible({ timeout: 5000 });
  });
});

// ---------------------------------------------------------------------------
// Member Redirect (/m/{id})
// ---------------------------------------------------------------------------
test.describe("Member Redirect", () => {
  test("renders redirect page with loading spinner for /m/{id}", async ({ page }) => {
    await page.goto("/m/abc-123", { waitUntil: "domcontentloaded" });

    // The /m/[id] page renders a loading spinner while router.replace fires
    // Verify the page loaded and shows the spinner (Loader2 SVG)
    await expect(page.locator("svg.animate-spin").first()).toBeVisible({ timeout: 10000 });
  });

  test("/m/{id} page calls router.replace with correct member ID", async ({ page }) => {
    const memberId = "00000000-aaaa-bbbb-cccc-dddddddddddd";

    // Mock connect page APIs
    await page.route(`**/api/members/${memberId}/public-profile`, async (route) => {
      await route.fulfill({
        json: { ...PUBLIC_PROFILE, id: memberId },
      });
    });
    await page.route("**/api/auth/me", async (route) => {
      await route.fulfill({ status: 401, json: { detail: "Not authenticated" } });
    });
    await page.route("**/api/auth/refresh", async (route) => {
      await route.fulfill({ status: 401, json: { detail: "Not authenticated" } });
    });

    await page.goto(`/m/${memberId}`, { waitUntil: "domcontentloaded" });

    // The redirect page renders — verify it loaded correctly
    await expect(page.locator("svg.animate-spin").first()).toBeVisible({ timeout: 10000 });
  });
});

