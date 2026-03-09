import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import AdminActivityPage from "./page";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => "/admin/activity",
  useParams: () => ({}),
  useSearchParams: () => ({ get: () => null }),
}));

const mockGet = vi.hoisted(() => vi.fn());
vi.mock("@/lib/api-client", () => ({
  apiClient: { get: mockGet },
  ApiError: class ApiError extends Error { name = "ApiError"; },
}));

const makeTapEvent = (overrides = {}) => ({
  id: "tap-uuid-1",
  member_id: "member-uuid-1",
  member_name: "Alice Chen",
  card_id: "CARD-ABC",
  tap_type: "venue_entry",
  reader_id: "READER-01",
  location: "Main entrance",
  tapped_at: new Date().toISOString(),
  metadata: null,
  ...overrides,
});

describe("AdminActivityPage", () => {
  beforeEach(() => {
    mockGet.mockReset();
    mockGet.mockResolvedValue([]);
  });

  it("shows loading spinner initially", () => {
    mockGet.mockReturnValue(new Promise(() => {}));
    render(<AdminActivityPage />);
    expect(document.querySelector(".animate-spin")).toBeInTheDocument();
  });

  it("shows empty state when no events", async () => {
    mockGet.mockResolvedValue([]);
    render(<AdminActivityPage />);
    await waitFor(() => {
      expect(screen.getByText(/no activity recorded yet/i)).toBeInTheDocument();
    });
  });

  it("renders tap event rows with member name and tap type", async () => {
    mockGet.mockResolvedValue([makeTapEvent()]);
    render(<AdminActivityPage />);
    await waitFor(() => {
      expect(screen.getByText("Alice Chen")).toBeInTheDocument();
    });
    // "venue entry" appears in both the filter button and the table row badge
    expect(screen.getAllByText("venue entry")).toHaveLength(2);
  });

  it("shows dash when member_name is null", async () => {
    mockGet.mockResolvedValue([makeTapEvent({ member_name: null })]);
    render(<AdminActivityPage />);
    await waitFor(() => {
      expect(screen.getByText("venue entry")).toBeInTheDocument();
    });
    expect(screen.getByText("—")).toBeInTheDocument();
  });

  it("renders all type filter buttons", async () => {
    mockGet.mockResolvedValue([]);
    render(<AdminActivityPage />);
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /^all$/i })).toBeInTheDocument();
    });
    expect(screen.getByRole("button", { name: /venue entry/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /payment tap/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /connection tap/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /locker access/i })).toBeInTheDocument();
  });

  it("calls API with tap_type param when filter clicked", async () => {
    mockGet.mockResolvedValue([]);
    render(<AdminActivityPage />);
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /payment tap/i })).toBeInTheDocument();
    });
    await userEvent.click(screen.getByRole("button", { name: /payment tap/i }));
    await waitFor(() => {
      expect(mockGet).toHaveBeenLastCalledWith(
        expect.stringContaining("tap_type=payment_tap")
      );
    });
  });

  it("Previous button is disabled on first page", async () => {
    mockGet.mockResolvedValue([]);
    render(<AdminActivityPage />);
    await waitFor(() => {
      expect(screen.getByText(/no activity recorded yet/i)).toBeInTheDocument();
    });
    expect(screen.getByRole("button", { name: /previous/i })).toBeDisabled();
  });

  it("Next button is disabled when fewer than PAGE_SIZE results", async () => {
    mockGet.mockResolvedValue([makeTapEvent()]);
    render(<AdminActivityPage />);
    await waitFor(() => {
      expect(screen.getByText("Alice Chen")).toBeInTheDocument();
    });
    expect(screen.getByRole("button", { name: /next/i })).toBeDisabled();
  });
});
