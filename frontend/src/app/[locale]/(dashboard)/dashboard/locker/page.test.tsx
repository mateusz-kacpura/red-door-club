import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import LockerPage from "./page";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => "/dashboard/locker",
  useParams: () => ({}),
  useSearchParams: () => ({ get: () => null }),
}));

const mockGet = vi.hoisted(() => vi.fn());
vi.mock("@/lib/api-client", () => ({
  apiClient: { get: mockGet },
  ApiError: class ApiError extends Error { name = "ApiError"; },
}));

describe("LockerPage", () => {
  beforeEach(() => {
    mockGet.mockReset();
  });

  it("shows loading spinner initially", () => {
    mockGet.mockReturnValue(new Promise(() => {}));
    render(<LockerPage />);
    expect(document.querySelector(".animate-spin")).toBeInTheDocument();
  });

  it("shows empty state when no locker assigned", async () => {
    mockGet.mockResolvedValue(null);
    render(<LockerPage />);
    await waitFor(() => {
      expect(screen.getByText(/no locker assigned/i)).toBeInTheDocument();
    });
    // The empty state has a more specific message about "claiming" a locker
    expect(screen.getByText(/locker station/i)).toBeInTheDocument();
  });

  it("shows locker details when assigned", async () => {
    mockGet.mockResolvedValue({
      id: "locker-uuid",
      locker_number: "A01",
      location: "main_floor",
      status: "occupied",
      assigned_at: new Date().toISOString(),
      released_at: null,
    });
    render(<LockerPage />);
    await waitFor(() => {
      expect(screen.getByText("Locker #A01")).toBeInTheDocument();
    });
    expect(screen.getByText("Assigned")).toBeInTheDocument();
    expect(screen.getByText(/main floor/i)).toBeInTheDocument();
  });

  it("shows empty state on API error", async () => {
    mockGet.mockRejectedValue(new Error("Network error"));
    render(<LockerPage />);
    await waitFor(() => {
      expect(screen.getByText(/no locker assigned/i)).toBeInTheDocument();
    });
  });
});
