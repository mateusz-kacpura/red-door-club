import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import AdminLockersPage from "./page";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => "/admin/lockers",
  useParams: () => ({}),
  useSearchParams: () => ({ get: () => null }),
}));

const mockGet = vi.hoisted(() => vi.fn());
const mockPost = vi.hoisted(() => vi.fn());
const mockDelete = vi.hoisted(() => vi.fn());
vi.mock("@/lib/api-client", () => ({
  apiClient: { get: mockGet, post: mockPost, delete: mockDelete },
  ApiError: class ApiError extends Error { name = "ApiError"; },
}));

const makeLocker = (overrides = {}) => ({
  id: "locker-1",
  locker_number: "A01",
  location: "main_floor",
  status: "available",
  assigned_member_id: null,
  assigned_at: null,
  released_at: null,
  ...overrides,
});

describe("AdminLockersPage", () => {
  beforeEach(() => {
    mockGet.mockReset();
    mockPost.mockReset();
    mockDelete.mockReset();
    mockGet.mockResolvedValue([]);
  });

  it("shows loading spinner initially", () => {
    mockGet.mockReturnValue(new Promise(() => {}));
    render(<AdminLockersPage />);
    expect(document.querySelector(".animate-spin")).toBeInTheDocument();
  });

  it("shows empty state when no lockers", async () => {
    mockGet.mockResolvedValue([]);
    render(<AdminLockersPage />);
    await waitFor(() => {
      expect(screen.getByText(/no lockers configured/i)).toBeInTheDocument();
    });
  });

  it("shows locker grid with data", async () => {
    mockGet.mockResolvedValue([
      makeLocker({ locker_number: "A01", status: "available" }),
      makeLocker({ id: "locker-2", locker_number: "B02", location: "vip_room", status: "occupied", assigned_member_id: "member-uuid", assigned_at: new Date().toISOString() }),
    ]);
    render(<AdminLockersPage />);
    await waitFor(() => {
      expect(screen.getByText("A01")).toBeInTheDocument();
    });
    expect(screen.getByText("B02")).toBeInTheDocument();
    expect(screen.getByText("Free")).toBeInTheDocument();
    expect(screen.getByText("In Use")).toBeInTheDocument();
  });

  it("shows summary counts", async () => {
    mockGet.mockResolvedValue([
      makeLocker({ id: "1", locker_number: "A01", status: "available" }),
      makeLocker({ id: "2", locker_number: "A02", status: "available" }),
      makeLocker({ id: "3", locker_number: "B01", status: "occupied" }),
    ]);
    render(<AdminLockersPage />);
    await waitFor(() => {
      expect(screen.getByText(/2 available/i)).toBeInTheDocument();
    });
    expect(screen.getByText(/1 occupied/i)).toBeInTheDocument();
  });

  it("shows Add Locker button", async () => {
    render(<AdminLockersPage />);
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /add locker/i })).toBeInTheDocument();
    });
  });

  it("shows Force Release button for occupied lockers", async () => {
    mockGet.mockResolvedValue([
      makeLocker({
        locker_number: "A01",
        status: "occupied",
        assigned_member_id: "member-uuid",
        assigned_at: new Date().toISOString(),
      }),
    ]);
    render(<AdminLockersPage />);
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /force release/i })).toBeInTheDocument();
    });
  });

  it("toggles create form on Add Locker click", async () => {
    render(<AdminLockersPage />);
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /add locker/i })).toBeInTheDocument();
    });
    await userEvent.click(screen.getByRole("button", { name: /add locker/i }));
    expect(screen.getByText(/add new locker/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/e\.g\. A01/i)).toBeInTheDocument();
  });
});
