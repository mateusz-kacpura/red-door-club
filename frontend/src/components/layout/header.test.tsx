import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Header } from "./header";

const mockLogout = vi.fn();
const mockToggle = vi.fn();
const mockUseAuth = vi.hoisted(() => vi.fn());

vi.mock("@/hooks", () => ({
  useAuth: mockUseAuth,
}));

vi.mock("@/stores", () => ({
  useSidebarStore: () => ({ toggle: mockToggle, isOpen: false }),
}));

vi.mock("react-qr-code", () => ({
  __esModule: true,
  default: (props: { value: string }) =>
    React.createElement("div", { "data-testid": "qr-code", "data-value": props.value }),
}));

vi.mock("./language-switcher", () => ({
  LanguageSwitcher: () => React.createElement("div", { "data-testid": "lang-switcher" }),
}));

vi.mock("@/components/theme", () => ({
  ThemeToggle: () => React.createElement("div", { "data-testid": "theme-toggle" }),
}));

vi.mock("next/navigation", async () => {
  const actual = await vi.importActual<typeof import("next/navigation")>("next/navigation");
  return {
    ...actual,
    useRouter: () => ({
      push: vi.fn(),
      replace: vi.fn(),
      prefetch: vi.fn(),
      back: vi.fn(),
      forward: vi.fn(),
    }),
    useSearchParams: () => new URLSearchParams(),
    usePathname: () => "/dashboard",
    useParams: () => ({}),
  };
});

const authenticatedUser = {
  id: "user-uuid-1",
  email: "john@example.com",
  full_name: "John Doe",
  is_superuser: false,
  is_active: true,
};

describe("Header", () => {
  beforeEach(() => {
    mockLogout.mockReset();
    mockToggle.mockReset();
  });

  it("shows login and register buttons when not authenticated", () => {
    mockUseAuth.mockReturnValue({
      user: null,
      isAuthenticated: false,
      isLoading: false,
      logout: mockLogout,
    });
    render(<Header />);
    expect(screen.getByText("Login")).toBeInTheDocument();
    expect(screen.getByText("Register")).toBeInTheDocument();
  });

  it("shows QR button, profile link, and logout when authenticated", () => {
    mockUseAuth.mockReturnValue({
      user: authenticatedUser,
      isAuthenticated: true,
      isLoading: false,
      logout: mockLogout,
    });
    render(<Header />);
    expect(screen.getByText("My QR Code")).toBeInTheDocument();
    expect(screen.getByText("john@example.com")).toBeInTheDocument();
    expect(screen.queryByText("Login")).not.toBeInTheDocument();
  });

  it("opens QR sheet when QR button is clicked", async () => {
    mockUseAuth.mockReturnValue({
      user: authenticatedUser,
      isAuthenticated: true,
      isLoading: false,
      logout: mockLogout,
    });
    render(<Header />);

    expect(screen.queryByTestId("qr-code")).not.toBeInTheDocument();

    const qrButton = screen.getByText("My QR Code").closest("button")!;
    await userEvent.click(qrButton);

    expect(screen.getByTestId("qr-code")).toBeInTheDocument();
  });

  it("QR code contains correct checkin URL with user ID", async () => {
    mockUseAuth.mockReturnValue({
      user: authenticatedUser,
      isAuthenticated: true,
      isLoading: false,
      logout: mockLogout,
    });
    render(<Header />);

    const qrButton = screen.getByText("My QR Code").closest("button")!;
    await userEvent.click(qrButton);

    const qr = screen.getByTestId("qr-code");
    expect(qr.getAttribute("data-value")).toContain("/m/user-uuid-1");
  });

  it("shows hint text in QR sheet", async () => {
    mockUseAuth.mockReturnValue({
      user: authenticatedUser,
      isAuthenticated: true,
      isLoading: false,
      logout: mockLogout,
    });
    render(<Header />);

    const qrButton = screen.getByText("My QR Code").closest("button")!;
    await userEvent.click(qrButton);

    expect(screen.getByText("Show this QR to staff at the door or to other members to connect")).toBeInTheDocument();
  });

  it("closes QR overlay when X button is clicked", async () => {
    mockUseAuth.mockReturnValue({
      user: authenticatedUser,
      isAuthenticated: true,
      isLoading: false,
      logout: mockLogout,
    });
    render(<Header />);

    const qrButton = screen.getByText("My QR Code").closest("button")!;
    await userEvent.click(qrButton);
    expect(screen.getByTestId("qr-code")).toBeInTheDocument();

    const closeButton = screen.getByText("Close").closest("button")!;
    await userEvent.click(closeButton);

    expect(screen.queryByTestId("qr-code")).not.toBeInTheDocument();
  });

  it("calls logout when logout button is clicked", async () => {
    mockUseAuth.mockReturnValue({
      user: authenticatedUser,
      isAuthenticated: true,
      isLoading: false,
      logout: mockLogout,
    });
    render(<Header />);

    const logoutButton = screen.getByText("Logout").closest("button")!;
    await userEvent.click(logoutButton);
    expect(mockLogout).toHaveBeenCalled();
  });
});
