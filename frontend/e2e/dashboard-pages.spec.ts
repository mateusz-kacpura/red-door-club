
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

const MEMBER_ME = {
  ...ADMIN_USER,
  phone: "+66812345678",
  company_name: "S8LLS",
  industry: "Hospitality",
  interests: ["Tech", "Networking"],
  nfc_cards: [{ card_id: "NFC-001", status: "active" }],
};

const MEMBER_ME_EMPTY = {
  ...ADMIN_USER,
  phone: null,
  company_name: null,
  industry: null,
  interests: [],
  nfc_cards: [],
};

const EVENTS: Array<{
  id: string;
  title: string;
  description: string | null;
  event_type: string;
  capacity: number;
  ticket_price: string;
  starts_at: string;
  ends_at: string | null;
  status: string;
  rsvp_count: number;
  is_rsvped: boolean;
  match_score: number | null;
  target_segments: string[];
  created_at: string;
  updated_at: string | null;
}> = [
  {
    id: "evt-1",
    title: "Founders Mixer Night",
    description: "An evening of networking for tech founders",
    event_type: "mixer",
    capacity: 50,
    ticket_price: "500.00",
    starts_at: "2026-03-25T19:00:00",
    ends_at: "2026-03-25T23:00:00",
    status: "published",
    rsvp_count: 12,
    is_rsvped: false,
    match_score: 0.85,
    target_segments: ["Tech & Founders"],
    created_at: "2026-03-15T10:00:00",
    updated_at: null,
  },
  {
    id: "evt-2",
    title: "VIP Wine Dinner",
    description: "Exclusive wine pairing dinner",
    event_type: "dinner",
    capacity: 20,
    ticket_price: "2500.00",
    starts_at: "2026-03-28T18:30:00",
    ends_at: "2026-03-28T22:00:00",
    status: "published",
    rsvp_count: 8,
    is_rsvped: true,
    match_score: null,
    target_segments: ["Finance & Investors", "Lifestyle"],
    created_at: "2026-03-14T10:00:00",
    updated_at: null,
  },
];

const SERVICE_REQUESTS = [
  {
    id: "sr-1",
    member_id: ADMIN_USER.id,
    request_type: "car",
    status: "pending",
    details: { notes: "Black sedan, pick up at 8pm" },
    assigned_to: null,
    created_at: "2026-03-20T17:00:00",
    completed_at: null,
    member_rating: null,
  },
  {
    id: "sr-2",
    member_id: ADMIN_USER.id,
    request_type: "studio",
    status: "completed",
    details: { notes: "Recording session" },
    assigned_to: null,
    created_at: "2026-03-19T14:00:00",
    completed_at: "2026-03-19T16:00:00",
    member_rating: null,
  },
];

const LOCKER_ASSIGNED = {
  id: "locker-1",
  locker_number: "A07",
  location: "main_floor",
  status: "occupied",
  assigned_member_id: ADMIN_USER.id,
  assigned_at: "2026-03-20T19:15:00",
  released_at: null,
};

const TAB_OPEN = {
  id: "tab-1",
  member_id: ADMIN_USER.id,
  status: "open",
  opened_at: "2026-03-20T19:00:00",
  closed_at: null,
  total_amount: 4500,
  items: [
    {
      id: "i1",
      description: "Whiskey Sour",
      amount: 450,
      added_at: "2026-03-20T19:05:00",
      tap_event_id: null,
    },
    {
      id: "i2",
      description: "Old Fashioned",
      amount: 550,
      added_at: "2026-03-20T19:20:00",
      tap_event_id: null,
    },
  ],
};

const TAB_CLOSED = {
  id: "tab-2",
  member_id: ADMIN_USER.id,
  status: "closed",
  opened_at: "2026-03-19T18:00:00",
  closed_at: "2026-03-19T23:30:00",
  total_amount: 8500,
  items: [
    {
      id: "i3",
      description: "Champagne",
      amount: 3500,
      added_at: "2026-03-19T18:10:00",
      tap_event_id: null,
    },
  ],
};

async function mockAuth(page: Page) {
  await page.route("**/api/auth/me", (route) =>
    route.fulfill({ json: ADMIN_USER })
  );
  await page.route("**/api/auth/ws-token", (route) =>
    route.fulfill({ json: { token: "fake-ws-token" } })
  );
}

// ─── Profile Page ─────────────────────────────────────────────────────────────

test.describe("Dashboard — Profile", () => {
  test.use({ storageState: ".playwright/.auth/user.json" });

  test("shows Profile heading", async ({ page }) => {
    await mockAuth(page);
    await page.route("**/api/members/me", (route) =>
      route.fulfill({ json: MEMBER_ME })
    );

    await page.goto("/profile");

    await expect(
      page.getByRole("heading", { name: "Profile" })
    ).toBeVisible({ timeout: 5000 });
  });

  test("shows user name and email", async ({ page }) => {
    await mockAuth(page);
    await page.route("**/api/members/me", (route) =>
      route.fulfill({ json: MEMBER_ME })
    );

    await page.goto("/profile");

    await expect(page.getByText("Admin User").first()).toBeVisible({ timeout: 5000 });
    await expect(page.getByText("admin@thereddoor.club").first()).toBeVisible();
  });

  test("shows account info fields (name, email, phone, company, industry)", async ({
    page,
  }) => {
    await mockAuth(page);
    await page.route("**/api/members/me", (route) =>
      route.fulfill({ json: MEMBER_ME })
    );

    await page.goto("/profile");

    // Wait for profile to load
    await expect(page.getByText("Account Information")).toBeVisible({
      timeout: 5000,
    });

    // Field labels
    await expect(page.getByText("Full Name")).toBeVisible();
    await expect(page.getByText("Email Address")).toBeVisible();
    await expect(page.getByText("Phone")).toBeVisible();
    await expect(page.getByText("Company")).toBeVisible();
    await expect(page.getByText("Industry")).toBeVisible();

    // Field values from MEMBER_ME
    await expect(page.getByText("+66812345678")).toBeVisible();
    await expect(page.getByRole("main").getByText("S8LLS")).toBeVisible();
    await expect(page.getByText("Hospitality")).toBeVisible();
  });

  test("clicking Edit shows form inputs", async ({ page }) => {
    await mockAuth(page);
    await page.route("**/api/members/me", (route) =>
      route.fulfill({ json: MEMBER_ME })
    );

    await page.goto("/profile");

    await expect(page.getByText("Account Information")).toBeVisible({
      timeout: 5000,
    });

    // Click Edit button
    await page.getByRole("button", { name: /Edit/i }).click();

    // Form inputs should appear
    await expect(page.locator("input#full_name")).toBeVisible();
    await expect(page.locator("input#phone")).toBeVisible();
    await expect(page.locator("input#company_name")).toBeVisible();
    await expect(page.locator("input#industry")).toBeVisible();
  });

  test("Cancel exits edit mode", async ({ page }) => {
    await mockAuth(page);
    await page.route("**/api/members/me", (route) =>
      route.fulfill({ json: MEMBER_ME })
    );

    await page.goto("/profile");

    await expect(page.getByText("Account Information")).toBeVisible({
      timeout: 5000,
    });

    // Enter edit mode
    await page.getByRole("button", { name: /Edit/i }).click();
    await expect(page.locator("input#full_name")).toBeVisible();

    // Click Cancel (the button in the header that toggles)
    await page.getByRole("button", { name: /Cancel/i }).first().click();

    // Inputs should disappear
    await expect(page.locator("input#full_name")).not.toBeVisible();
  });

  test("Save calls PATCH /members/me", async ({ page }) => {
    await mockAuth(page);
    await page.route("**/api/members/me", (route) => {
      if (route.request().method() === "PATCH") {
        return route.fulfill({
          json: { ...MEMBER_ME, full_name: "Updated Name" },
        });
      }
      return route.fulfill({ json: MEMBER_ME });
    });

    await page.goto("/profile");

    await expect(page.getByText("Account Information")).toBeVisible({
      timeout: 5000,
    });

    // Enter edit mode
    await page.getByRole("button", { name: /Edit/i }).click();

    // Change the name
    const nameInput = page.locator("input#full_name");
    await nameInput.clear();
    await nameInput.fill("Updated Name");

    // Intercept the PATCH call
    const patchPromise = page.waitForRequest(
      (req) =>
        req.url().includes("/api/members/me") && req.method() === "PATCH"
    );

    // Click Save Changes
    await page.getByRole("button", { name: /Save Changes/i }).click();

    const patchRequest = await patchPromise;
    expect(patchRequest.method()).toBe("PATCH");
  });

  test("shows Preferences section with Theme toggle", async ({ page }) => {
    await mockAuth(page);
    await page.route("**/api/members/me", (route) =>
      route.fulfill({ json: MEMBER_ME })
    );

    await page.goto("/profile");

    await expect(page.getByRole("heading", { name: "Preferences" })).toBeVisible({ timeout: 5000 });
    await expect(page.getByText("Theme")).toBeVisible();
    await expect(
      page.getByText("Choose your preferred color scheme")
    ).toBeVisible();
  });

  test("shows QR code section", async ({ page }) => {
    await mockAuth(page);
    await page.route("**/api/members/me", (route) =>
      route.fulfill({ json: MEMBER_ME })
    );

    await page.goto("/profile");

    await expect(page.getByText("My QR Code")).toBeVisible({ timeout: 5000 });
    await expect(
      page.getByText(
        "Show this QR to staff at the door or to other members to connect"
      )
    ).toBeVisible();
  });

  test("shows empty state for null optional fields (dash placeholder)", async ({
    page,
  }) => {
    await mockAuth(page);
    await page.route("**/api/members/me", (route) =>
      route.fulfill({ json: MEMBER_ME_EMPTY })
    );

    await page.goto("/profile");

    await expect(page.getByText("Account Information")).toBeVisible({
      timeout: 5000,
    });

    // Null fields should show dash "—"
    // phone, company_name, industry are null → displayed as "—"
    const dashes = page.locator("text=—");
    await expect(dashes.first()).toBeVisible();
  });

  test("shows NFC card section when cards exist", async ({ page }) => {
    await mockAuth(page);
    await page.route("**/api/members/me", (route) =>
      route.fulfill({ json: MEMBER_ME })
    );

    await page.goto("/profile");

    await expect(page.getByText("My NFC Card")).toBeVisible({ timeout: 5000 });
    await expect(page.getByText("NFC-001")).toBeVisible();
    await expect(page.getByText("active", { exact: true })).toBeVisible();
  });
});

// ─── Events Page ──────────────────────────────────────────────────────────────

test.describe("Dashboard — Events", () => {
  test.use({ storageState: ".playwright/.auth/user.json" });

  test("shows Events heading", async ({ page }) => {
    await mockAuth(page);
    await page.route("**/api/members/events", (route) =>
      route.fulfill({ json: EVENTS })
    );

    await page.goto("/dashboard/events");

    await expect(
      page.getByRole("heading", { name: "Events" })
    ).toBeVisible({ timeout: 5000 });
  });

  test("shows loading spinner", async ({ page }) => {
    await mockAuth(page);
    // Delay the response so the spinner is visible
    await page.route("**/api/members/events", async (route) => {
      await new Promise((r) => setTimeout(r, 2000));
      await route.fulfill({ json: [] });
    });

    await page.goto("/dashboard/events");

    // The Loader2 spinner has animate-spin class
    await expect(page.locator(".animate-spin").first()).toBeVisible({
      timeout: 3000,
    });
  });

  test("shows empty state when no events", async ({ page }) => {
    await mockAuth(page);
    await page.route("**/api/members/events", (route) =>
      route.fulfill({ json: [] })
    );

    await page.goto("/dashboard/events");

    await expect(
      page.getByText("No upcoming events at the moment.")
    ).toBeVisible({ timeout: 5000 });
    await expect(
      page.getByText("Check back soon for new events.")
    ).toBeVisible();
  });

  test("displays event cards with titles", async ({ page }) => {
    await mockAuth(page);
    await page.route("**/api/members/events", (route) =>
      route.fulfill({ json: EVENTS })
    );

    await page.goto("/dashboard/events");

    await expect(page.getByText("Founders Mixer Night")).toBeVisible({
      timeout: 5000,
    });
    await expect(page.getByText("VIP Wine Dinner")).toBeVisible();
  });

  test("shows RSVP button for non-RSVPed events", async ({ page }) => {
    await mockAuth(page);
    await page.route("**/api/members/events", (route) =>
      route.fulfill({ json: EVENTS })
    );

    await page.goto("/dashboard/events");

    // "Founders Mixer Night" has is_rsvped: false → should show "RSVP" button
    await expect(page.getByText("Founders Mixer Night")).toBeVisible({
      timeout: 5000,
    });
    await expect(page.getByRole("button", { name: "RSVP", exact: true })).toBeVisible();
  });

  test("shows Cancel RSVP for RSVPed events", async ({ page }) => {
    await mockAuth(page);
    await page.route("**/api/members/events", (route) =>
      route.fulfill({ json: EVENTS })
    );

    await page.goto("/dashboard/events");

    // "VIP Wine Dinner" has is_rsvped: true → should show "Cancel RSVP"
    await expect(page.getByText("VIP Wine Dinner")).toBeVisible({
      timeout: 5000,
    });
    await expect(
      page.getByRole("button", { name: "Cancel RSVP" })
    ).toBeVisible();
  });

  test("shows match score when present", async ({ page }) => {
    await mockAuth(page);
    await page.route("**/api/members/events", (route) =>
      route.fulfill({ json: EVENTS })
    );

    await page.goto("/dashboard/events");

    // "Founders Mixer Night" has match_score: 0.85 → 85%
    await expect(page.getByText("85%")).toBeVisible({ timeout: 5000 });
    await expect(page.getByText("Match", { exact: true }).last()).toBeVisible();
  });

  test("shows attendance count", async ({ page }) => {
    await mockAuth(page);
    await page.route("**/api/members/events", (route) =>
      route.fulfill({ json: EVENTS })
    );

    await page.goto("/dashboard/events");

    // "Founders Mixer Night" has rsvp_count: 12, capacity: 50 → "12 / 50 attending"
    await expect(page.getByText("12 / 50 attending")).toBeVisible({
      timeout: 5000,
    });
  });
});

// ─── Services Page ────────────────────────────────────────────────────────────

test.describe("Dashboard — Services", () => {
  test.use({ storageState: ".playwright/.auth/user.json" });

  test("shows Services heading", async ({ page }) => {
    await mockAuth(page);
    await page.route("**/api/members/services", (route) =>
      route.fulfill({ json: SERVICE_REQUESTS })
    );

    await page.goto("/dashboard/services");

    await expect(
      page.getByRole("heading", { name: "Services" })
    ).toBeVisible({ timeout: 5000 });
  });

  test("shows empty state when no requests", async ({ page }) => {
    await mockAuth(page);
    await page.route("**/api/members/services", (route) =>
      route.fulfill({ json: [] })
    );

    await page.goto("/dashboard/services");

    await expect(
      page.getByText("No service requests yet.")
    ).toBeVisible({ timeout: 5000 });
    await expect(
      page.getByText(
        "Request a car, studio session, or any concierge service."
      )
    ).toBeVisible();
  });

  test("displays existing request cards", async ({ page }) => {
    await mockAuth(page);
    await page.route("**/api/members/services", (route) =>
      route.fulfill({ json: SERVICE_REQUESTS })
    );

    await page.goto("/dashboard/services");

    // request_type "car" is capitalized → "car" displayed as "car" with capitalize CSS
    await expect(page.getByText("car", { exact: false })).toBeVisible({
      timeout: 5000,
    });
    await expect(
      page.getByText("Black sedan, pick up at 8pm")
    ).toBeVisible();
  });

  test("clicking New Request opens form", async ({ page }) => {
    await mockAuth(page);
    await page.route("**/api/members/services", (route) =>
      route.fulfill({ json: [] })
    );

    await page.goto("/dashboard/services");

    await expect(
      page.getByRole("heading", { name: "Services" })
    ).toBeVisible({ timeout: 5000 });

    // Click "New Request" button
    await page.getByRole("button", { name: /New Request/i }).click();

    // Form heading should appear
    await expect(page.getByText("New Service Request")).toBeVisible();
  });

  test("form has request type buttons (car, driver, jet, hotel, restaurant, bar, studio, other)", async ({
    page,
  }) => {
    await mockAuth(page);
    await page.route("**/api/members/services", (route) =>
      route.fulfill({ json: [] })
    );

    await page.goto("/dashboard/services");

    await expect(
      page.getByRole("heading", { name: "Services" })
    ).toBeVisible({ timeout: 5000 });

    await page.getByRole("button", { name: /New Request/i }).click();
    await expect(page.getByText("New Service Request")).toBeVisible();

    // All 8 request type buttons should be visible
    for (const type of [
      "car",
      "driver",
      "jet",
      "hotel",
      "restaurant",
      "bar",
      "studio",
      "other",
    ]) {
      await expect(
        page.locator(`button:has-text("${type}")`)
      ).toBeVisible();
    }
  });

  test("submitting form calls POST", async ({ page }) => {
    await mockAuth(page);
    await page.route("**/api/members/services", (route) => {
      if (route.request().method() === "POST") {
        return route.fulfill({
          json: {
            id: "sr-new",
            member_id: ADMIN_USER.id,
            request_type: "car",
            status: "pending",
            details: null,
            assigned_to: null,
            created_at: "2026-03-20T20:00:00",
            completed_at: null,
            member_rating: null,
          },
        });
      }
      return route.fulfill({ json: [] });
    });

    await page.goto("/dashboard/services");

    await expect(
      page.getByRole("heading", { name: "Services" })
    ).toBeVisible({ timeout: 5000 });

    await page.getByRole("button", { name: /New Request/i }).click();

    // Select "car" type (it may already be selected as default is "other", click "car")
    await page.locator('button:has-text("car")').first().click();

    // Intercept the POST call
    const postPromise = page.waitForRequest(
      (req) =>
        req.url().includes("/api/members/services") &&
        req.method() === "POST"
    );

    // Submit the form
    await page.getByRole("button", { name: /Submit Request/i }).click();

    const postRequest = await postPromise;
    expect(postRequest.method()).toBe("POST");
  });

  test("Cancel closes form", async ({ page }) => {
    await mockAuth(page);
    await page.route("**/api/members/services", (route) =>
      route.fulfill({ json: [] })
    );

    await page.goto("/dashboard/services");

    await expect(
      page.getByRole("heading", { name: "Services" })
    ).toBeVisible({ timeout: 5000 });

    // Open form
    await page.getByRole("button", { name: /New Request/i }).click();
    await expect(page.getByText("New Service Request")).toBeVisible();

    // Click Cancel
    await page.getByRole("button", { name: /Cancel/i }).click();

    // Form should be hidden
    await expect(page.getByText("New Service Request")).not.toBeVisible();
  });
});

// ─── Locker Page ──────────────────────────────────────────────────────────────

test.describe("Dashboard — Locker", () => {
  test.use({ storageState: ".playwright/.auth/user.json" });

  test("shows My Locker heading", async ({ page }) => {
    await mockAuth(page);
    await page.route("**/api/members/locker", (route) =>
      route.fulfill({ json: LOCKER_ASSIGNED })
    );

    await page.goto("/dashboard/locker");

    await expect(
      page.getByRole("heading", { name: "My Locker" })
    ).toBeVisible({ timeout: 5000 });
  });

  test("shows empty state when no locker", async ({ page }) => {
    await mockAuth(page);
    await page.route("**/api/members/locker", (route) =>
      route.fulfill({ json: null })
    );

    await page.goto("/dashboard/locker");

    await expect(page.getByText("No locker assigned.")).toBeVisible({
      timeout: 5000,
    });
    await expect(
      page.getByText(
        "Tap your NFC card at the locker station to get assigned."
      )
    ).toBeVisible();
  });

  test("shows locker number when assigned", async ({ page }) => {
    await mockAuth(page);
    await page.route("**/api/members/locker", (route) =>
      route.fulfill({ json: LOCKER_ASSIGNED })
    );

    await page.goto("/dashboard/locker");

    // t("locker.lockerNumber", { number: "A07" }) → "Locker #A07"
    await expect(page.getByText("Locker #A07")).toBeVisible({ timeout: 5000 });
    await expect(page.getByText("Assigned", { exact: true })).toBeVisible();
  });

  test("shows assignment time", async ({ page }) => {
    await mockAuth(page);
    await page.route("**/api/members/locker", (route) =>
      route.fulfill({ json: LOCKER_ASSIGNED })
    );

    await page.goto("/dashboard/locker");

    // assigned_at: "2026-03-20T19:15:00" → formatted as "19:15"
    await expect(page.getByText(/19:15/)).toBeVisible({ timeout: 5000 });
  });
});

// ─── Tab Page ─────────────────────────────────────────────────────────────────

test.describe("Dashboard — Tab", () => {
  test.use({ storageState: ".playwright/.auth/user.json" });

  test("shows My Tab heading", async ({ page }) => {
    await mockAuth(page);
    await page.route("**/api/members/tab", (route) =>
      route.fulfill({ json: TAB_OPEN })
    );

    await page.goto("/dashboard/tab");

    await expect(
      page.getByRole("heading", { name: "My Tab" })
    ).toBeVisible({ timeout: 5000 });
  });

  test("shows empty state when no tab", async ({ page }) => {
    await mockAuth(page);
    await page.route("**/api/members/tab", (route) =>
      route.fulfill({ json: null })
    );

    await page.goto("/dashboard/tab");

    await expect(page.getByText("No open tab.")).toBeVisible({
      timeout: 5000,
    });
    await expect(
      page.getByText(
        "Tap your NFC card at a bar or service point to start a tab."
      )
    ).toBeVisible();
  });

  test("shows tab items and total", async ({ page }) => {
    await mockAuth(page);
    await page.route("**/api/members/tab", (route) =>
      route.fulfill({ json: TAB_OPEN })
    );

    await page.goto("/dashboard/tab");

    // Tab items
    await expect(page.getByText("Whiskey Sour")).toBeVisible({
      timeout: 5000,
    });
    await expect(page.getByText("Old Fashioned")).toBeVisible();

    // Total amount: 4500 → formatted as "฿4,500"
    await expect(page.getByText("Total")).toBeVisible();
    await expect(page.getByText("4,500")).toBeVisible();

    // Item amounts
    await expect(page.getByText("450")).toBeVisible();
    await expect(page.getByText("550")).toBeVisible();
  });

  test("shows Download Invoice for closed tabs", async ({ page }) => {
    await mockAuth(page);
    await page.route("**/api/members/tab", (route) =>
      route.fulfill({ json: TAB_CLOSED })
    );

    await page.goto("/dashboard/tab");

    await expect(
      page.getByRole("button", { name: /Download Invoice/i })
    ).toBeVisible({ timeout: 5000 });
  });

  test("does NOT show Download Invoice for open tabs", async ({ page }) => {
    await mockAuth(page);
    await page.route("**/api/members/tab", (route) =>
      route.fulfill({ json: TAB_OPEN })
    );

    await page.goto("/dashboard/tab");

    // Wait for content to load
    await expect(page.getByText("Whiskey Sour")).toBeVisible({
      timeout: 5000,
    });

    await expect(
      page.getByRole("button", { name: /Download Invoice/i })
    ).not.toBeVisible();
  });

  test("shows open status badge for open tab", async ({ page }) => {
    await mockAuth(page);
    await page.route("**/api/members/tab", (route) =>
      route.fulfill({ json: TAB_OPEN })
    );

    await page.goto("/dashboard/tab");

    await expect(page.getByText("Open", { exact: true })).toBeVisible({ timeout: 5000 });
  });

  test("shows closed status badge for closed tab", async ({ page }) => {
    await mockAuth(page);
    await page.route("**/api/members/tab", (route) =>
      route.fulfill({ json: TAB_CLOSED })
    );

    await page.goto("/dashboard/tab");

    await expect(page.getByText("Closed", { exact: true })).toBeVisible({ timeout: 5000 });
  });
});

// ─── Redirect Pages ───────────────────────────────────────────────────────────

test.describe("Dashboard — Redirects", () => {
  test.use({ storageState: ".playwright/.auth/user.json" });

  test("/events redirects to /dashboard/events", async ({ page }) => {
    await mockAuth(page);
    await page.route("**/api/members/events", (route) =>
      route.fulfill({ json: [] })
    );

    await page.goto("/events", { waitUntil: "commit" });

    await page.waitForURL("**/dashboard/events", { timeout: 10000, waitUntil: "commit" });
    expect(page.url()).toContain("/dashboard/events");
  });

  test("/services redirects to /dashboard/services", async ({ page }) => {
    await mockAuth(page);
    await page.route("**/api/members/services", (route) =>
      route.fulfill({ json: [] })
    );

    await page.goto("/services", { waitUntil: "commit" });

    await page.waitForURL("**/dashboard/services", { timeout: 10000, waitUntil: "commit" });
    expect(page.url()).toContain("/dashboard/services");
  });

  test("/tab redirects to /dashboard/tab", async ({ page }) => {
    await mockAuth(page);
    await page.route("**/api/members/tab", (route) =>
      route.fulfill({ json: null })
    );

    await page.goto("/tab", { waitUntil: "commit" });

    await page.waitForURL("**/dashboard/tab", { timeout: 10000, waitUntil: "commit" });
    expect(page.url()).toContain("/dashboard/tab");
  });

  test("/locker redirects to /dashboard/locker", async ({ page }) => {
    await mockAuth(page);
    await page.route("**/api/members/locker", (route) =>
      route.fulfill({ json: null })
    );

    await page.goto("/locker", { waitUntil: "commit" });

    await page.waitForURL("**/dashboard/locker", { timeout: 10000, waitUntil: "commit" });
    expect(page.url()).toContain("/dashboard/locker");
  });
});
