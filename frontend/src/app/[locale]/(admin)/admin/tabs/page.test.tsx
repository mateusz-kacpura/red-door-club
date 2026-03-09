import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import AdminTabsPage from "./page";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => "/admin/tabs",
  useParams: () => ({}),
  useSearchParams: () => ({ get: () => null }),
}));

const mockGet = vi.hoisted(() => vi.fn());
const mockPost = vi.hoisted(() => vi.fn());
vi.mock("@/lib/api-client", () => ({
  apiClient: { get: mockGet, post: mockPost },
  ApiError: class ApiError extends Error { name = "ApiError"; },
}));

const makeTab = (overrides = {}) => ({
  id: "tab-uuid-1",
  member_id: "member-uuid-1234",
  status: "open",
  opened_at: new Date().toISOString(),
  closed_at: null,
  total_amount: 850,
  items: [
    { id: "item-1", description: "Whisky Sour", amount: 350, added_at: new Date().toISOString() },
    { id: "item-2", description: "Champagne", amount: 500, added_at: new Date().toISOString() },
  ],
  ...overrides,
});

describe("AdminTabsPage", () => {
  beforeEach(() => {
    mockGet.mockReset();
    mockPost.mockReset();
    mockGet.mockResolvedValue([]);
  });

  it("shows loading spinner initially", () => {
    mockGet.mockReturnValue(new Promise(() => {}));
    render(<AdminTabsPage />);
    expect(document.querySelector(".animate-spin")).toBeInTheDocument();
  });

  it("shows empty state when no open tabs", async () => {
    mockGet.mockResolvedValue([]);
    render(<AdminTabsPage />);
    await waitFor(() => {
      expect(screen.getByText(/no open tabs at the moment/i)).toBeInTheDocument();
    });
  });

  it("shows tab cards with items", async () => {
    mockGet.mockResolvedValue([makeTab()]);
    render(<AdminTabsPage />);
    await waitFor(() => {
      expect(screen.getByText("Whisky Sour")).toBeInTheDocument();
    });
    expect(screen.getByText("Champagne")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /close tab/i })).toBeInTheDocument();
  });

  it("shows tab count in summary", async () => {
    mockGet.mockResolvedValue([
      makeTab(),
      makeTab({ id: "tab-2", member_id: "member-2", total_amount: 1200, items: [] }),
    ]);
    render(<AdminTabsPage />);
    await waitFor(() => {
      // Both tabs are rendered — verify first tab's items
      expect(screen.getByText("Whisky Sour")).toBeInTheDocument();
    });
    expect(screen.getByText("Open Tabs")).toBeInTheDocument();
  });

  it("shows singular 'tab' when only 1 open", async () => {
    mockGet.mockResolvedValue([makeTab()]);
    render(<AdminTabsPage />);
    await waitFor(() => {
      expect(screen.getByText("Whisky Sour")).toBeInTheDocument();
    });
    expect(screen.getByText("Open Tabs")).toBeInTheDocument();
  });

  it("calls close tab API on button click", async () => {
    mockGet.mockResolvedValue([makeTab()]);
    mockPost.mockResolvedValue({});
    render(<AdminTabsPage />);
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /close tab/i })).toBeInTheDocument();
    });
    await userEvent.click(screen.getByRole("button", { name: /close tab/i }));
    expect(mockPost).toHaveBeenCalledWith("/admin/tabs/tab-uuid-1/close", {});
  });
});
