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
  await page.route("**/api/auth/me", (route) =>
    route.fulfill({ json: ADMIN_USER })
  );
}

// ─── Events ─────────────────────────────────────────────────────────────────────

test.describe("Admin — Events", () => {
  test.use({ storageState: ".playwright/.auth/user.json" });

  const MOCK_EVENTS = [
    {
      id: "evt-uuid-1",
      title: "Summer Gala",
      event_type: "mixer",
      status: "published",
      starts_at: "2026-04-01T20:00:00",
      capacity: 100,
      ticket_price: "500.00",
      rsvp_count: 42,
      target_segments: ["Finance & Investors", "Tech & Founders"],
      min_tier: null,
    },
    {
      id: "evt-uuid-2",
      title: "Founders Dinner",
      event_type: "dinner",
      status: "draft",
      starts_at: "2026-04-15T19:00:00",
      capacity: 30,
      ticket_price: "0.00",
      rsvp_count: 0,
      target_segments: [],
      min_tier: "gold",
    },
  ];

  test("shows Events heading", async ({ page }) => {
    await mockAuth(page);
    await page.route("**/api/admin/events**", (route) =>
      route.fulfill({ json: MOCK_EVENTS })
    );

    await page.goto("/admin/events");

    await expect(
      page.getByRole("heading", { name: "Events" })
    ).toBeVisible();
  });

  test("displays event titles and statuses", async ({ page }) => {
    await mockAuth(page);
    await page.route("**/api/admin/events**", (route) =>
      route.fulfill({ json: MOCK_EVENTS })
    );

    await page.goto("/admin/events");

    await expect(page.getByText("Summer Gala")).toBeVisible();
    await expect(page.getByText("Founders Dinner")).toBeVisible();
    await expect(page.getByText("published")).toBeVisible();
    await expect(page.getByText("draft")).toBeVisible();
  });

  test("shows total events count", async ({ page }) => {
    await mockAuth(page);
    await page.route("**/api/admin/events**", (route) =>
      route.fulfill({ json: MOCK_EVENTS })
    );

    await page.goto("/admin/events");

    await expect(page.getByText(/2 total events/i)).toBeVisible();
  });

  test("shows RSVP count and capacity", async ({ page }) => {
    await mockAuth(page);
    await page.route("**/api/admin/events**", (route) =>
      route.fulfill({ json: MOCK_EVENTS })
    );

    await page.goto("/admin/events");

    await expect(page.getByText("42/100 attending")).toBeVisible();
  });

  test("shows Create Event button", async ({ page }) => {
    await mockAuth(page);
    await page.route("**/api/admin/events**", (route) =>
      route.fulfill({ json: MOCK_EVENTS })
    );

    await page.goto("/admin/events");

    await expect(
      page.getByRole("button", { name: /create event/i })
    ).toBeVisible();
  });

  test("shows empty state when no events", async ({ page }) => {
    await mockAuth(page);
    await page.route("**/api/admin/events**", (route) =>
      route.fulfill({ json: [] })
    );

    await page.goto("/admin/events");

    await expect(page.getByText(/no events created yet/i)).toBeVisible();
  });

  test("shows create form when Create Event is clicked", async ({ page }) => {
    await mockAuth(page);
    await page.route("**/api/admin/events**", (route) =>
      route.fulfill({ json: [] })
    );

    await page.goto("/admin/events");

    await page.getByRole("button", { name: /create event/i }).click();

    await expect(page.getByText(/new event/i)).toBeVisible();
  });
});

// ─── Services ───────────────────────────────────────────────────────────────────

test.describe("Admin — Services", () => {
  test.use({ storageState: ".playwright/.auth/user.json" });

  const MOCK_SERVICES = [
    {
      id: "svc-uuid-1",
      request_type: "bar",
      status: "pending",
      member_name: "Alice Johnson",
      member_id: "member-uuid-1",
      assigned_to_name: null,
      details: { notes: "Need premium whisky selection" },
      created_at: "2026-03-20T18:00:00",
      completed_at: null,
    },
    {
      id: "svc-uuid-2",
      request_type: "car",
      status: "in_progress",
      member_name: "Bob Smith",
      member_id: "member-uuid-2",
      assigned_to_name: "Staff Mike",
      details: { notes: "Black sedan preferred" },
      created_at: "2026-03-20T17:30:00",
      completed_at: null,
    },
  ];

  test("shows Services heading", async ({ page }) => {
    await mockAuth(page);
    await page.route("**/api/admin/services**", (route) =>
      route.fulfill({ json: MOCK_SERVICES })
    );

    await page.goto("/admin/services");

    await expect(
      page.getByRole("heading", { name: "Services" })
    ).toBeVisible();
  });

  test("displays member names in service cards", async ({ page }) => {
    await mockAuth(page);
    await page.route("**/api/admin/services**", (route) =>
      route.fulfill({ json: MOCK_SERVICES })
    );

    await page.goto("/admin/services");

    await expect(page.getByText("Alice Johnson")).toBeVisible();
    await expect(page.getByText("Bob Smith")).toBeVisible();
  });

  test("shows service type badges", async ({ page }) => {
    await mockAuth(page);
    await page.route("**/api/admin/services**", (route) =>
      route.fulfill({ json: MOCK_SERVICES })
    );

    await page.goto("/admin/services");

    await expect(page.getByText("bar", { exact: true })).toBeVisible();
    await expect(page.getByText("car", { exact: true })).toBeVisible();
  });

  test("shows filter tabs", async ({ page }) => {
    await mockAuth(page);
    await page.route("**/api/admin/services**", (route) =>
      route.fulfill({ json: MOCK_SERVICES })
    );

    await page.goto("/admin/services");

    await expect(page.getByText("All", { exact: true })).toBeVisible();
    await expect(page.getByText("Pending", { exact: true })).toBeVisible();
    await expect(page.getByText("In Progress", { exact: true })).toBeVisible();
    await expect(page.getByText("Completed", { exact: true })).toBeVisible();
  });

  test("shows empty state when no requests", async ({ page }) => {
    await mockAuth(page);
    await page.route("**/api/admin/services**", (route) =>
      route.fulfill({ json: [] })
    );

    await page.goto("/admin/services");

    await expect(page.getByText(/no service requests/i)).toBeVisible();
  });
});

// ─── Lockers ────────────────────────────────────────────────────────────────────

test.describe("Admin — Lockers", () => {
  test.use({ storageState: ".playwright/.auth/user.json" });

  const MOCK_LOCKERS = [
    {
      id: "locker-uuid-1",
      locker_number: "A01",
      location: "main_floor",
      status: "occupied",
      member_id: "member-uuid-1",
    },
    {
      id: "locker-uuid-2",
      locker_number: "B02",
      location: "vip_room",
      status: "available",
      member_id: null,
    },
    {
      id: "locker-uuid-3",
      locker_number: "C03",
      location: "entrance",
      status: "available",
      member_id: null,
    },
  ];

  test("shows Lockers heading", async ({ page }) => {
    await mockAuth(page);
    await page.route("**/api/admin/lockers**", (route) =>
      route.fulfill({ json: MOCK_LOCKERS })
    );

    await page.goto("/admin/lockers");

    await expect(
      page.getByRole("heading", { name: "Lockers" })
    ).toBeVisible();
  });

  test("displays locker numbers", async ({ page }) => {
    await mockAuth(page);
    await page.route("**/api/admin/lockers**", (route) =>
      route.fulfill({ json: MOCK_LOCKERS })
    );

    await page.goto("/admin/lockers");

    await expect(page.getByText("A01")).toBeVisible();
    await expect(page.getByText("B02")).toBeVisible();
    await expect(page.getByText("C03")).toBeVisible();
  });

  test("shows available and occupied counts", async ({ page }) => {
    await mockAuth(page);
    await page.route("**/api/admin/lockers**", (route) =>
      route.fulfill({ json: MOCK_LOCKERS })
    );

    await page.goto("/admin/lockers");

    await expect(page.getByText(/2 available/i)).toBeVisible();
    await expect(page.getByText(/1 occupied/i)).toBeVisible();
  });

  test("shows Add Locker button", async ({ page }) => {
    await mockAuth(page);
    await page.route("**/api/admin/lockers**", (route) =>
      route.fulfill({ json: MOCK_LOCKERS })
    );

    await page.goto("/admin/lockers");

    await expect(
      page.getByRole("button", { name: /add locker/i })
    ).toBeVisible();
  });

  test("shows empty state when no lockers", async ({ page }) => {
    await mockAuth(page);
    await page.route("**/api/admin/lockers**", (route) =>
      route.fulfill({ json: [] })
    );

    await page.goto("/admin/lockers");

    await expect(page.getByText(/no lockers configured/i)).toBeVisible();
  });
});

// ─── Loyalty ────────────────────────────────────────────────────────────────────

test.describe("Admin — Loyalty", () => {
  test.use({ storageState: ".playwright/.auth/user.json" });

  const MOCK_LEADERBOARD = [
    {
      rank: 1,
      member_id: "member-uuid-1",
      full_name: "Top Earner Alice",
      company_name: "Alpha Corp",
      tier: "gold",
      lifetime_points: 15000,
      current_balance: 8500,
    },
    {
      rank: 2,
      member_id: "member-uuid-2",
      full_name: "Silver Bob",
      company_name: null,
      tier: "silver",
      lifetime_points: 9200,
      current_balance: 3100,
    },
  ];

  test("shows Loyalty Management heading", async ({ page }) => {
    await mockAuth(page);
    await page.route("**/api/admin/loyalty/leaderboard**", (route) =>
      route.fulfill({ json: MOCK_LEADERBOARD })
    );

    await page.goto("/admin/loyalty");

    await expect(
      page.getByRole("heading", { name: "Loyalty Management" })
    ).toBeVisible();
  });

  test("displays leaderboard member names", async ({ page }) => {
    await mockAuth(page);
    await page.route("**/api/admin/loyalty/leaderboard**", (route) =>
      route.fulfill({ json: MOCK_LEADERBOARD })
    );

    await page.goto("/admin/loyalty");

    await expect(page.getByText("Top Earner Alice")).toBeVisible();
    await expect(page.getByText("Silver Bob")).toBeVisible();
  });

  test("displays lifetime points", async ({ page }) => {
    await mockAuth(page);
    await page.route("**/api/admin/loyalty/leaderboard**", (route) =>
      route.fulfill({ json: MOCK_LEADERBOARD })
    );

    await page.goto("/admin/loyalty");

    await expect(page.getByText("15,000")).toBeVisible();
    await expect(page.getByText("9,200")).toBeVisible();
  });

  test("shows Award Points section", async ({ page }) => {
    await mockAuth(page);
    await page.route("**/api/admin/loyalty/leaderboard**", (route) =>
      route.fulfill({ json: MOCK_LEADERBOARD })
    );

    await page.goto("/admin/loyalty");

    await expect(page.getByText(/award points/i).first()).toBeVisible();
  });

  test("shows empty state when no leaderboard data", async ({ page }) => {
    await mockAuth(page);
    await page.route("**/api/admin/loyalty/leaderboard**", (route) =>
      route.fulfill({ json: [] })
    );

    await page.goto("/admin/loyalty");

    await expect(page.getByText(/no activity yet/i)).toBeVisible();
  });
});

// ─── Tabs ───────────────────────────────────────────────────────────────────────

test.describe("Admin — Tabs", () => {
  test.use({ storageState: ".playwright/.auth/user.json" });

  const MOCK_TABS = [
    {
      id: "tab-uuid-1",
      member_id: "member-uuid-1",
      opened_at: "2026-03-20T19:00:00",
      closed_at: null,
      total_amount: 2500,
      items: [
        { id: "item-1", description: "Champagne", amount: 1500 },
        { id: "item-2", description: "Cocktail", amount: 500 },
        { id: "item-3", description: "Snack Platter", amount: 500 },
      ],
    },
    {
      id: "tab-uuid-2",
      member_id: "member-uuid-2",
      opened_at: "2026-03-20T20:00:00",
      closed_at: null,
      total_amount: 800,
      items: [
        { id: "item-4", description: "Beer", amount: 300 },
        { id: "item-5", description: "Wings", amount: 500 },
      ],
    },
  ];

  test("shows Open Tabs heading", async ({ page }) => {
    await mockAuth(page);
    await page.route("**/api/admin/tabs**", (route) =>
      route.fulfill({ json: MOCK_TABS })
    );

    await page.goto("/admin/tabs");

    await expect(
      page.getByRole("heading", { name: "Open Tabs" })
    ).toBeVisible();
  });

  test("displays tab items", async ({ page }) => {
    await mockAuth(page);
    await page.route("**/api/admin/tabs**", (route) =>
      route.fulfill({ json: MOCK_TABS })
    );

    await page.goto("/admin/tabs");

    await expect(page.getByText("Champagne")).toBeVisible();
    await expect(page.getByText("Beer")).toBeVisible();
  });

  test("shows Close Tab button for each tab", async ({ page }) => {
    await mockAuth(page);
    await page.route("**/api/admin/tabs**", (route) =>
      route.fulfill({ json: MOCK_TABS })
    );

    await page.goto("/admin/tabs");

    const closeButtons = page.getByRole("button", { name: /close tab/i });
    await expect(closeButtons).toHaveCount(2);
  });

  test("shows Export CSV button", async ({ page }) => {
    await mockAuth(page);
    await page.route("**/api/admin/tabs**", (route) =>
      route.fulfill({ json: MOCK_TABS })
    );

    await page.goto("/admin/tabs");

    await expect(
      page.getByRole("button", { name: /export csv/i })
    ).toBeVisible();
  });

  test("shows empty state when no tabs", async ({ page }) => {
    await mockAuth(page);
    await page.route("**/api/admin/tabs**", (route) =>
      route.fulfill({ json: [] })
    );

    await page.goto("/admin/tabs");

    await expect(page.getByText(/no open tabs at the moment/i)).toBeVisible();
  });
});

// ─── Promoters ──────────────────────────────────────────────────────────────────

test.describe("Admin — Promoters", () => {
  test.use({ storageState: ".playwright/.auth/user.json" });

  const MOCK_PROMOTERS = [
    {
      promoter_id: "promo-uuid-1",
      full_name: "Carlos Promoter",
      email: "carlos@promo.com",
      company_name: "Promo Agency",
      total_codes: 3,
      total_uses: 45,
      total_revenue: 25000,
      commission_earned: 5000,
      pending_payout: 1500,
    },
    {
      promoter_id: "promo-uuid-2",
      full_name: "Diana Influencer",
      email: "diana@influence.com",
      company_name: null,
      total_codes: 1,
      total_uses: 12,
      total_revenue: 8000,
      commission_earned: 1600,
      pending_payout: 0,
    },
  ];

  test("shows Promoters heading", async ({ page }) => {
    await mockAuth(page);
    await page.route("**/api/admin/promoters**", (route) =>
      route.fulfill({ json: MOCK_PROMOTERS })
    );

    await page.goto("/admin/promoters");

    await expect(
      page.getByRole("heading", { name: "Promoters" })
    ).toBeVisible();
  });

  test("displays promoter names and emails", async ({ page }) => {
    await mockAuth(page);
    await page.route("**/api/admin/promoters**", (route) =>
      route.fulfill({ json: MOCK_PROMOTERS })
    );

    await page.goto("/admin/promoters");

    await expect(page.getByText("Carlos Promoter")).toBeVisible();
    await expect(page.getByText("carlos@promo.com")).toBeVisible();
    await expect(page.getByText("Diana Influencer")).toBeVisible();
    await expect(page.getByText("diana@influence.com")).toBeVisible();
  });

  test("shows usage stats for promoters", async ({ page }) => {
    await mockAuth(page);
    await page.route("**/api/admin/promoters**", (route) =>
      route.fulfill({ json: MOCK_PROMOTERS })
    );

    await page.goto("/admin/promoters");

    await expect(page.getByText("45")).toBeVisible();
    await expect(page.getByText("12")).toBeVisible();
  });

  test("shows pending payout notice", async ({ page }) => {
    await mockAuth(page);
    await page.route("**/api/admin/promoters**", (route) =>
      route.fulfill({ json: MOCK_PROMOTERS })
    );

    await page.goto("/admin/promoters");

    await expect(page.getByText(/pending payout/i).first()).toBeVisible();
  });

  test("shows empty state when no promoters", async ({ page }) => {
    await mockAuth(page);
    await page.route("**/api/admin/promoters**", (route) =>
      route.fulfill({ json: [] })
    );

    await page.goto("/admin/promoters");

    await expect(page.getByText(/no promoters registered/i)).toBeVisible();
  });
});

// ─── Floor View ─────────────────────────────────────────────────────────────────

test.describe("Admin — Floor View", () => {
  test.use({ storageState: ".playwright/.auth/user.json" });

  const MOCK_FLOOR = [
    {
      member_id: "member-uuid-1",
      full_name: "Alice VIP",
      company_name: "VIP Corp",
      tier: "gold",
      location: "main lounge",
      entry_time: "2026-03-20T19:30:00",
    },
    {
      member_id: "member-uuid-2",
      full_name: "Bob Guest",
      company_name: null,
      tier: "silver",
      location: "bar area",
      entry_time: "2026-03-20T20:00:00",
    },
  ];

  test("shows Live Floor View heading", async ({ page }) => {
    await mockAuth(page);
    await page.route("**/api/admin/floor**", (route) =>
      route.fulfill({ json: MOCK_FLOOR })
    );

    await page.goto("/admin/floor");

    await expect(
      page.getByRole("heading", { name: "Live Floor View" })
    ).toBeVisible();
  });

  test("displays members currently in venue", async ({ page }) => {
    await mockAuth(page);
    await page.route("**/api/admin/floor**", (route) =>
      route.fulfill({ json: MOCK_FLOOR })
    );

    await page.goto("/admin/floor");

    await expect(page.getByText("Alice VIP")).toBeVisible();
    await expect(page.getByText("Bob Guest")).toBeVisible();
  });

  test("shows venue count", async ({ page }) => {
    await mockAuth(page);
    await page.route("**/api/admin/floor**", (route) =>
      route.fulfill({ json: MOCK_FLOOR })
    );

    await page.goto("/admin/floor");

    await expect(page.getByText(/2 in venue/i)).toBeVisible();
  });

  test("shows LIVE indicator", async ({ page }) => {
    await mockAuth(page);
    await page.route("**/api/admin/floor**", (route) =>
      route.fulfill({ json: MOCK_FLOOR })
    );

    await page.goto("/admin/floor");

    await expect(page.getByText("LIVE", { exact: true })).toBeVisible();
  });

  test("shows empty state when no members on floor", async ({ page }) => {
    await mockAuth(page);
    await page.route("**/api/admin/floor**", (route) =>
      route.fulfill({ json: [] })
    );

    await page.goto("/admin/floor");

    await expect(
      page.getByText(/no members detected in venue/i)
    ).toBeVisible();
  });
});

// ─── Staff Performance ──────────────────────────────────────────────────────────

test.describe("Admin — Staff Performance", () => {
  test.use({ storageState: ".playwright/.auth/user.json" });

  const MOCK_STAFF_DATA = {
    summary: {
      total_staff: 5,
      month_checkins: 342,
      month_revenue: 85000,
      top_performer: "Staff Alice",
    },
    staff: [
      {
        rank: 1,
        staff_id: "staff-uuid-1",
        full_name: "Staff Alice",
        today_checkins: 15,
        month_checkins: 120,
        month_revenue: 30000,
        total_checkins: 450,
        total_revenue: 112000,
        events_worked: 30,
        avg_per_event: 15,
      },
      {
        rank: 2,
        staff_id: "staff-uuid-2",
        full_name: "Staff Bob",
        today_checkins: 8,
        month_checkins: 95,
        month_revenue: 22000,
        total_checkins: 310,
        total_revenue: 78000,
        events_worked: 25,
        avg_per_event: 12,
      },
    ],
  };

  test("shows Staff Performance heading", async ({ page }) => {
    await mockAuth(page);
    await page.route("**/api/admin/analytics/staff**", (route) =>
      route.fulfill({ json: MOCK_STAFF_DATA })
    );

    await page.goto("/admin/staff");

    await expect(
      page.getByRole("heading", { name: "Staff Performance" })
    ).toBeVisible();
  });

  test("displays KPI cards with summary data", async ({ page }) => {
    await mockAuth(page);
    await page.route("**/api/admin/analytics/staff**", (route) =>
      route.fulfill({ json: MOCK_STAFF_DATA })
    );

    await page.goto("/admin/staff");

    await expect(page.getByText("5", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("342")).toBeVisible();
    // "Staff Alice" appears in KPI card + leaderboard table — use .first()
    await expect(page.getByText("Staff Alice").first()).toBeVisible();
  });

  test("shows staff leaderboard table", async ({ page }) => {
    await mockAuth(page);
    await page.route("**/api/admin/analytics/staff**", (route) =>
      route.fulfill({ json: MOCK_STAFF_DATA })
    );

    await page.goto("/admin/staff");

    await expect(page.getByText("Staff Leaderboard")).toBeVisible();
    await expect(page.getByText("Staff Bob")).toBeVisible();
  });

  test("shows no data message when staff list is empty", async ({ page }) => {
    await mockAuth(page);
    await page.route("**/api/admin/analytics/staff**", (route) =>
      route.fulfill({
        json: {
          summary: {
            total_staff: 0,
            month_checkins: 0,
            month_revenue: 0,
            top_performer: null,
          },
          staff: [],
        },
      })
    );

    await page.goto("/admin/staff");

    await expect(
      page.getByText(/no staff checkin data available/i)
    ).toBeVisible();
  });

  test("shows no data when API returns null", async ({ page }) => {
    await mockAuth(page);
    await page.route("**/api/admin/analytics/staff**", (route) =>
      route.fulfill({ status: 500, body: "Server error" })
    );

    await page.goto("/admin/staff");

    await expect(
      page.getByText(/no staff checkin data available/i)
    ).toBeVisible();
  });
});

// ─── Activity ───────────────────────────────────────────────────────────────────

test.describe("Admin — Activity", () => {
  test.use({ storageState: ".playwright/.auth/user.json" });

  const MOCK_ACTIVITY = [
    {
      id: "tap-uuid-1",
      member_id: "member-uuid-1",
      member_name: "Alice Entry",
      card_id: "NFC-001",
      tap_type: "venue_entry",
      reader_id: null,
      location: "Main Gate",
      tapped_at: "2026-03-20T19:15:00",
      metadata: null,
    },
    {
      id: "tap-uuid-2",
      member_id: "member-uuid-2",
      member_name: "Bob Payment",
      card_id: "NFC-002",
      tap_type: "payment_tap",
      reader_id: null,
      location: "Bar",
      tapped_at: "2026-03-20T19:30:00",
      metadata: null,
    },
    {
      id: "tap-uuid-3",
      member_id: "member-uuid-3",
      member_name: "Charlie Locker",
      card_id: "NFC-003",
      tap_type: "locker_access",
      reader_id: null,
      location: "Locker Room",
      tapped_at: "2026-03-20T19:45:00",
      metadata: null,
    },
  ];

  test("shows Activity heading", async ({ page }) => {
    await mockAuth(page);
    await page.route("**/api/admin/activity**", (route) =>
      route.fulfill({ json: MOCK_ACTIVITY })
    );

    await page.goto("/admin/activity");

    await expect(
      page.getByRole("heading", { name: "Activity" })
    ).toBeVisible();
  });

  test("displays member names in activity table", async ({ page }) => {
    await mockAuth(page);
    await page.route("**/api/admin/activity**", (route) =>
      route.fulfill({ json: MOCK_ACTIVITY })
    );

    await page.goto("/admin/activity");

    await expect(page.getByText("Alice Entry")).toBeVisible();
    await expect(page.getByText("Bob Payment")).toBeVisible();
    await expect(page.getByText("Charlie Locker")).toBeVisible();
  });

  test("shows tap type labels", async ({ page }) => {
    await mockAuth(page);
    await page.route("**/api/admin/activity**", (route) =>
      route.fulfill({ json: MOCK_ACTIVITY })
    );

    await page.goto("/admin/activity");

    await expect(page.getByText("venue entry").first()).toBeVisible();
    await expect(page.getByText("payment tap").first()).toBeVisible();
  });

  test("shows LIVE indicator", async ({ page }) => {
    await mockAuth(page);
    await page.route("**/api/admin/activity**", (route) =>
      route.fulfill({ json: MOCK_ACTIVITY })
    );

    await page.goto("/admin/activity");

    await expect(page.getByText("LIVE", { exact: true })).toBeVisible();
  });

  test("shows filter buttons", async ({ page }) => {
    await mockAuth(page);
    await page.route("**/api/admin/activity**", (route) =>
      route.fulfill({ json: MOCK_ACTIVITY })
    );

    await page.goto("/admin/activity");

    await expect(page.getByText("All", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "venue entry" })).toBeVisible();
    await expect(page.getByRole("button", { name: "payment tap" })).toBeVisible();
  });

  test("shows empty state when no activity", async ({ page }) => {
    await mockAuth(page);
    await page.route("**/api/admin/activity**", (route) =>
      route.fulfill({ json: [] })
    );

    await page.goto("/admin/activity");

    await expect(page.getByText(/no activity recorded yet/i)).toBeVisible();
  });
});

// ─── Checklist ──────────────────────────────────────────────────────────────────

test.describe("Admin — Checklist", () => {
  test.use({ storageState: ".playwright/.auth/user.json" });

  const MOCK_CHECKLIST = [
    {
      id: "check-uuid-1",
      request_type: "bar",
      status: "pending",
      details: { notes: "Stock premium gin" },
      created_at: "2026-03-20T10:00:00",
      member_id: "member-uuid-1",
    },
    {
      id: "check-uuid-2",
      request_type: "restaurant",
      status: "completed",
      details: { notes: "Vegan option ready" },
      created_at: "2026-03-20T09:30:00",
      member_id: "member-uuid-2",
    },
    {
      id: "check-uuid-3",
      request_type: "bar",
      status: "pending",
      details: { notes: "Ice machine refill" },
      created_at: "2026-03-20T10:30:00",
      member_id: "member-uuid-3",
    },
  ];

  test("shows Prep Checklist heading", async ({ page }) => {
    await mockAuth(page);
    await page.route("**/api/admin/checklist**", (route) =>
      route.fulfill({ json: MOCK_CHECKLIST })
    );

    await page.goto("/admin/checklist");

    await expect(
      page.getByRole("heading", { name: "Prep Checklist" })
    ).toBeVisible();
  });

  test("displays checklist task notes", async ({ page }) => {
    await mockAuth(page);
    await page.route("**/api/admin/checklist**", (route) =>
      route.fulfill({ json: MOCK_CHECKLIST })
    );

    await page.goto("/admin/checklist");

    await expect(page.getByText("Stock premium gin")).toBeVisible();
    await expect(page.getByText("Vegan option ready")).toBeVisible();
    await expect(page.getByText("Ice machine refill")).toBeVisible();
  });

  test("shows pending and done counts", async ({ page }) => {
    await mockAuth(page);
    await page.route("**/api/admin/checklist**", (route) =>
      route.fulfill({ json: MOCK_CHECKLIST })
    );

    await page.goto("/admin/checklist");

    // 2 pending, 1 done
    await expect(page.getByText(/2 pending/i).first()).toBeVisible();
    await expect(page.getByText(/1 done/i).first()).toBeVisible();
  });

  test("groups tasks by category", async ({ page }) => {
    await mockAuth(page);
    await page.route("**/api/admin/checklist**", (route) =>
      route.fulfill({ json: MOCK_CHECKLIST })
    );

    await page.goto("/admin/checklist");

    // Category labels from CATEGORY_LABELS
    await expect(page.getByText("Bar Setup")).toBeVisible();
    await expect(page.getByText("Catering")).toBeVisible();
  });

  test("shows empty state when no tasks", async ({ page }) => {
    await mockAuth(page);
    await page.route("**/api/admin/checklist**", (route) =>
      route.fulfill({ json: [] })
    );

    await page.goto("/admin/checklist");

    await expect(
      page.getByText(/no preparation tasks for today/i)
    ).toBeVisible();
  });
});

// ─── Corporate ──────────────────────────────────────────────────────────────────

test.describe("Admin — Corporate", () => {
  test.use({ storageState: ".playwright/.auth/user.json" });

  const MOCK_CORPORATE = [
    {
      id: "corp-uuid-1",
      company_name: "Acme Corp",
      billing_contact_name: "John CFO",
      billing_contact_email: "john@acme.com",
      package_type: "enterprise",
      max_seats: 50,
      active_seats: 35,
      annual_fee: 250000,
      renewal_date: "2027-01-01",
      status: "active",
      created_at: "2025-01-15T00:00:00",
    },
    {
      id: "corp-uuid-2",
      company_name: "Startup Inc",
      billing_contact_name: "Jane Founder",
      billing_contact_email: "jane@startup.io",
      package_type: "starter",
      max_seats: 5,
      active_seats: 3,
      annual_fee: 50000,
      renewal_date: "2027-06-01",
      status: "active",
      created_at: "2025-06-01T00:00:00",
    },
  ];

  test("shows Corporate Accounts heading", async ({ page }) => {
    await mockAuth(page);
    await page.route("**/api/admin/corporate**", (route) =>
      route.fulfill({ json: MOCK_CORPORATE })
    );

    await page.goto("/admin/corporate");

    await expect(
      page.getByRole("heading", { name: "Corporate Accounts" })
    ).toBeVisible();
  });

  test("displays company names", async ({ page }) => {
    await mockAuth(page);
    await page.route("**/api/admin/corporate**", (route) =>
      route.fulfill({ json: MOCK_CORPORATE })
    );

    await page.goto("/admin/corporate");

    await expect(page.getByText("Acme Corp")).toBeVisible();
    await expect(page.getByText("Startup Inc")).toBeVisible();
  });

  test("shows package type badges", async ({ page }) => {
    await mockAuth(page);
    await page.route("**/api/admin/corporate**", (route) =>
      route.fulfill({ json: MOCK_CORPORATE })
    );

    await page.goto("/admin/corporate");

    await expect(page.getByText("enterprise")).toBeVisible();
    await expect(page.getByText("starter")).toBeVisible();
  });

  test("shows seat utilization", async ({ page }) => {
    await mockAuth(page);
    await page.route("**/api/admin/corporate**", (route) =>
      route.fulfill({ json: MOCK_CORPORATE })
    );

    await page.goto("/admin/corporate");

    await expect(page.getByText("35/50")).toBeVisible();
    await expect(page.getByText("3/5")).toBeVisible();
  });

  test("shows New Account button", async ({ page }) => {
    await mockAuth(page);
    await page.route("**/api/admin/corporate**", (route) =>
      route.fulfill({ json: MOCK_CORPORATE })
    );

    await page.goto("/admin/corporate");

    await expect(
      page.getByRole("button", { name: /new account/i })
    ).toBeVisible();
  });

  test("shows empty state when no accounts", async ({ page }) => {
    await mockAuth(page);
    await page.route("**/api/admin/corporate**", (route) =>
      route.fulfill({ json: [] })
    );

    await page.goto("/admin/corporate");

    await expect(page.getByText(/no corporate accounts/i)).toBeVisible();
  });
});

// ─── Member Detail ──────────────────────────────────────────────────────────────

test.describe("Admin — Member Detail", () => {
  test.use({ storageState: ".playwright/.auth/user.json" });

  const MOCK_MEMBER_DETAIL = {
    id: "member-uuid-detail",
    full_name: "Jane Detailed",
    email: "jane@detail.com",
    phone: "+66 123 456 789",
    company_name: "Detail Corp",
    tier: "gold",
    user_type: "member",
    is_active: true,
    role: "user",
    is_promoter: false,
    connections_count: 12,
    tab_total: 15000,
    service_requests_count: 3,
    staff_notes: "VIP treatment always",
    industry: "Technology",
    revenue_range: "$1M-$5M",
    interests: ["Networking", "Startups"],
    segment_groups: ["Tech & Founders"],
    nfc_cards: [{ card_id: "NFC-JANE-001", status: "active" }],
    promoter_codes: [],
    promoter_stats: null,
    recent_taps: [
      {
        id: "tap-1",
        tap_type: "venue_entry",
        location: "Main Gate",
        tapped_at: "2026-03-20T19:00:00",
      },
      {
        id: "tap-2",
        tap_type: "payment_tap",
        location: "Bar",
        tapped_at: "2026-03-20T19:30:00",
      },
    ],
  };

  test("shows member name as heading", async ({ page }) => {
    await mockAuth(page);
    await page.route("**/api/admin/members/member-uuid-detail**", (route) =>
      route.fulfill({ json: MOCK_MEMBER_DETAIL })
    );

    await page.goto("/admin/members/member-uuid-detail");

    await expect(
      page.getByRole("heading", { name: "Jane Detailed" })
    ).toBeVisible();
  });

  test("displays member stats cards", async ({ page }) => {
    await mockAuth(page);
    await page.route("**/api/admin/members/member-uuid-detail**", (route) =>
      route.fulfill({ json: MOCK_MEMBER_DETAIL })
    );

    await page.goto("/admin/members/member-uuid-detail");

    // Connections count
    await expect(page.getByText("12", { exact: true }).first()).toBeVisible();
    // Service requests count — "3" matches multiple elements, use exact + first
    await expect(page.getByText("3", { exact: true }).first()).toBeVisible();
  });

  test("shows recent tap activity", async ({ page }) => {
    await mockAuth(page);
    await page.route("**/api/admin/members/member-uuid-detail**", (route) =>
      route.fulfill({ json: MOCK_MEMBER_DETAIL })
    );

    await page.goto("/admin/members/member-uuid-detail");

    await expect(page.getByText("Recent Activity")).toBeVisible();
    await expect(page.getByText("venue entry").first()).toBeVisible();
    await expect(page.getByText("payment tap")).toBeVisible();
  });

  test("shows Staff Notes section", async ({ page }) => {
    await mockAuth(page);
    await page.route("**/api/admin/members/member-uuid-detail**", (route) =>
      route.fulfill({ json: MOCK_MEMBER_DETAIL })
    );

    await page.goto("/admin/members/member-uuid-detail");

    await expect(page.getByText("Staff Notes")).toBeVisible();
    await expect(
      page.getByRole("button", { name: /save notes/i })
    ).toBeVisible();
  });

  test("shows Edit Profile button", async ({ page }) => {
    await mockAuth(page);
    await page.route("**/api/admin/members/member-uuid-detail**", (route) =>
      route.fulfill({ json: MOCK_MEMBER_DETAIL })
    );

    await page.goto("/admin/members/member-uuid-detail");

    await expect(
      page.getByRole("button", { name: /edit profile/i })
    ).toBeVisible();
  });

  test("shows tier and status badges", async ({ page }) => {
    await mockAuth(page);
    await page.route("**/api/admin/members/member-uuid-detail**", (route) =>
      route.fulfill({ json: MOCK_MEMBER_DETAIL })
    );

    await page.goto("/admin/members/member-uuid-detail");

    await expect(page.getByText("gold")).toBeVisible();
    await expect(page.getByText("Active", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("member", { exact: true })).toBeVisible();
  });

  test("shows profile info section", async ({ page }) => {
    await mockAuth(page);
    await page.route("**/api/admin/members/member-uuid-detail**", (route) =>
      route.fulfill({ json: MOCK_MEMBER_DETAIL })
    );

    await page.goto("/admin/members/member-uuid-detail");

    await expect(page.getByText("Technology")).toBeVisible();
    await expect(page.getByText("$1M-$5M")).toBeVisible();
  });

  test("shows not found when member does not exist", async ({ page }) => {
    await mockAuth(page);
    await page.route("**/api/admin/members/nonexistent**", (route) =>
      route.fulfill({ status: 404, json: { detail: "Not found" } })
    );

    await page.goto("/admin/members/nonexistent");

    await expect(page.getByText(/member not found/i)).toBeVisible();
  });

  test("shows Make Staff button for non-admin member", async ({ page }) => {
    await mockAuth(page);
    await page.route("**/api/admin/members/member-uuid-detail**", (route) =>
      route.fulfill({ json: MOCK_MEMBER_DETAIL })
    );

    await page.goto("/admin/members/member-uuid-detail");

    await expect(
      page.getByRole("button", { name: /make staff/i })
    ).toBeVisible();
  });
});

// ─── Member Detail — Promoter View ──────────────────────────────────────────────

test.describe("Admin — Member Detail (Promoter)", () => {
  test.use({ storageState: ".playwright/.auth/user.json" });

  const MOCK_PROMOTER_MEMBER = {
    id: "promo-member-uuid",
    full_name: "PromoGuy Pete",
    email: "pete@promo.com",
    phone: null,
    company_name: "Promo LLC",
    tier: "silver",
    user_type: "promoter",
    is_active: true,
    role: "user",
    is_promoter: true,
    connections_count: 5,
    tab_total: 3000,
    service_requests_count: 1,
    staff_notes: "",
    industry: null,
    revenue_range: null,
    interests: [],
    segment_groups: [],
    nfc_cards: [],
    promoter_codes: [
      {
        id: "code-uuid-1",
        code: "PETE2026",
        uses_count: 22,
        reg_commission: 200,
        checkin_commission_flat: 50,
        checkin_commission_pct: null,
      },
    ],
    promoter_stats: {
      total_codes: 1,
      total_uses: 22,
      total_revenue: 12000,
      commission_earned: 4400,
      pending_payout: 800,
    },
    recent_taps: [],
  };

  test("shows promoter QR code section", async ({ page }) => {
    await mockAuth(page);
    await page.route("**/api/admin/members/promo-member-uuid**", (route) =>
      route.fulfill({ json: MOCK_PROMOTER_MEMBER })
    );

    await page.goto("/admin/members/promo-member-uuid");

    await expect(page.getByText("Promoter QR Code")).toBeVisible();
    await expect(page.getByText("PETE2026", { exact: true }).first()).toBeVisible();
  });

  test("shows promoter stats cards", async ({ page }) => {
    await mockAuth(page);
    await page.route("**/api/admin/members/promo-member-uuid**", (route) =>
      route.fulfill({ json: MOCK_PROMOTER_MEMBER })
    );

    await page.goto("/admin/members/promo-member-uuid");

    await expect(page.getByText("Total Codes")).toBeVisible();
    await expect(page.getByText("Conversions")).toBeVisible();
    await expect(page.getByText("Revenue Attributed")).toBeVisible();
    await expect(page.getByText("Commission Earned")).toBeVisible();
    await expect(page.getByText("Pending Payout")).toBeVisible();
  });

  test("shows promoter code usage count", async ({ page }) => {
    await mockAuth(page);
    await page.route("**/api/admin/members/promo-member-uuid**", (route) =>
      route.fulfill({ json: MOCK_PROMOTER_MEMBER })
    );

    await page.goto("/admin/members/promo-member-uuid");

    await expect(page.getByText(/22 uses/i)).toBeVisible();
  });

  test("shows no tap history message for empty taps", async ({ page }) => {
    await mockAuth(page);
    await page.route("**/api/admin/members/promo-member-uuid**", (route) =>
      route.fulfill({ json: MOCK_PROMOTER_MEMBER })
    );

    await page.goto("/admin/members/promo-member-uuid");

    await expect(page.getByText(/no tap history/i)).toBeVisible();
  });
});

// ─── QR Generator ───────────────────────────────────────────────────────────────

test.describe("Admin — QR Generator", () => {
  test.use({ storageState: ".playwright/.auth/user.json" });

  const MOCK_BATCHES = [
    {
      id: "batch-uuid-1",
      promoter_id: null,
      promo_code: "SUMMER2026",
      tier: "gold",
      count: 50,
      prefix: "RD-SUM-",
      notes: "Summer campaign batch",
      created_at: "2026-03-15T10:00:00",
      conversion_rate: 0.24,
      converted_count: 12,
    },
    {
      id: "batch-uuid-2",
      promoter_id: "promo-uuid-1",
      promo_code: null,
      tier: "silver",
      count: 100,
      prefix: "RD-",
      notes: null,
      created_at: "2026-03-10T14:00:00",
      conversion_rate: 0.08,
      converted_count: 8,
    },
  ];

  test("shows QR Generator heading", async ({ page }) => {
    await mockAuth(page);
    await page.route("**/api/admin/qr-batches**", (route) =>
      route.fulfill({ json: MOCK_BATCHES })
    );
    await page.route("**/api/admin/promoters**", (route) =>
      route.fulfill({ json: [] })
    );

    await page.goto("/admin/qr-generator");

    await expect(
      page.getByRole("heading", { name: "QR Generator" })
    ).toBeVisible();
  });

  test("displays batch details", async ({ page }) => {
    await mockAuth(page);
    await page.route("**/api/admin/qr-batches**", (route) =>
      route.fulfill({ json: MOCK_BATCHES })
    );
    await page.route("**/api/admin/promoters**", (route) =>
      route.fulfill({ json: [] })
    );

    await page.goto("/admin/qr-generator");

    // Prefix and count format: "RD-SUM-... x 50"
    await expect(page.getByText(/RD-SUM-/)).toBeVisible();
    await expect(page.getByText("SUMMER2026")).toBeVisible();
  });

  test("shows batch count in subtitle", async ({ page }) => {
    await mockAuth(page);
    await page.route("**/api/admin/qr-batches**", (route) =>
      route.fulfill({ json: MOCK_BATCHES })
    );
    await page.route("**/api/admin/promoters**", (route) =>
      route.fulfill({ json: [] })
    );

    await page.goto("/admin/qr-generator");

    await expect(page.getByText(/2 batches/i)).toBeVisible();
  });

  test("shows conversion stats", async ({ page }) => {
    await mockAuth(page);
    await page.route("**/api/admin/qr-batches**", (route) =>
      route.fulfill({ json: MOCK_BATCHES })
    );
    await page.route("**/api/admin/promoters**", (route) =>
      route.fulfill({ json: [] })
    );

    await page.goto("/admin/qr-generator");

    // "12/50 conversions"
    await expect(page.getByText("12/50")).toBeVisible();
    // "24%" conversion rate
    await expect(page.getByText("24%")).toBeVisible();
  });

  test("shows New Batch button", async ({ page }) => {
    await mockAuth(page);
    await page.route("**/api/admin/qr-batches**", (route) =>
      route.fulfill({ json: MOCK_BATCHES })
    );
    await page.route("**/api/admin/promoters**", (route) =>
      route.fulfill({ json: [] })
    );

    await page.goto("/admin/qr-generator");

    await expect(
      page.getByRole("button", { name: /new batch/i })
    ).toBeVisible();
  });

  test("shows batch action buttons", async ({ page }) => {
    await mockAuth(page);
    await page.route("**/api/admin/qr-batches**", (route) =>
      route.fulfill({ json: MOCK_BATCHES })
    );
    await page.route("**/api/admin/promoters**", (route) =>
      route.fulfill({ json: [] })
    );

    await page.goto("/admin/qr-generator");

    // Each batch has Preview, PDF, PNG, Add, Remove, Delete buttons
    await expect(page.getByRole("button", { name: /preview/i }).first()).toBeVisible();
    await expect(page.getByRole("button", { name: /pdf/i }).first()).toBeVisible();
  });

  test("shows empty state when no batches", async ({ page }) => {
    await mockAuth(page);
    await page.route("**/api/admin/qr-batches**", (route) =>
      route.fulfill({ json: [] })
    );
    await page.route("**/api/admin/promoters**", (route) =>
      route.fulfill({ json: [] })
    );

    await page.goto("/admin/qr-generator");

    await expect(page.getByText(/no batches generated yet/i)).toBeVisible();
  });

  test("shows create form when New Batch is clicked", async ({ page }) => {
    await mockAuth(page);
    await page.route("**/api/admin/qr-batches**", (route) =>
      route.fulfill({ json: [] })
    );
    await page.route("**/api/admin/promoters**", (route) =>
      route.fulfill({ json: [] })
    );

    await page.goto("/admin/qr-generator");

    await page.getByRole("button", { name: /new batch/i }).click();

    await expect(page.getByText(/generate batch/i)).toBeVisible();
  });
});
