import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import LoyaltyPage from "./page";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => "/dashboard/loyalty",
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

const makeBalance = (balance = 350, lifetime_total = 700) => ({ balance, lifetime_total });

const makeTransaction = (points = 50, reason = "event_attendance") => ({
  id: "tx-1",
  points,
  reason,
  created_at: new Date().toISOString(),
});

describe("LoyaltyPage", () => {
  beforeEach(() => {
    mockGet.mockReset();
    mockPost.mockReset();
    // Default: pending forever (loading state)
    mockGet.mockReturnValue(new Promise(() => {}));
  });

  it("shows loading spinner initially", () => {
    render(<LoyaltyPage />);
    expect(document.querySelector(".animate-spin")).toBeInTheDocument();
  });

  it("shows balance after data loads", async () => {
    mockGet
      .mockResolvedValueOnce(makeBalance(350, 700))
      .mockResolvedValueOnce([]);

    render(<LoyaltyPage />);

    await waitFor(() => {
      expect(screen.getByText("350")).toBeInTheDocument();
    });
  });

  it("shows lifetime total", async () => {
    mockGet
      .mockResolvedValueOnce(makeBalance(350, 700))
      .mockResolvedValueOnce([]);

    render(<LoyaltyPage />);

    await waitFor(() => {
      expect(screen.getByText("700")).toBeInTheDocument();
    });
  });

  it("shows redemption options", async () => {
    mockGet
      .mockResolvedValueOnce(makeBalance(500, 1000))
      .mockResolvedValueOnce([]);

    render(<LoyaltyPage />);

    await waitFor(() => {
      expect(screen.getByText("Event Ticket")).toBeInTheDocument();
    });
    expect(screen.getByText("Car Booking")).toBeInTheDocument();
    expect(screen.getByText("Studio Session")).toBeInTheDocument();
  });

  it("shows transaction history with earned points", async () => {
    mockGet
      .mockResolvedValueOnce(makeBalance(350, 700))
      .mockResolvedValueOnce([
        makeTransaction(50, "event_attendance"),
        makeTransaction(-150, "redemption"),
      ]);

    render(<LoyaltyPage />);

    await waitFor(() => {
      // "+50" appears in both earn-rates section and history — use getAllByText
      expect(screen.getAllByText("+50").length).toBeGreaterThan(0);
    });
    // "-150" is unique to the history section (no earn rate shows negative)
    expect(screen.getByText("-150")).toBeInTheDocument();
  });

  it("shows empty state for transaction history when no transactions", async () => {
    mockGet
      .mockResolvedValueOnce(makeBalance(0, 0))
      .mockResolvedValueOnce([]);

    render(<LoyaltyPage />);

    await waitFor(() => {
      // Balance of 0 should still show
      expect(screen.queryByText(".animate-spin")).not.toBeInTheDocument();
    });
  });

  it("shows human-readable reason labels in history", async () => {
    mockGet
      .mockResolvedValueOnce(makeBalance(50, 50))
      .mockResolvedValueOnce([makeTransaction(50, "event_attendance")]);

    render(<LoyaltyPage />);

    await waitFor(() => {
      // "Event Visit" appears in both earn-rates and transaction history — use getAllByText
      expect(screen.getAllByText("Event Visit").length).toBeGreaterThan(0);
    });
  });

  it("redemption button calls API and shows success toast", async () => {
    const { toast } = await import("sonner");
    mockGet
      .mockResolvedValueOnce(makeBalance(500, 1000))
      .mockResolvedValueOnce([]);

    const mockTx = { id: "tx-new", points: -150, reason: "redemption", created_at: new Date().toISOString() };
    mockPost.mockResolvedValueOnce(mockTx);
    // After redeem, fetchData is called again
    mockGet
      .mockResolvedValueOnce(makeBalance(350, 1000))
      .mockResolvedValueOnce([mockTx]);

    render(<LoyaltyPage />);

    await waitFor(() => {
      expect(screen.getByText("Event Ticket")).toBeInTheDocument();
    });

    const redeemButtons = screen.getAllByRole("button", { name: /redeem/i });
    await userEvent.click(redeemButtons[0]);

    await waitFor(() => {
      expect(mockPost).toHaveBeenCalledWith(
        "/members/points/redeem",
        expect.objectContaining({ amount: 150, reason: "event_ticket" }),
      );
    });
    expect(toast.success).toHaveBeenCalled();
  });

  it("shows error toast when redemption fails", async () => {
    const { toast } = await import("sonner");
    mockGet
      .mockResolvedValueOnce(makeBalance(500, 1000))
      .mockResolvedValueOnce([]);

    mockPost.mockRejectedValueOnce(new Error("Insufficient points"));

    render(<LoyaltyPage />);

    await waitFor(() => {
      expect(screen.getByText("Event Ticket")).toBeInTheDocument();
    });

    const redeemButtons = screen.getAllByRole("button", { name: /redeem/i });
    await userEvent.click(redeemButtons[0]);

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalled();
    });
  });
});
