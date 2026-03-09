import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import AdminServicesPage from "./page";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => "/admin/services",
  useParams: () => ({}),
  useSearchParams: () => ({ get: () => null }),
}));

const mockGet = vi.hoisted(() => vi.fn());
const mockPatch = vi.hoisted(() => vi.fn());
vi.mock("@/lib/api-client", () => ({
  apiClient: { get: mockGet, patch: mockPatch },
  ApiError: class ApiError extends Error { name = "ApiError"; },
}));

const makeRequest = (overrides = {}) => ({
  id: "req-uuid-1",
  member_id: "member-uuid-1",
  member_name: "Alice Chen",
  request_type: "bar",
  status: "pending",
  details: { notes: "Two whisky sours" },
  assigned_to: null,
  assigned_to_name: null,
  created_at: new Date().toISOString(),
  completed_at: null,
  member_rating: null,
  ...overrides,
});

describe("AdminServicesPage", () => {
  beforeEach(() => {
    mockGet.mockReset();
    mockPatch.mockReset();
    mockGet.mockResolvedValue([]);
  });

  it("shows loading spinner initially", () => {
    mockGet.mockReturnValue(new Promise(() => {}));
    render(<AdminServicesPage />);
    expect(document.querySelector(".animate-spin")).toBeInTheDocument();
  });

  it("shows empty state when no requests", async () => {
    mockGet.mockResolvedValue([]);
    render(<AdminServicesPage />);
    await waitFor(() => {
      expect(screen.getByText(/no service requests/i)).toBeInTheDocument();
    });
  });

  it("shows service request cards with member name", async () => {
    mockGet.mockResolvedValue([makeRequest()]);
    render(<AdminServicesPage />);
    await waitFor(() => {
      expect(screen.getByText("Alice Chen")).toBeInTheDocument();
    });
    expect(screen.getByText("Two whisky sours")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /acknowledge/i })).toBeInTheDocument();
  });

  it("shows both request cards and status filter buttons in header", async () => {
    mockGet.mockResolvedValue([
      makeRequest({ status: "pending" }),
      makeRequest({ id: "req-2", status: "in_progress" }),
    ]);
    render(<AdminServicesPage />);
    await waitFor(() => {
      expect(screen.getAllByText("Alice Chen")).toHaveLength(2);
    });
    expect(screen.getByRole("button", { name: /^pending$/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^in progress$/i })).toBeInTheDocument();
  });

  it("calls PATCH API when status button clicked", async () => {
    mockGet.mockResolvedValue([makeRequest()]);
    mockPatch.mockResolvedValue({});
    render(<AdminServicesPage />);
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /acknowledge/i })).toBeInTheDocument();
    });
    await userEvent.click(screen.getByRole("button", { name: /acknowledge/i }));
    expect(mockPatch).toHaveBeenCalledWith("/admin/services/req-uuid-1", { status: "acknowledged" });
  });

  it("filters requests by tab", async () => {
    mockGet.mockResolvedValue([
      makeRequest({ status: "pending" }),
      makeRequest({ id: "req-2", status: "completed" }),
    ]);
    render(<AdminServicesPage />);
    // Both requests have the same member_name — wait for 2 cards to appear
    await waitFor(() => {
      expect(screen.getAllByText("Alice Chen")).toHaveLength(2);
    });
    // Click "Completed" filter — only the completed card should remain
    await userEvent.click(screen.getByRole("button", { name: /^completed$/i }));
    await waitFor(() => {
      expect(screen.getAllByText("Alice Chen")).toHaveLength(1);
    });
  });
});
