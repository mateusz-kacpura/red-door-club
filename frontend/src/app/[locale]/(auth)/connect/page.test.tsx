import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent, act } from "@testing-library/react";
import ConnectPage from "./page";

const mockPush = vi.fn();
const mockReplace = vi.fn();
const mockPrefetch = vi.fn();
const mockRouter = { push: mockPush, replace: mockReplace, prefetch: mockPrefetch };
let mockMemberId: string | null = "test-uuid-123";

vi.mock("next/navigation", () => ({
  useRouter: () => mockRouter,
  usePathname: () => "/connect",
  useParams: () => ({}),
  useSearchParams: () => ({ get: (key: string) => (key === "member" ? mockMemberId : null) }),
}));

const mockGet = vi.hoisted(() => vi.fn());
const mockPost = vi.hoisted(() => vi.fn());
const MockApiError = vi.hoisted(() =>
  class ApiError extends Error {
    name = "ApiError";
    status: number;
    constructor(message: string, status: number) {
      super(message);
      this.status = status;
    }
  }
);

vi.mock("@/lib/api-client", () => ({
  apiClient: { get: mockGet, post: mockPost },
  ApiError: MockApiError,
}));

describe("ConnectPage", () => {
  beforeEach(() => {
    mockGet.mockReset();
    mockPost.mockReset();
    mockPush.mockReset();
    mockReplace.mockReset();
    mockPrefetch.mockReset();
    mockMemberId = "test-uuid-123";
  });

  // ── Loading State ──────────────────────────────────────────────────────────

  it("shows loading spinner while fetching profile", () => {
    mockGet.mockReturnValue(new Promise(() => {}));
    render(<ConnectPage />);
    expect(document.querySelector(".animate-spin")).toBeInTheDocument();
  });

  // ── Ready State ────────────────────────────────────────────────────────────

  it("shows target profile and connect button", async () => {
    mockGet.mockResolvedValue({
      id: "test-uuid-123",
      full_name: "Alice Smith",
      company_name: "Acme Corp",
      industry: "Technology",
    });
    render(<ConnectPage />);
    await waitFor(() => {
      expect(screen.getByText(/Alice Smith/)).toBeInTheDocument();
    });
    expect(screen.getByText("Acme Corp")).toBeInTheDocument();
    expect(screen.getByText("Technology")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Connect/ })).toBeInTheDocument();
  });

  it("hides company and industry when null", async () => {
    mockGet.mockResolvedValue({
      id: "test-uuid-123",
      full_name: "Alice Smith",
      company_name: null,
      industry: null,
    });
    render(<ConnectPage />);
    await waitFor(() => {
      expect(screen.getByText(/Alice Smith/)).toBeInTheDocument();
    });
    expect(screen.queryByText("Acme Corp")).not.toBeInTheDocument();
    expect(screen.queryByText("Technology")).not.toBeInTheDocument();
  });

  it("shows 'Member' as fallback when full_name is null", async () => {
    mockGet.mockResolvedValue({
      id: "test-uuid-123",
      full_name: null,
      company_name: null,
      industry: null,
    });
    render(<ConnectPage />);
    await waitFor(() => {
      expect(screen.getByText(/Connect with Member/)).toBeInTheDocument();
    });
  });

  it("fetches public profile with correct member id", async () => {
    mockGet.mockResolvedValue({
      id: "test-uuid-123",
      full_name: "Alice Smith",
      company_name: null,
      industry: null,
    });
    render(<ConnectPage />);
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Connect/ })).toBeInTheDocument();
    });
    expect(mockGet).toHaveBeenCalledWith("/members/test-uuid-123/public-profile");
  });

  // ── Success State ──────────────────────────────────────────────────────────

  it("shows success state after connecting", async () => {
    mockGet.mockResolvedValue({
      id: "test-uuid-123",
      full_name: "Alice Smith",
      company_name: null,
      industry: null,
    });
    mockPost.mockResolvedValue({ status: "connected", member_name: "Alice Smith" });

    render(<ConnectPage />);
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Connect/ })).toBeInTheDocument();
    });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /Connect/ }));
    });

    await waitFor(() => {
      expect(screen.getByText("Connected!")).toBeInTheDocument();
    });
    expect(screen.getByText(/You are now connected with Alice Smith/)).toBeInTheDocument();
  });

  it("sends correct payload when connecting", async () => {
    mockGet.mockResolvedValue({
      id: "test-uuid-123",
      full_name: "Alice Smith",
      company_name: null,
      industry: null,
    });
    mockPost.mockResolvedValue({ status: "connected", member_name: "Alice Smith" });

    render(<ConnectPage />);
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Connect/ })).toBeInTheDocument();
    });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /Connect/ }));
    });

    expect(mockPost).toHaveBeenCalledWith("/members/connect", { member_id: "test-uuid-123" });
  });

  it("shows View Connections button after success", async () => {
    mockGet.mockResolvedValue({
      id: "test-uuid-123",
      full_name: "Alice Smith",
      company_name: null,
      industry: null,
    });
    mockPost.mockResolvedValue({ status: "connected", member_name: "Alice Smith" });

    render(<ConnectPage />);
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Connect/ })).toBeInTheDocument();
    });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /Connect/ }));
    });

    await waitFor(() => {
      expect(screen.getByText("Connected!")).toBeInTheDocument();
    });

    const viewBtn = screen.getByRole("button", { name: /View Connections/ });
    fireEvent.click(viewBtn);
    expect(mockPush).toHaveBeenCalledWith("/dashboard/connections");
  });

  // ── Already Connected (409) ────────────────────────────────────────────────

  it("shows already connected state on 409", async () => {
    mockGet.mockResolvedValue({
      id: "test-uuid-123",
      full_name: "Alice Smith",
      company_name: null,
      industry: null,
    });
    mockPost.mockRejectedValue(new MockApiError("Already connected.", 409));

    render(<ConnectPage />);
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Connect/ })).toBeInTheDocument();
    });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /Connect/ }));
    });

    await waitFor(() => {
      expect(screen.getByText("Already connected")).toBeInTheDocument();
    });
    expect(screen.getByText(/You are already connected with Alice Smith/)).toBeInTheDocument();
  });

  it("shows View Connections button when already connected", async () => {
    mockGet.mockResolvedValue({
      id: "test-uuid-123",
      full_name: "Alice Smith",
      company_name: null,
      industry: null,
    });
    mockPost.mockRejectedValue(new MockApiError("Already connected.", 409));

    render(<ConnectPage />);
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Connect/ })).toBeInTheDocument();
    });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /Connect/ }));
    });

    await waitFor(() => {
      expect(screen.getByText("Already connected")).toBeInTheDocument();
    });

    const viewBtn = screen.getByRole("button", { name: /View Connections/ });
    fireEvent.click(viewBtn);
    expect(mockPush).toHaveBeenCalledWith("/dashboard/connections");
  });

  // ── Error States ───────────────────────────────────────────────────────────

  it("shows error when no member param", async () => {
    mockMemberId = null;
    render(<ConnectPage />);
    await waitFor(() => {
      const headings = screen.getAllByText("Member not found");
      expect(headings.length).toBeGreaterThanOrEqual(1);
    });
  });

  it("redirects to login on 401 when fetching profile", async () => {
    mockGet.mockRejectedValue(new MockApiError("Not authenticated", 401));
    render(<ConnectPage />);

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith(
        "/login?returnUrl=%2Fconnect%3Fmember%3Dtest-uuid-123"
      );
    });
  });

  it("shows error on 400 bad request when connecting", async () => {
    mockGet.mockResolvedValue({
      id: "test-uuid-123",
      full_name: "Alice Smith",
      company_name: null,
      industry: null,
    });
    mockPost.mockRejectedValue(new MockApiError("Cannot connect with yourself.", 400));

    render(<ConnectPage />);
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Connect/ })).toBeInTheDocument();
    });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /Connect/ }));
    });

    await waitFor(() => {
      expect(screen.getByText("Cannot connect with yourself.")).toBeInTheDocument();
    });
  });

  it("shows error on profile fetch failure (non-401)", async () => {
    mockGet.mockRejectedValue(new MockApiError("Member not found.", 404));
    render(<ConnectPage />);

    await waitFor(() => {
      const headings = screen.getAllByText("Member not found");
      expect(headings.length).toBeGreaterThanOrEqual(1);
    });
    expect(screen.getByText("Member not found.")).toBeInTheDocument();
  });

  it("shows generic error for non-ApiError failures", async () => {
    mockGet.mockResolvedValue({
      id: "test-uuid-123",
      full_name: "Alice Smith",
      company_name: null,
      industry: null,
    });
    mockPost.mockRejectedValue(new Error("Network error"));

    render(<ConnectPage />);
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Connect/ })).toBeInTheDocument();
    });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /Connect/ }));
    });

    await waitFor(() => {
      expect(screen.getByText("Network error")).toBeInTheDocument();
    });
  });

  // ── Connecting State ───────────────────────────────────────────────────────

  it("shows spinner while connecting", async () => {
    mockGet.mockResolvedValue({
      id: "test-uuid-123",
      full_name: "Alice Smith",
      company_name: null,
      industry: null,
    });
    // Post never resolves — stays in "connecting" state
    mockPost.mockReturnValue(new Promise(() => {}));

    render(<ConnectPage />);
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Connect/ })).toBeInTheDocument();
    });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /Connect/ }));
    });

    await waitFor(() => {
      expect(document.querySelector(".animate-spin")).toBeInTheDocument();
    });
    expect(screen.getByText("Connecting...")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Connect/ })).not.toBeInTheDocument();
  });
});
