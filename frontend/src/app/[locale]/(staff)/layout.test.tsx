import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import StaffLayout from "./layout";

const mockPush = vi.fn();
const mockLogout = vi.fn();
const mockUseAuth = vi.hoisted(() => vi.fn());

vi.mock("@/hooks/use-auth", () => ({
  useAuth: mockUseAuth,
}));

vi.mock("next/navigation", async () => {
  const actual = await vi.importActual<typeof import("next/navigation")>("next/navigation");
  return {
    ...actual,
    useRouter: () => ({
      push: mockPush,
      replace: vi.fn(),
      prefetch: vi.fn(),
      back: vi.fn(),
      forward: vi.fn(),
    }),
    useSearchParams: () => new URLSearchParams(),
    usePathname: () => "/staff/checkin",
    useParams: () => ({}),
  };
});

const staffUser = {
  id: "u1",
  email: "staff@test.com",
  role: "staff",
  is_superuser: false,
};

const adminUser = {
  id: "u2",
  email: "admin@test.com",
  role: "admin",
  is_superuser: true,
};

const regularUser = {
  id: "u3",
  email: "user@test.com",
  role: "user",
  is_superuser: false,
};

describe("StaffLayout", () => {
  beforeEach(() => {
    mockPush.mockReset();
    mockLogout.mockReset();
  });

  it("shows loading spinner while auth is loading", () => {
    mockUseAuth.mockReturnValue({
      user: null,
      isAuthenticated: false,
      isLoading: true,
      logout: mockLogout,
    });
    render(<StaffLayout><p>child</p></StaffLayout>);
    expect(document.querySelector(".animate-spin")).toBeInTheDocument();
    expect(screen.queryByText("child")).not.toBeInTheDocument();
  });

  it("renders header and children for staff user", () => {
    mockUseAuth.mockReturnValue({
      user: staffUser,
      isAuthenticated: true,
      isLoading: false,
      logout: mockLogout,
    });
    render(<StaffLayout><p>child content</p></StaffLayout>);
    expect(screen.getByText("Staff Panel")).toBeInTheDocument();
    expect(screen.getByText("child content")).toBeInTheDocument();
  });

  it("renders header for admin user", () => {
    mockUseAuth.mockReturnValue({
      user: adminUser,
      isAuthenticated: true,
      isLoading: false,
      logout: mockLogout,
    });
    render(<StaffLayout><p>admin child</p></StaffLayout>);
    expect(screen.getByText("admin child")).toBeInTheDocument();
  });

  it("redirects to login when not authenticated", () => {
    mockUseAuth.mockReturnValue({
      user: null,
      isAuthenticated: false,
      isLoading: false,
      logout: mockLogout,
    });
    render(<StaffLayout><p>child</p></StaffLayout>);
    expect(mockPush).toHaveBeenCalledWith("/login");
  });

  it("redirects regular user to dashboard", () => {
    mockUseAuth.mockReturnValue({
      user: regularUser,
      isAuthenticated: true,
      isLoading: false,
      logout: mockLogout,
    });
    render(<StaffLayout><p>child</p></StaffLayout>);
    expect(mockPush).toHaveBeenCalledWith("/dashboard");
  });

  it("has three header buttons: scan, register-guest, logout", () => {
    mockUseAuth.mockReturnValue({
      user: staffUser,
      isAuthenticated: true,
      isLoading: false,
      logout: mockLogout,
    });
    render(<StaffLayout><p>child</p></StaffLayout>);

    const buttons = document.querySelectorAll("header button");
    expect(buttons.length).toBe(3);
  });

  it("scan button navigates to staff home", async () => {
    mockUseAuth.mockReturnValue({
      user: staffUser,
      isAuthenticated: true,
      isLoading: false,
      logout: mockLogout,
    });
    render(<StaffLayout><p>child</p></StaffLayout>);

    const buttons = document.querySelectorAll("header button");
    await userEvent.click(buttons[0]);
    expect(mockPush).toHaveBeenCalledWith("/staff");
  });

  it("register guest button navigates to register-guest page", async () => {
    mockUseAuth.mockReturnValue({
      user: staffUser,
      isAuthenticated: true,
      isLoading: false,
      logout: mockLogout,
    });
    render(<StaffLayout><p>child</p></StaffLayout>);

    const buttons = document.querySelectorAll("header button");
    await userEvent.click(buttons[1]);
    expect(mockPush).toHaveBeenCalledWith("/staff/register-guest");
  });

  it("logout button calls logout", async () => {
    mockUseAuth.mockReturnValue({
      user: staffUser,
      isAuthenticated: true,
      isLoading: false,
      logout: mockLogout,
    });
    render(<StaffLayout><p>child</p></StaffLayout>);

    const buttons = document.querySelectorAll("header button");
    await userEvent.click(buttons[2]);
    expect(mockLogout).toHaveBeenCalled();
  });
});
