import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import AdminPromotersPage from "./page";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => "/admin/promoters",
  useParams: () => ({}),
  useSearchParams: () => ({ get: () => null }),
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

const mockGet = vi.hoisted(() => vi.fn());
const mockPost = vi.hoisted(() => vi.fn());
vi.mock("@/lib/api-client", () => ({
  apiClient: { get: mockGet, post: mockPost },
  ApiError: class ApiError extends Error { name = "ApiError"; },
}));

const makePromoter = (overrides = {}) => ({
  promoter_id: "promoter-uuid-1",
  full_name: "Alice Promoter",
  email: "alice@example.com",
  company_name: "ProCo Ltd",
  total_codes: 2,
  total_uses: 8,
  total_revenue: 25000,
  commission_earned: 12500,
  pending_payout: 0,
  ...overrides,
});

describe("AdminPromotersPage", () => {
  beforeEach(() => {
    mockGet.mockReset();
    mockPost.mockReset();
    mockGet.mockResolvedValue([]);
  });

  it("shows loading spinner initially", () => {
    mockGet.mockReturnValue(new Promise(() => {}));
    render(<AdminPromotersPage />);
    expect(document.querySelector(".animate-spin")).toBeInTheDocument();
  });

  it("shows Promoters heading", async () => {
    mockGet.mockResolvedValue([]);
    render(<AdminPromotersPage />);
    await waitFor(() => {
      expect(screen.getByText("Promoters")).toBeInTheDocument();
    });
  });

  it("shows empty state when no promoters", async () => {
    mockGet.mockResolvedValue([]);
    render(<AdminPromotersPage />);
    await waitFor(() => {
      expect(screen.getByText(/no promoters registered/i)).toBeInTheDocument();
    });
  });

  it("shows promoter names with data", async () => {
    mockGet.mockResolvedValue([
      makePromoter({ full_name: "Alice Promoter" }),
      makePromoter({ promoter_id: "promo-2", full_name: "Bob Referrer", email: "bob@example.com" }),
    ]);
    render(<AdminPromotersPage />);
    await waitFor(() => {
      expect(screen.getByText("Alice Promoter")).toBeInTheDocument();
    });
    expect(screen.getByText("Bob Referrer")).toBeInTheDocument();
  });

  it("shows commission earned in Baht format", async () => {
    mockGet.mockResolvedValue([makePromoter({ commission_earned: 12500 })]);
    render(<AdminPromotersPage />);
    await waitFor(() => {
      const amounts = screen.getAllByText(/฿12,500/);
      expect(amounts.length).toBeGreaterThan(0);
    });
  });

  it("shows pending payout badge when payout > 0", async () => {
    mockGet.mockResolvedValue([makePromoter({ pending_payout: 5000 })]);
    render(<AdminPromotersPage />);
    await waitFor(() => {
      expect(screen.getByText(/pending payout/i)).toBeInTheDocument();
    });
  });

  it("does not show payout badge when pending_payout is zero", async () => {
    mockGet.mockResolvedValue([makePromoter({ pending_payout: 0 })]);
    render(<AdminPromotersPage />);
    await waitFor(() => {
      expect(screen.queryByText(/pending payout/i)).not.toBeInTheDocument();
    });
  });
});
