import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import MemberDetailPage from "./page";

const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush, replace: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => "/admin/members/member-uuid-1",
  useParams: () => ({ id: "member-uuid-1" }),
  useSearchParams: () => ({ get: () => null }),
}));

const mockGet = vi.hoisted(() => vi.fn());
const mockPatch = vi.hoisted(() => vi.fn());
vi.mock("@/lib/api-client", () => ({
  apiClient: { get: mockGet, patch: mockPatch },
  ApiError: class ApiError extends Error { name = "ApiError"; },
}));

const makeMember = (overrides = {}) => ({
  id: "member-uuid-1",
  email: "alice@example.com",
  full_name: "Alice Chen",
  company_name: "Acme Corp",
  user_type: "individual",
  tier: "gold",
  is_active: true,
  is_superuser: false,
  created_at: new Date().toISOString(),
  segment_groups: [],
  staff_notes: null,
  connections_count: 5,
  tab_total: 1500,
  service_requests_count: 3,
  recent_taps: [],
  interests: [],
  industry: null,
  revenue_range: null,
  phone: null,
  ...overrides,
});

describe("MemberDetailPage", () => {
  beforeEach(() => {
    mockGet.mockReset();
    mockPatch.mockReset();
    mockPush.mockReset();
  });

  it("shows loading spinner initially", () => {
    mockGet.mockReturnValue(new Promise(() => {}));
    render(<MemberDetailPage />);
    expect(document.querySelector(".animate-spin")).toBeInTheDocument();
  });

  it("shows member not found when fetch returns null", async () => {
    mockGet.mockRejectedValue(new Error("Not Found"));
    render(<MemberDetailPage />);
    await waitFor(() => {
      expect(screen.getByText(/member not found/i)).toBeInTheDocument();
    });
  });

  it("renders member name, email and tier badge", async () => {
    mockGet.mockResolvedValue(makeMember());
    render(<MemberDetailPage />);
    await waitFor(() => {
      expect(screen.getByText("Alice Chen")).toBeInTheDocument();
    });
    expect(screen.getByText("alice@example.com")).toBeInTheDocument();
    expect(screen.getByText("gold")).toBeInTheDocument();
  });

  it("shows stat cards with connections, tab total, and service requests", async () => {
    mockGet.mockResolvedValue(makeMember({ connections_count: 7, tab_total: 2000, service_requests_count: 4 }));
    render(<MemberDetailPage />);
    await waitFor(() => {
      expect(screen.getByText("7")).toBeInTheDocument();
    });
    expect(screen.getByText("Connections")).toBeInTheDocument();
    expect(screen.getByText(/2,000/)).toBeInTheDocument();
    expect(screen.getByText("4")).toBeInTheDocument();
    expect(screen.getByText("Service Requests")).toBeInTheDocument();
  });

  it("shows no tap history when recent_taps is empty", async () => {
    mockGet.mockResolvedValue(makeMember({ recent_taps: [] }));
    render(<MemberDetailPage />);
    await waitFor(() => {
      expect(screen.getByText(/no tap history/i)).toBeInTheDocument();
    });
  });

  it("shows recent taps with tap type label", async () => {
    const tap = {
      id: "tap-uuid-1",
      tap_type: "venue_entry",
      card_id: "CARD-001",
      tapped_at: new Date().toISOString(),
      location: "Main entrance",
    };
    mockGet.mockResolvedValue(makeMember({ recent_taps: [tap] }));
    render(<MemberDetailPage />);
    await waitFor(() => {
      expect(screen.getByText("venue entry")).toBeInTheDocument();
    });
    expect(screen.getByText("Main entrance")).toBeInTheDocument();
  });

  it("pre-fills staff notes textarea from member data", async () => {
    mockGet.mockResolvedValue(makeMember({ staff_notes: "VIP guest, prefers booth" }));
    render(<MemberDetailPage />);
    await waitFor(() => {
      expect(screen.getByDisplayValue("VIP guest, prefers booth")).toBeInTheDocument();
    });
  });

  it("calls PATCH when Save Notes clicked", async () => {
    mockGet.mockResolvedValue(makeMember({ staff_notes: "" }));
    mockPatch.mockResolvedValue({});
    render(<MemberDetailPage />);
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /save notes/i })).toBeInTheDocument();
    });
    const textarea = screen.getByPlaceholderText(/add internal notes/i);
    await userEvent.clear(textarea);
    await userEvent.type(textarea, "New note");
    await userEvent.click(screen.getByRole("button", { name: /save notes/i }));
    expect(mockPatch).toHaveBeenCalledWith(
      "/admin/members/member-uuid-1/notes",
      { notes: "New note" }
    );
  });

  it("navigates back to members list on Back button click", async () => {
    mockGet.mockResolvedValue(makeMember());
    render(<MemberDetailPage />);
    await waitFor(() => {
      expect(screen.getByText("Alice Chen")).toBeInTheDocument();
    });
    await userEvent.click(screen.getByRole("button", { name: /members/i }));
    expect(mockPush).toHaveBeenCalledWith("/admin/members");
  });
});
