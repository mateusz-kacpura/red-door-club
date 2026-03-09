import { render, screen, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import NetworkingReportPage from "./page";

const mockGet = vi.hoisted(() => vi.fn());

vi.mock("@/lib/api-client", () => ({
  apiClient: { get: mockGet },
  ApiError: class ApiError extends Error {
    name = "ApiError";
  },
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => "/dashboard/networking-report",
  useParams: () => ({}),
  useSearchParams: () => ({ get: () => null }),
}));

const sampleReport = {
  connections_count: 12,
  events_attended: 7,
  total_spent: 45000,
  match_score_count: 3,
  top_segments: ["Tech", "Finance", "Art"],
  suggested_next_steps: [
    "Attend the next networking evening",
    "Connect with 3 suggested members",
  ],
};

describe("NetworkingReportPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows loading state initially", () => {
    // Never resolves during this assertion
    mockGet.mockReturnValue(new Promise(() => {}));

    render(<NetworkingReportPage />);

    // The heading is always visible
    expect(screen.getByText("Networking Report")).toBeDefined();
    // Stat cards must not appear while loading
    expect(screen.queryByText("Connections")).toBeNull();
  });

  it("renders stat cards when data loaded", async () => {
    mockGet.mockResolvedValue(sampleReport);

    render(<NetworkingReportPage />);

    await waitFor(() => {
      expect(screen.getByText("Connections")).toBeDefined();
    });

    expect(screen.getByText("12")).toBeDefined();
    expect(screen.getByText("Events Attended")).toBeDefined();
    expect(screen.getByText("7")).toBeDefined();
    expect(screen.getByText("Total Spent")).toBeDefined();
    // toLocaleString output varies by environment; match by partial text content
    expect(
      screen.getByText((content) => content.includes("฿") && content.includes("45"))
    ).toBeDefined();
    expect(screen.getByText("Match Scores")).toBeDefined();
    expect(screen.getByText("3")).toBeDefined();
  });

  it("renders segment chips", async () => {
    mockGet.mockResolvedValue(sampleReport);

    render(<NetworkingReportPage />);

    await waitFor(() => {
      expect(screen.getByText("Tech")).toBeDefined();
    });

    expect(screen.getByText("Finance")).toBeDefined();
    expect(screen.getByText("Art")).toBeDefined();
  });

  it("renders next steps list", async () => {
    mockGet.mockResolvedValue(sampleReport);

    render(<NetworkingReportPage />);

    await waitFor(() => {
      expect(
        screen.getByText("Attend the next networking evening")
      ).toBeDefined();
    });

    expect(
      screen.getByText("Connect with 3 suggested members")
    ).toBeDefined();
  });

  it("shows error state on API failure", async () => {
    mockGet.mockRejectedValue(new Error("Server error"));

    render(<NetworkingReportPage />);

    // After the rejection loading finishes and report stays null — stat cards absent
    await waitFor(() => {
      expect(screen.queryByText("Connections")).toBeNull();
    });

    // Page heading still visible
    expect(screen.getByText("Networking Report")).toBeDefined();
  });
});
