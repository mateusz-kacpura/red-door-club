
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

const NETWORKING_REPORT = {
  connections_count: 7,
  events_attended: 3,
  total_spent: 12500,
  match_score_count: 4,
  top_segments: ["Finance & Investors", "Tech & Founders"],
  suggested_next_steps: [
    "Attend the upcoming networking event",
    "Connect with your top match this week",
  ],
};

const WEEKLY_DIGEST = {
  top_suggestions: [
    {
      member_id: "digest-uuid-1",
      full_name: "Top Pick",
      company_name: "Fintech Co",
      tier: "Gold",
      shared_segments: ["Finance & Investors"],
      shared_events_count: 2,
      score: 9.0,
      reason_text: "Shared interest in fintech investments",
      is_in_venue: true,
    },
    {
      member_id: "digest-uuid-2",
      full_name: "Second Pick",
      company_name: null,
      tier: "Silver",
      shared_segments: ["Tech & Founders"],
      shared_events_count: 1,
      score: 7.5,
      reason_text: "Both in tech industry",
      is_in_venue: false,
    },
  ],
  next_steps: ["Meet Top Pick this week"],
  generated_at: "2024-03-09T12:00:00",
};

async function mockAuth(page: Page) {
  await page.route("**/api/auth/me", (route) =>
    route.fulfill({ json: ADMIN_USER })
  );
  await page.route("**/api/auth/ws-token", (route) =>
    route.fulfill({ json: { token: "fake-ws-token" } })
  );
}

// ─── Dashboard ────────────────────────────────────────────────────────────────

test.describe("Member — Dashboard", () => {
  test.use({ storageState: ".playwright/.auth/user.json" });

  test("shows the welcome subheading", async ({ page }) => {
    await mockAuth(page);
    await page.route("**/api/members/networking-report", (route) =>
      route.fulfill({ json: NETWORKING_REPORT })
    );
    await page.route("**/api/members/suggestions**", (route) =>
      route.fulfill({ json: [] })
    );
    await page.route("**/api/members/points", (route) =>
      route.fulfill({ json: { balance: 350, lifetime_total: 500 } })
    );
    await page.route("**/api/members/engagement-health", (route) =>
      route.fulfill({ json: { risk_level: "healthy", tips: [] } })
    );

    await page.goto("/dashboard");

    await expect(
      page.getByText("Welcome back to S8LLS Club")
    ).toBeVisible({ timeout: 5000 });
  });

  test("shows Connections stat card", async ({ page }) => {
    await mockAuth(page);
    await page.route("**/api/members/networking-report", (route) =>
      route.fulfill({ json: NETWORKING_REPORT })
    );
    await page.route("**/api/members/suggestions**", (route) =>
      route.fulfill({ json: [] })
    );
    await page.route("**/api/members/points", (route) =>
      route.fulfill({ json: { balance: 350, lifetime_total: 500 } })
    );
    await page.route("**/api/members/engagement-health", (route) =>
      route.fulfill({ json: { risk_level: "healthy", tips: [] } })
    );

    await page.goto("/dashboard");

    // report.connections_count = 7
    await expect(page.getByText("7")).toBeVisible({ timeout: 5000 });
  });

  test("does NOT show engagement banner for healthy risk", async ({ page }) => {
    await mockAuth(page);
    await page.route("**/api/members/networking-report", (route) =>
      route.fulfill({ json: NETWORKING_REPORT })
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

    await page.goto("/dashboard");
    // Wait for content to load
    await expect(
      page.getByText("Welcome back to S8LLS Club")
    ).toBeVisible({ timeout: 5000 });

    await expect(page.getByText(/we miss you/i)).not.toBeVisible();
  });

  test("shows engagement banner for high risk", async ({ page }) => {
    await mockAuth(page);
    await page.route("**/api/members/networking-report", (route) =>
      route.fulfill({ json: NETWORKING_REPORT })
    );
    await page.route("**/api/members/suggestions**", (route) =>
      route.fulfill({ json: [] })
    );
    await page.route("**/api/members/points", (route) =>
      route.fulfill({ json: { balance: 0, lifetime_total: 0 } })
    );
    await page.route("**/api/members/engagement-health", (route) =>
      route.fulfill({
        json: {
          risk_level: "high",
          tips: [
            "Visit the club this week",
            "Attend an upcoming event",
          ],
        },
      })
    );

    await page.goto("/dashboard");

    await expect(page.getByText(/we miss you/i)).toBeVisible({ timeout: 5000 });
    await expect(page.getByText("Visit the club this week")).toBeVisible();
  });

  test("shows suggested connections section", async ({ page }) => {
    await mockAuth(page);
    await page.route("**/api/members/networking-report", (route) =>
      route.fulfill({ json: NETWORKING_REPORT })
    );
    await page.route("**/api/members/suggestions**", (route) =>
      route.fulfill({
        json: [
          {
            member_id: "sugg-uuid-1",
            full_name: "Jane Match",
            company_name: "Match Corp",
            tier: "Gold",
            shared_segments: ["Tech & Founders"],
            score: 6.0,
          },
        ],
      })
    );
    await page.route("**/api/members/points", (route) =>
      route.fulfill({ json: { balance: 0, lifetime_total: 0 } })
    );
    await page.route("**/api/members/engagement-health", (route) =>
      route.fulfill({ json: { risk_level: "healthy", tips: [] } })
    );

    await page.goto("/dashboard");

    // "Your Matches" section
    await expect(page.getByText("Your Matches")).toBeVisible({ timeout: 5000 });
    await expect(page.getByText("Jane Match")).toBeVisible();
  });
});

// ─── Connections + Network Gaps ──────────────────────────────────────────────

test.describe("Member — Connections & Network Gaps", () => {
  test.use({ storageState: ".playwright/.auth/user.json" });

  test("shows Connections heading", async ({ page }) => {
    await mockAuth(page);
    await page.route("**/api/members/connections", (route) =>
      route.fulfill({ json: [] })
    );
    await page.route("**/api/members/suggestions**", (route) =>
      route.fulfill({ json: [] })
    );
    await page.route("**/api/members/connection-gaps", (route) =>
      route.fulfill({
        json: {
          user_segments: [],
          connected_segments: {},
          missing_or_weak_segments: [],
          priority_suggestions: [],
        },
      })
    );

    await page.goto("/dashboard/connections");

    await expect(
      page.getByRole("heading", { name: "Connections" })
    ).toBeVisible();
  });

  test("displays existing connection name", async ({ page }) => {
    await mockAuth(page);
    await page.route("**/api/members/connections", (route) =>
      route.fulfill({
        json: [
          {
            id: "conn-uuid-1",
            other_member: {
              full_name: "Friend One",
              company_name: "BigCo",
              tier: "Silver",
              industry: "Finance",
            },
            connection_type: "tap",
            created_at: "2024-06-15T10:00:00",
          },
        ],
      })
    );
    await page.route("**/api/members/suggestions**", (route) =>
      route.fulfill({ json: [] })
    );
    await page.route("**/api/members/connection-gaps", (route) =>
      route.fulfill({
        json: {
          user_segments: [],
          connected_segments: {},
          missing_or_weak_segments: [],
          priority_suggestions: [],
        },
      })
    );

    await page.goto("/dashboard/connections");

    await expect(page.getByText("Friend One")).toBeVisible({ timeout: 5000 });
  });

  test("Network Gaps section shows missing segments", async ({ page }) => {
    await mockAuth(page);
    await page.route("**/api/members/connections", (route) =>
      route.fulfill({ json: [] })
    );
    await page.route("**/api/members/suggestions**", (route) =>
      route.fulfill({ json: [] })
    );
    await page.route("**/api/members/connection-gaps", (route) =>
      route.fulfill({
        json: {
          user_segments: ["Finance & Investors"],
          connected_segments: {},
          missing_or_weak_segments: ["Legal & Advisory", "Tech & Founders"],
          priority_suggestions: [
            {
              member_id: "gap-uuid-1",
              full_name: "Bob Lawyer",
              company_name: "Law Firm",
              shared_segments: [],
              score: 3.0,
              reason_text: "Legal expert in your network gap",
              is_in_venue: false,
            },
          ],
        },
      })
    );

    await page.goto("/dashboard/connections");

    await expect(page.getByText("Network Gaps")).toBeVisible({ timeout: 5000 });
    await expect(page.getByText("Legal & Advisory")).toBeVisible();
    await expect(page.getByText("Tech & Founders")).toBeVisible();
    await expect(page.getByText("Bob Lawyer")).toBeVisible();
    await expect(
      page.getByText("Legal expert in your network gap")
    ).toBeVisible();
  });

  test("has See all suggestions link to networking report", async ({ page }) => {
    await mockAuth(page);
    await page.route("**/api/members/connections", (route) =>
      route.fulfill({ json: [] })
    );
    await page.route("**/api/members/suggestions**", (route) =>
      route.fulfill({ json: [] })
    );
    await page.route("**/api/members/connection-gaps", (route) =>
      route.fulfill({
        json: {
          user_segments: ["Finance & Investors"],
          connected_segments: {},
          missing_or_weak_segments: ["Tech & Founders"],
          priority_suggestions: [],
        },
      })
    );

    await page.goto("/dashboard/connections");

    const link = page.getByRole("link", { name: /see all suggestions/i });
    await expect(link).toBeVisible({ timeout: 5000 });
    await expect(link).toHaveAttribute("href", "/dashboard/networking-report");
  });
});

// ─── Networking Report + Weekly Digest ───────────────────────────────────────

test.describe("Member — Networking Report", () => {
  test.use({ storageState: ".playwright/.auth/user.json" });

  test("shows Networking Report heading", async ({ page }) => {
    await mockAuth(page);
    await page.route("**/api/members/networking-report", (route) =>
      route.fulfill({ json: NETWORKING_REPORT })
    );
    await page.route("**/api/members/digest", (route) =>
      route.fulfill({ json: WEEKLY_DIGEST })
    );

    await page.goto("/dashboard/networking-report");

    await expect(
      page.getByRole("heading", { name: "Networking Report" })
    ).toBeVisible();
  });

  test("shows stat cards with connections and events data", async ({
    page,
  }) => {
    await mockAuth(page);
    await page.route("**/api/members/networking-report", (route) =>
      route.fulfill({ json: NETWORKING_REPORT })
    );
    await page.route("**/api/members/digest", (route) =>
      route.fulfill({ json: null })
    );

    await page.goto("/dashboard/networking-report");

    // connections_count = 7, events_attended = 3
    await expect(page.getByText("7")).toBeVisible({ timeout: 5000 });
    await expect(page.getByText("3")).toBeVisible();
  });

  test("shows This Week's Top Picks section with digest suggestions", async ({
    page,
  }) => {
    await mockAuth(page);
    await page.route("**/api/members/networking-report", (route) =>
      route.fulfill({ json: NETWORKING_REPORT })
    );
    await page.route("**/api/members/digest", (route) =>
      route.fulfill({ json: WEEKLY_DIGEST })
    );

    await page.goto("/dashboard/networking-report");

    await expect(
      page.getByText("This Week's Top Picks")
    ).toBeVisible({ timeout: 5000 });
    await expect(page.getByText("Top Pick", { exact: true })).toBeVisible();
    await expect(
      page.getByText("Shared interest in fintech investments")
    ).toBeVisible();
  });

  test("shows In Venue badge for in-venue suggestion", async ({ page }) => {
    await mockAuth(page);
    await page.route("**/api/members/networking-report", (route) =>
      route.fulfill({ json: NETWORKING_REPORT })
    );
    await page.route("**/api/members/digest", (route) =>
      route.fulfill({ json: WEEKLY_DIGEST })
    );

    await page.goto("/dashboard/networking-report");

    // "Top Pick" has is_in_venue: true → "In Venue" badge
    await expect(page.getByText("In Venue")).toBeVisible({ timeout: 5000 });
  });

  test("second suggestion without in-venue badge is shown normally", async ({
    page,
  }) => {
    await mockAuth(page);
    await page.route("**/api/members/networking-report", (route) =>
      route.fulfill({ json: NETWORKING_REPORT })
    );
    await page.route("**/api/members/digest", (route) =>
      route.fulfill({ json: WEEKLY_DIGEST })
    );

    await page.goto("/dashboard/networking-report");

    await expect(page.getByText("Second Pick")).toBeVisible({ timeout: 5000 });
    await expect(page.getByText("Both in tech industry")).toBeVisible();
  });

  test("shows suggested next steps from report", async ({ page }) => {
    await mockAuth(page);
    await page.route("**/api/members/networking-report", (route) =>
      route.fulfill({ json: NETWORKING_REPORT })
    );
    await page.route("**/api/members/digest", (route) =>
      route.fulfill({ json: null })
    );

    await page.goto("/dashboard/networking-report");

    await expect(
      page.getByText("Attend the upcoming networking event")
    ).toBeVisible({ timeout: 5000 });
  });
});

// ─── Loyalty ─────────────────────────────────────────────────────────────────

test.describe("Member — Loyalty", () => {
  test.use({ storageState: ".playwright/.auth/user.json" });

  test("shows points balance", async ({ page }) => {
    await mockAuth(page);
    await page.route("**/api/members/points/history**", (route) =>
      route.fulfill({ json: [] })
    );
    await page.route("**/api/members/points", (route) =>
      route.fulfill({ json: { balance: 350, lifetime_total: 500 } })
    );

    await page.goto("/dashboard/loyalty");

    // Balance: 350 — use exact match to avoid collision with "350 pts" span
    await expect(page.getByText("350", { exact: true })).toBeVisible({ timeout: 5000 });
  });

  test("shows redemption options", async ({ page }) => {
    await mockAuth(page);
    await page.route("**/api/members/points/history**", (route) =>
      route.fulfill({ json: [] })
    );
    await page.route("**/api/members/points", (route) =>
      route.fulfill({ json: { balance: 200, lifetime_total: 300 } })
    );

    await page.goto("/dashboard/loyalty");

    // Redemption options: Event Ticket, Car Booking, Studio Session
    await expect(page.getByText("Event Ticket")).toBeVisible({ timeout: 5000 });
    await expect(page.getByText("Car Booking")).toBeVisible();
  });

  test("shows transaction history section when transactions exist", async ({
    page,
  }) => {
    await mockAuth(page);
    await page.route("**/api/members/points/history**", (route) =>
      route.fulfill({
        json: [
          {
            id: "txn-uuid-1",
            points: 50,
            reason: "venue_entry",
            created_at: "2024-03-01T20:00:00",
          },
        ],
      })
    );
    await page.route("**/api/members/points", (route) =>
      route.fulfill({ json: { balance: 50, lifetime_total: 50 } })
    );

    await page.goto("/dashboard/loyalty");

    // Transaction History section appears when there are transactions
    await expect(page.getByText("Transaction History")).toBeVisible({ timeout: 5000 });
    // The transaction reason "venue_entry" is not in REASON_LABELS so renders raw
    await expect(page.getByText("venue_entry")).toBeVisible();
  });
});
