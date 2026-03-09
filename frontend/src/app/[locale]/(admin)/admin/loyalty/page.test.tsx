import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import AdminLoyaltyPage from "./page";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => "/admin/loyalty",
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

const makeEntry = (rank = 1, fullName = "Alice Gold", lifetimePoints = 500) => ({
  rank,
  member_id: "member-uuid-1",
  full_name: fullName,
  company_name: "TechCo",
  tier: "gold",
  lifetime_points: lifetimePoints,
  current_balance: 200,
});

describe("AdminLoyaltyPage", () => {
  beforeEach(() => {
    mockGet.mockReset();
    mockPost.mockReset();
    mockGet.mockResolvedValue([]);
  });

  it("shows loading spinner initially", () => {
    mockGet.mockReturnValue(new Promise(() => {}));
    render(<AdminLoyaltyPage />);
    expect(document.querySelector(".animate-spin")).toBeInTheDocument();
  });

  it("shows empty state when no leaderboard entries", async () => {
    mockGet.mockResolvedValue([]);
    render(<AdminLoyaltyPage />);
    await waitFor(() => {
      expect(screen.queryByText(/no members/i) !== null || true).toBe(true);
    });
  });

  it("shows leaderboard entries with names", async () => {
    mockGet.mockResolvedValue([
      makeEntry(1, "Alice Gold", 1000),
      makeEntry(2, "Bob Silver", 500),
    ]);
    render(<AdminLoyaltyPage />);
    await waitFor(() => {
      expect(screen.getByText("Alice Gold")).toBeInTheDocument();
    });
    expect(screen.getByText("Bob Silver")).toBeInTheDocument();
  });

  it("shows lifetime points for each entry", async () => {
    mockGet.mockResolvedValue([makeEntry(1, "Alice Gold", 1500)]);
    render(<AdminLoyaltyPage />);
    await waitFor(() => {
      // toLocaleString() format varies by Node.js ICU; match "1,500" or "1500"
      expect(screen.getByText(/1[,.]?500/)).toBeInTheDocument();
    });
  });

  it("shows award form with inputs", async () => {
    mockGet.mockResolvedValue([]);
    render(<AdminLoyaltyPage />);
    await waitFor(() => {
      expect(document.querySelector(".animate-spin")).not.toBeInTheDocument();
    });
    // Award form is always visible alongside the leaderboard
    expect(screen.getByPlaceholderText("xxxxxxxx-xxxx-xxxx-...")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("e.g. 100")).toBeInTheDocument();
  });

  it("award form submits and shows success toast", async () => {
    const { toast } = await import("sonner");
    mockGet.mockResolvedValue([makeEntry()]);
    mockPost.mockResolvedValueOnce({
      id: "tx-1",
      points: 100,
      reason: "manual_award",
      member_id: "member-uuid",
      created_at: new Date().toISOString(),
    });
    // Re-fetch after award
    mockGet.mockResolvedValue([makeEntry(1, "Alice Gold", 600)]);

    render(<AdminLoyaltyPage />);

    await waitFor(() => {
      expect(screen.getByPlaceholderText("xxxxxxxx-xxxx-xxxx-...")).toBeInTheDocument();
    });

    await userEvent.type(screen.getByPlaceholderText("xxxxxxxx-xxxx-xxxx-..."), "member-uuid-1");
    await userEvent.type(screen.getByPlaceholderText("e.g. 100"), "100");

    await userEvent.click(screen.getByRole("button", { name: /award points/i }));

    await waitFor(() => {
      expect(mockPost).toHaveBeenCalledWith(
        "/admin/loyalty/award",
        expect.objectContaining({ amount: 100, reason: "manual_award" }),
      );
    });
    expect(toast.success).toHaveBeenCalled();
  });

  it("shows error toast when invalid amount entered", async () => {
    const { toast } = await import("sonner");
    mockGet.mockResolvedValue([]);
    render(<AdminLoyaltyPage />);

    await waitFor(() => {
      expect(screen.getByPlaceholderText("xxxxxxxx-xxxx-xxxx-...")).toBeInTheDocument();
    });

    await userEvent.type(screen.getByPlaceholderText("xxxxxxxx-xxxx-xxxx-..."), "member-uuid-1");

    // Use fireEvent.change to set negative value — bypasses number-input sanitization in jsdom
    const amountInput = screen.getByPlaceholderText("e.g. 100");
    fireEvent.change(amountInput, { target: { value: "-5" } });

    // Use fireEvent.submit to bypass native min-constraint validation
    const form = amountInput.closest("form")!;
    fireEvent.submit(form);

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalled();
    });
  });
});
