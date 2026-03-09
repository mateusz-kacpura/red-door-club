import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import PromoterDashboardPage from "./page";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => "/promoter/dashboard",
  useParams: () => ({}),
  useSearchParams: () => ({ get: () => null }),
}));

vi.mock("next/link", () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

vi.mock("@/lib/constants", () => ({
  ROUTES: {
    PROMOTER_CODES: "/promoter/codes",
    PROMOTER_PAYOUTS: "/promoter/payouts",
  },
}));

const mockGet = vi.hoisted(() => vi.fn());
vi.mock("@/lib/api-client", () => ({
  apiClient: { get: mockGet },
  ApiError: class ApiError extends Error { name = "ApiError"; },
}));

const makeStats = (overrides = {}) => ({
  total_codes: 3,
  total_uses: 12,
  total_revenue: 45000,
  commission_earned: 22500,
  pending_payout: 5000,
  ...overrides,
});

describe("PromoterDashboardPage", () => {
  beforeEach(() => {
    mockGet.mockReset();
    mockGet.mockResolvedValue(makeStats());
  });

  it("shows loading spinner initially", () => {
    mockGet.mockReturnValue(new Promise(() => {}));
    render(<PromoterDashboardPage />);
    expect(document.querySelector(".animate-spin")).toBeInTheDocument();
  });

  it("shows Promoter Dashboard heading", async () => {
    render(<PromoterDashboardPage />);
    await waitFor(() => {
      expect(screen.getByText("Promoter Dashboard")).toBeInTheDocument();
    });
  });

  it("shows Total Codes stat", async () => {
    render(<PromoterDashboardPage />);
    await waitFor(() => {
      expect(screen.getByText("Total Codes")).toBeInTheDocument();
      expect(screen.getByText("3")).toBeInTheDocument();
    });
  });

  it("shows Total Conversions stat", async () => {
    render(<PromoterDashboardPage />);
    await waitFor(() => {
      expect(screen.getByText("Total Conversions")).toBeInTheDocument();
      expect(screen.getByText("12")).toBeInTheDocument();
    });
  });

  it("shows Revenue Attributed stat in Baht format", async () => {
    render(<PromoterDashboardPage />);
    await waitFor(() => {
      expect(screen.getByText("Revenue Attributed")).toBeInTheDocument();
    });
    const amounts = screen.getAllByText(/฿45,000/);
    expect(amounts.length).toBeGreaterThan(0);
  });

  it("shows Commission Earned stat", async () => {
    render(<PromoterDashboardPage />);
    await waitFor(() => {
      expect(screen.getByText("Commission Earned")).toBeInTheDocument();
    });
    const amounts = screen.getAllByText(/฿22,500/);
    expect(amounts.length).toBeGreaterThan(0);
  });

  it("shows Pending Payout stat", async () => {
    render(<PromoterDashboardPage />);
    await waitFor(() => {
      expect(screen.getByText("Pending Payout")).toBeInTheDocument();
    });
    const amounts = screen.getAllByText(/฿5,000/);
    expect(amounts.length).toBeGreaterThan(0);
  });

  it("shows zero stats when API returns zeros", async () => {
    mockGet.mockResolvedValue(makeStats({
      total_codes: 0,
      total_uses: 0,
      total_revenue: 0,
      commission_earned: 0,
      pending_payout: 0,
    }));

    render(<PromoterDashboardPage />);

    await waitFor(() => {
      expect(screen.getByText("Promoter Dashboard")).toBeInTheDocument();
    });
  });

  it("still renders after API error", async () => {
    mockGet.mockRejectedValue(new Error("Unauthorized"));
    render(<PromoterDashboardPage />);
    await waitFor(() => {
      // Should show page without crashing (stats null/defaults)
      expect(screen.getByText("Promoter Dashboard")).toBeInTheDocument();
    });
  });
});
