
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

const DEAL_FLOW_PAIRS = [
  {
    buyer: {
      member_id: "buyer-uuid-1",
      full_name: "Alice Finance",
      company_name: "Alpha Capital",
      industry: "Finance",
      tier: "Gold",
      segments: ["Finance & Investors"],
    },
    seller: {
      member_id: "seller-uuid-1",
      full_name: "Bob Tech",
      company_name: "TechStartup",
      industry: "Technology",
      tier: "Silver",
      segments: ["Tech & Founders"],
    },
    mutual_connections: 2,
    score: 8.5,
  },
];

const CHURN_OVERVIEW = {
  retention_rate_30d: 0.85,
  avg_churn_score: 25.0,
  total_members: 50,
  active_30d: 42,
  risk_distribution: { healthy: 35, low: 7, medium: 5, high: 2, critical: 1 },
  at_risk_members: [
    {
      member_id: "risk-uuid-1",
      full_name: "At Risk Member",
      tier: "Silver",
      company_name: "Acme Corp",
      churn_score: 75,
      risk_level: "high",
      last_seen_at: "2025-01-01T00:00:00",
      primary_risk_factor: "Inactive for 45 days",
    },
  ],
};

async function mockAuth(page: Page) {
  await page.route("**/api/auth/me", (route) =>
    route.fulfill({ json: ADMIN_USER })
  );
}

async function mockAnalyticsRoutes(page: Page) {
  // Catch-all registered FIRST — Playwright uses last-registered-wins, so
  // specific routes registered after this will take priority.
  await page.route("**/api/admin/analytics**", (route) =>
    route.fulfill({
      json: {
        total_members: 150,
        total_prospects: 25,
        active_today: 12,
        events_this_week: 3,
      },
    })
  );
  await page.route("**/api/admin/events**", (route) =>
    route.fulfill({
      json: [{ id: "evt-uuid-1", title: "Summer Gala" }],
    })
  );
  // Specific analytics sub-routes registered LAST (win over the catch-all above)
  await page.route("**/api/admin/analytics/revenue", (route) =>
    route.fulfill({
      json: { today: 1000, this_week: 7500, this_month: 30000, top_spenders: [] },
    })
  );
  await page.route("**/api/admin/analytics/loyalty", (route) =>
    route.fulfill({
      json: {
        points_earned_total: 50000,
        points_redeemed_total: 12000,
        avg_balance: 350,
        tier_distribution: { Gold: 20, Silver: 15, Obsidian: 5 },
      },
    })
  );
  await page.route("**/api/admin/analytics/promoters", (route) =>
    route.fulfill({
      json: {
        active_codes: 5,
        total_conversions: 30,
        total_attributed_revenue: 15000,
        top_promoter: null,
        top_promoter_uses: 0,
      },
    })
  );
  await page.route("**/api/admin/analytics/corporate", (route) =>
    route.fulfill({
      json: {
        active_accounts: 3,
        total_seats: 30,
        utilized_seats: 22,
        seat_utilization_pct: 73,
        total_annual_revenue: 120000,
        monthly_revenue: 10000,
      },
    })
  );
  await page.route("**/api/admin/analytics/segment-demand", (route) =>
    route.fulfill({
      json: [
        {
          segment: "Tech & Founders",
          event_count: 5,
          avg_fill_rate: 0.75,
          trending_up: true,
        },
      ],
    })
  );
  await page.route("**/api/admin/analytics/peak-hours", (route) =>
    route.fulfill({
      json: {
        heatmap: Array.from({ length: 7 }, () => Array(24).fill(0)),
        busiest_slot: { weekday_name: "Saturday", hour: 20, count: 45 },
        quietest_slot: { weekday_name: "Monday", hour: 3, count: 1 },
      },
    })
  );
}

// ─── Smart Matching ──────────────────────────────────────────────────────────

test.describe("Admin — Smart Matching", () => {
  test.use({ storageState: ".playwright/.auth/user.json" });

  test("shows Smart Matching heading", async ({ page }) => {
    await mockAuth(page);
    await page.route("**/api/admin/matching/deal-flow", (route) =>
      route.fulfill({ json: DEAL_FLOW_PAIRS })
    );

    await page.goto("/admin/matching");

    await expect(
      page.getByRole("heading", { name: "Smart Matching" })
    ).toBeVisible();
  });

  test("displays buyer and seller names", async ({ page }) => {
    await mockAuth(page);
    await page.route("**/api/admin/matching/deal-flow", (route) =>
      route.fulfill({ json: DEAL_FLOW_PAIRS })
    );

    await page.goto("/admin/matching");

    await expect(page.getByText("Alice Finance")).toBeVisible();
    await expect(page.getByText("Bob Tech")).toBeVisible();
  });

  test("shows Buyer and Seller role labels", async ({ page }) => {
    await mockAuth(page);
    await page.route("**/api/admin/matching/deal-flow", (route) =>
      route.fulfill({ json: DEAL_FLOW_PAIRS })
    );

    await page.goto("/admin/matching");

    await expect(page.getByText("Buyer", { exact: true })).toBeVisible();
    await expect(page.getByText("Seller", { exact: true })).toBeVisible();
  });

  test("shows the score for each pair", async ({ page }) => {
    await mockAuth(page);
    await page.route("**/api/admin/matching/deal-flow", (route) =>
      route.fulfill({ json: DEAL_FLOW_PAIRS })
    );

    await page.goto("/admin/matching");

    await expect(page.getByText("8.5")).toBeVisible();
  });

  test("shows Introduce button for each pair", async ({ page }) => {
    await mockAuth(page);
    await page.route("**/api/admin/matching/deal-flow", (route) =>
      route.fulfill({ json: DEAL_FLOW_PAIRS })
    );

    await page.goto("/admin/matching");

    await expect(
      page.getByRole("button", { name: /introduce/i })
    ).toBeVisible();
  });

  test("shows empty state when no deal-flow pairs", async ({ page }) => {
    await mockAuth(page);
    await page.route("**/api/admin/matching/deal-flow", (route) =>
      route.fulfill({ json: [] })
    );

    await page.goto("/admin/matching");

    await expect(page.getByText(/no complementary pairs/i)).toBeVisible();
  });
});

// ─── Churn Risk ──────────────────────────────────────────────────────────────

test.describe("Admin — Churn Risk", () => {
  test.use({ storageState: ".playwright/.auth/user.json" });

  test("shows Churn Risk heading", async ({ page }) => {
    await mockAuth(page);
    await page.route("**/api/admin/analytics/churn", (route) =>
      route.fulfill({ json: CHURN_OVERVIEW })
    );

    await page.goto("/admin/churn");

    await expect(
      page.getByRole("heading", { name: "Churn Risk" })
    ).toBeVisible();
  });

  test("Retention Rate card shows percentage", async ({ page }) => {
    await mockAuth(page);
    await page.route("**/api/admin/analytics/churn", (route) =>
      route.fulfill({ json: CHURN_OVERVIEW })
    );

    await page.goto("/admin/churn");

    // retention_rate_30d: 0.85 → "85%"
    await expect(page.getByText("85%")).toBeVisible();
  });

  test("shows at-risk member name in table", async ({ page }) => {
    await mockAuth(page);
    await page.route("**/api/admin/analytics/churn", (route) =>
      route.fulfill({ json: CHURN_OVERVIEW })
    );

    await page.goto("/admin/churn");

    await expect(page.getByText("At Risk Member")).toBeVisible();
  });

  test("shows churn score bar value", async ({ page }) => {
    await mockAuth(page);
    await page.route("**/api/admin/analytics/churn", (route) =>
      route.fulfill({ json: CHURN_OVERVIEW })
    );

    await page.goto("/admin/churn");

    await expect(page.getByText("75")).toBeVisible();
  });

  test("shows risk level badge", async ({ page }) => {
    await mockAuth(page);
    await page.route("**/api/admin/analytics/churn", (route) =>
      route.fulfill({ json: CHURN_OVERVIEW })
    );

    await page.goto("/admin/churn");

    await expect(page.getByText(/high/i).first()).toBeVisible();
  });

  test("shows member company name", async ({ page }) => {
    await mockAuth(page);
    await page.route("**/api/admin/analytics/churn", (route) =>
      route.fulfill({ json: CHURN_OVERVIEW })
    );

    await page.goto("/admin/churn");

    await expect(page.getByText("Acme Corp")).toBeVisible();
  });

  test("shows empty state when no at-risk members", async ({ page }) => {
    await mockAuth(page);
    await page.route("**/api/admin/analytics/churn", (route) =>
      route.fulfill({
        json: { ...CHURN_OVERVIEW, at_risk_members: [] },
      })
    );

    await page.goto("/admin/churn");

    await expect(page.getByText(/no at-risk members/i)).toBeVisible();
  });
});

// ─── Analytics — Forecasting ─────────────────────────────────────────────────

test.describe("Admin — Analytics Forecasting", () => {
  test.use({ storageState: ".playwright/.auth/user.json" });

  test("analytics page loads with correct heading", async ({ page }) => {
    await mockAuth(page);
    await mockAnalyticsRoutes(page);

    await page.goto("/admin/analytics");

    await expect(
      page.getByRole("heading", { name: "Analytics Overview" })
    ).toBeVisible();
  });

  test("Event Demand Forecasting section is visible", async ({ page }) => {
    await mockAuth(page);
    await mockAnalyticsRoutes(page);

    await page.goto("/admin/analytics");

    await expect(page.getByText("Event Demand Forecasting")).toBeVisible();
  });

  test("Peak Hours card shows busiest slot after data loads", async ({ page }) => {
    await mockAuth(page);
    await mockAnalyticsRoutes(page);

    await page.goto("/admin/analytics");

    // Peak hours card shows "Busiest: Saturday at 20:00"
    await expect(page.getByText(/busiest/i)).toBeVisible({ timeout: 5000 });
    await expect(page.getByText(/saturday/i)).toBeVisible();
  });

  test("selecting event from forecast dropdown shows prediction", async ({
    page,
  }) => {
    await mockAuth(page);
    await mockAnalyticsRoutes(page);
    await page.route(
      "**/api/admin/analytics/forecast/evt-uuid-1",
      (route) =>
        route.fulfill({
          json: {
            event_id: "evt-uuid-1",
            event_title: "Summer Gala",
            predicted_attendees: 80,
            actual_capacity: 100,
            capacity_utilization_pct: 80.0,
            confidence: "high",
            similar_events_count: 5,
            recommendation: "Strong attendance expected. Confirm catering for full capacity.",
          },
        })
    );

    await page.goto("/admin/analytics");

    // Select event from the dropdown
    await page.selectOption('select', "evt-uuid-1");

    // Check the prediction is shown
    await expect(page.getByText(/80\s*\/\s*100/)).toBeVisible({ timeout: 5000 });
    await expect(page.getByText(/high confidence/i)).toBeVisible();
  });

  test("Revenue Overview section is visible", async ({ page }) => {
    await mockAuth(page);
    await mockAnalyticsRoutes(page);

    await page.goto("/admin/analytics");

    await expect(page.getByText("Revenue Overview")).toBeVisible();
  });
});

// ─── Members List ─────────────────────────────────────────────────────────────

test.describe("Admin — Members", () => {
  test.use({ storageState: ".playwright/.auth/user.json" });

  const MOCK_MEMBERS = [
    {
      id: "member-uuid-1",
      full_name: "John Doe",
      email: "john@example.com",
      tier: "gold",
      is_active: true,
      company_name: "Doe Corp",
      created_at: "2024-01-15T10:00:00",
      segment_groups: [],
      user_type: "member",
    },
    {
      id: "member-uuid-2",
      full_name: "Jane Smith",
      email: "jane@example.com",
      tier: "silver",
      is_active: true,
      company_name: null,
      created_at: "2024-02-20T10:00:00",
      segment_groups: [],
      user_type: "member",
    },
  ];

  test("shows Members heading", async ({ page }) => {
    await mockAuth(page);
    await page.route("**/api/admin/members**", (route) =>
      route.fulfill({ json: MOCK_MEMBERS })
    );

    await page.goto("/admin/members");

    await expect(
      page.getByRole("heading", { name: "Members" })
    ).toBeVisible();
  });

  test("lists member names in the table", async ({ page }) => {
    await mockAuth(page);
    await page.route("**/api/admin/members**", (route) =>
      route.fulfill({ json: MOCK_MEMBERS })
    );

    await page.goto("/admin/members");

    await expect(page.getByText("John Doe")).toBeVisible();
    await expect(page.getByText("Jane Smith")).toBeVisible();
  });

  test("shows member count in subtitle", async ({ page }) => {
    await mockAuth(page);
    await page.route("**/api/admin/members**", (route) =>
      route.fulfill({ json: MOCK_MEMBERS })
    );

    await page.goto("/admin/members");

    // subtitle: "{members.length} total registered"
    await expect(page.getByText(/2 total registered/i)).toBeVisible();
  });
});
