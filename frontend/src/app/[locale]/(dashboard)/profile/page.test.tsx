import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import ProfilePage from "./page";

const mockGet = vi.hoisted(() => vi.fn());
const mockPatch = vi.hoisted(() => vi.fn());
vi.mock("@/lib/api-client", () => ({
  apiClient: { get: mockGet, patch: mockPatch, post: vi.fn() },
  ApiError: class ApiError extends Error { name = "ApiError"; },
}));

vi.mock("react-qr-code", () => ({
  __esModule: true,
  default: ({ value }: { value: string }) => (
    <div data-testid="qr-code" data-value={value} />
  ),
}));

const mockLogout = vi.fn();
const mockUseAuth = vi.hoisted(() => vi.fn());
vi.mock("@/hooks", () => ({
  useAuth: mockUseAuth,
}));

const baseUser = {
  id: "user-uuid-1",
  email: "john@example.com",
  full_name: "John Doe",
  phone: "+66 123",
  company_name: "Acme",
  industry: "Tech",
  interests: ["Finance"],
  tier: "gold",
  is_active: true,
  is_superuser: false,
  created_at: "2025-01-01T00:00:00Z",
};

describe("ProfilePage", () => {
  beforeEach(() => {
    mockGet.mockReset();
    mockPatch.mockReset();
    mockLogout.mockReset();
    mockGet.mockResolvedValue({ ...baseUser, nfc_cards: [] });
  });

  it("shows loading spinner while auth is loading", () => {
    mockUseAuth.mockReturnValue({
      user: null,
      isAuthenticated: false,
      isLoading: true,
      logout: mockLogout,
    });
    render(<ProfilePage />);
    expect(document.querySelector(".animate-spin")).toBeInTheDocument();
  });

  it("shows login prompt when not authenticated", () => {
    mockUseAuth.mockReturnValue({
      user: null,
      isAuthenticated: false,
      isLoading: false,
      logout: mockLogout,
    });
    render(<ProfilePage />);
    expect(screen.getByText(/please log in/i)).toBeInTheDocument();
  });

  it("renders profile info and Entry QR when authenticated", async () => {
    mockUseAuth.mockReturnValue({
      user: baseUser,
      isAuthenticated: true,
      isLoading: false,
      logout: mockLogout,
    });
    render(<ProfilePage />);

    await waitFor(() => {
      expect(screen.getAllByText("John Doe").length).toBeGreaterThanOrEqual(1);
    });
    expect(screen.getAllByText("john@example.com").length).toBeGreaterThanOrEqual(1);
  });

  it("renders Entry QR code with correct URL", async () => {
    mockUseAuth.mockReturnValue({
      user: baseUser,
      isAuthenticated: true,
      isLoading: false,
      logout: mockLogout,
    });
    render(<ProfilePage />);

    await waitFor(() => {
      const qrCodes = screen.getAllByTestId("qr-code");
      const entryQr = qrCodes.find((el) =>
        el.getAttribute("data-value")?.includes("/staff/checkin?member=user-uuid-1")
      );
      expect(entryQr).toBeDefined();
    });
  });

  it("shows Entry QR section title and hint", async () => {
    mockUseAuth.mockReturnValue({
      user: baseUser,
      isAuthenticated: true,
      isLoading: false,
      logout: mockLogout,
    });
    render(<ProfilePage />);

    await waitFor(() => {
      expect(screen.getByText(/entry qr/i)).toBeInTheDocument();
    });
    expect(screen.getByText(/show this qr/i)).toBeInTheDocument();
  });

  it("shows tier badge in Entry QR section", async () => {
    mockUseAuth.mockReturnValue({
      user: baseUser,
      isAuthenticated: true,
      isLoading: false,
      logout: mockLogout,
    });
    render(<ProfilePage />);

    await waitFor(() => {
      // The tier badge appears both in header and Entry QR section
      const goldBadges = screen.getAllByText("gold");
      expect(goldBadges.length).toBeGreaterThanOrEqual(2);
    });
  });

  it("shows Connection QR section", async () => {
    mockUseAuth.mockReturnValue({
      user: baseUser,
      isAuthenticated: true,
      isLoading: false,
      logout: mockLogout,
    });
    render(<ProfilePage />);

    await waitFor(() => {
      expect(screen.getByText(/connection qr/i)).toBeInTheDocument();
    });
  });
});
