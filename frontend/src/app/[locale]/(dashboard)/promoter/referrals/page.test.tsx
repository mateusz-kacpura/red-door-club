import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import PromoterReferralsPage from "./page";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => "/promoter/referrals",
  useParams: () => ({}),
  useSearchParams: () => ({ get: () => null }),
}));

const mockGet = vi.hoisted(() => vi.fn());
vi.mock("@/lib/api-client", () => ({
  apiClient: { get: mockGet },
  ApiError: class ApiError extends Error { name = "ApiError"; },
}));

describe("PromoterReferralsPage", () => {
  beforeEach(() => {
    mockGet.mockReset();
  });

  it("shows loading spinner initially", () => {
    mockGet.mockReturnValue(new Promise(() => {}));
    render(<PromoterReferralsPage />);
    expect(document.querySelector(".animate-spin")).toBeInTheDocument();
  });

  it("shows empty state when no referrals", async () => {
    mockGet.mockResolvedValue([]);
    render(<PromoterReferralsPage />);
    await waitFor(() => {
      expect(screen.getByText("No referrals yet")).toBeInTheDocument();
    });
  });

  it("shows referral list with user name and code", async () => {
    mockGet.mockResolvedValue([
      { user_full_name: "Jane Doe", promo_code: "VIP2026", registered_at: "2026-03-15T10:00:00Z" },
      { user_full_name: "John Smith", promo_code: "VIP2026", registered_at: "2026-03-14T08:00:00Z" },
    ]);
    render(<PromoterReferralsPage />);
    await waitFor(() => {
      expect(screen.getByText("Jane Doe")).toBeInTheDocument();
    });
    expect(screen.getByText("John Smith")).toBeInTheDocument();
    const codes = screen.getAllByText("VIP2026");
    expect(codes.length).toBe(2);
  });

  it("shows anonymous for user without name", async () => {
    mockGet.mockResolvedValue([
      { user_full_name: null, promo_code: "VIP2026", registered_at: "2026-03-15T10:00:00Z" },
    ]);
    render(<PromoterReferralsPage />);
    await waitFor(() => {
      expect(screen.getByText("Anonymous")).toBeInTheDocument();
    });
  });

  it("still renders after API error", async () => {
    mockGet.mockRejectedValue(new Error("Unauthorized"));
    render(<PromoterReferralsPage />);
    await waitFor(() => {
      expect(screen.getByText("Referrals")).toBeInTheDocument();
    });
  });
});
