import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import AdminStaffPage from "./page";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => "/admin/staff",
  useParams: () => ({}),
  useSearchParams: () => ({ get: () => null }),
}));

const mockGet = vi.hoisted(() => vi.fn());
vi.mock("@/lib/api-client", () => ({
  apiClient: { get: mockGet },
  ApiError: class ApiError extends Error { name = "ApiError"; },
}));

const makeStaffData = (overrides = {}) => ({
  summary: {
    total_staff: 2,
    month_checkins: 45,
    month_revenue: 22500,
    top_performer: "John Staff",
  },
  staff: [
    {
      rank: 1,
      staff_id: "staff-uuid-1",
      full_name: "John Staff",
      today_checkins: 5,
      month_checkins: 30,
      month_revenue: 15000,
      total_checkins: 120,
      total_revenue: 60000,
      events_worked: 15,
      avg_per_event: 8.0,
    },
    {
      rank: 2,
      staff_id: "staff-uuid-2",
      full_name: "Jane Staff",
      today_checkins: 3,
      month_checkins: 15,
      month_revenue: 7500,
      total_checkins: 80,
      total_revenue: 40000,
      events_worked: 10,
      avg_per_event: 8.0,
    },
  ],
  ...overrides,
});

describe("AdminStaffPage", () => {
  beforeEach(() => {
    mockGet.mockReset();
  });

  it("shows loading spinner initially", () => {
    mockGet.mockReturnValue(new Promise(() => {}));
    render(<AdminStaffPage />);
    expect(document.querySelector(".animate-spin")).toBeInTheDocument();
  });

  it("renders KPI cards with summary data", async () => {
    mockGet.mockResolvedValue(makeStaffData());
    render(<AdminStaffPage />);
    await waitFor(() => {
      expect(screen.getByText("45")).toBeInTheDocument();
    });
    // "John Staff" appears in both KPI card (top performer) and table row
    expect(screen.getAllByText("John Staff")).toHaveLength(2);
  });

  it("renders staff leaderboard table with rows", async () => {
    mockGet.mockResolvedValue(makeStaffData());
    render(<AdminStaffPage />);
    await waitFor(() => {
      expect(screen.getByText("Jane Staff")).toBeInTheDocument();
    });
    // Check month checkins column values
    expect(screen.getByText("30")).toBeInTheDocument();
    // "15" appears as both month_checkins for Jane and events_worked for John
    expect(screen.getAllByText("15").length).toBeGreaterThanOrEqual(1);
  });

  it("shows empty state when no staff data", async () => {
    mockGet.mockResolvedValue(makeStaffData({
      summary: { total_staff: 0, month_checkins: 0, month_revenue: 0, top_performer: null },
      staff: [],
    }));
    render(<AdminStaffPage />);
    await waitFor(() => {
      expect(screen.getByText(/no staff checkin data/i)).toBeInTheDocument();
    });
  });

  it("shows error state when API fails", async () => {
    mockGet.mockRejectedValue(new Error("Network error"));
    render(<AdminStaffPage />);
    await waitFor(() => {
      expect(screen.getByText(/no staff checkin data/i)).toBeInTheDocument();
    });
  });
});
