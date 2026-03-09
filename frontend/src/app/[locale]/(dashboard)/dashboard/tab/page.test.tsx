import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import TabPage from "./page";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => "/dashboard/tab",
  useParams: () => ({}),
  useSearchParams: () => ({ get: () => null }),
}));

const mockGet = vi.hoisted(() => vi.fn());
vi.mock("@/lib/api-client", () => ({
  apiClient: { get: mockGet },
  ApiError: class ApiError extends Error { name = "ApiError"; },
}));

describe("TabPage", () => {
  beforeEach(() => {
    mockGet.mockReset();
  });

  it("shows loading spinner initially", () => {
    mockGet.mockReturnValue(new Promise(() => {}));
    render(<TabPage />);
    expect(document.querySelector(".animate-spin")).toBeInTheDocument();
  });

  it("shows empty state when no open tab", async () => {
    mockGet.mockResolvedValue(null);
    render(<TabPage />);
    await waitFor(() => {
      expect(screen.getByText(/no open tab/i)).toBeInTheDocument();
    });
    // Empty state has a specific message about bar/service stations
    expect(screen.getByText(/bar or service point/i)).toBeInTheDocument();
  });

  it("shows tab details with items", async () => {
    mockGet.mockResolvedValue({
      id: "tab-uuid",
      member_id: "member-uuid",
      status: "open",
      opened_at: new Date().toISOString(),
      closed_at: null,
      total_amount: 850,
      items: [
        { id: "item-1", description: "Whisky Sour", amount: 350, added_at: new Date().toISOString() },
        { id: "item-2", description: "Champagne", amount: 500, added_at: new Date().toISOString() },
      ],
    });
    render(<TabPage />);
    await waitFor(() => {
      expect(screen.getByText("Whisky Sour")).toBeInTheDocument();
    });
    expect(screen.getByText("Champagne")).toBeInTheDocument();
    expect(screen.getByText("Open")).toBeInTheDocument();
  });

  it("shows total amount in Baht format", async () => {
    mockGet.mockResolvedValue({
      id: "tab-uuid",
      member_id: "member-uuid",
      status: "open",
      opened_at: new Date().toISOString(),
      closed_at: null,
      total_amount: 1200,
      items: [
        { id: "item-1", description: "Bottle Service", amount: 1200, added_at: new Date().toISOString() },
      ],
    });
    render(<TabPage />);
    await waitFor(() => {
      expect(screen.getByText("Bottle Service")).toBeInTheDocument();
    });
    const amounts = screen.getAllByText(/฿1,200/);
    expect(amounts.length).toBeGreaterThan(0);
  });

  it("shows empty state on API error", async () => {
    mockGet.mockRejectedValue(new Error("Network error"));
    render(<TabPage />);
    await waitFor(() => {
      expect(screen.getByText(/no open tab/i)).toBeInTheDocument();
    });
  });
});
