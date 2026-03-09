import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import TapPage from "./page";

// vi.hoisted ensures these are available inside vi.mock factory (runs before imports)
const mockPush = vi.hoisted(() => vi.fn());
const mockReplace = vi.hoisted(() => vi.fn());
// Mutable object so tests can change cid per-test
const searchParams = vi.hoisted(() => ({ cid: "RD-NFC-001" as string | null }));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
    replace: mockReplace,
    prefetch: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
  }),
  useSearchParams: () => ({
    get: (key: string) => (key === "cid" ? searchParams.cid : null),
  }),
  usePathname: () => "/tap",
  useParams: () => ({}),
}));

describe("TapPage", () => {
  beforeEach(() => {
    // Reset individual mocks — avoid vi.clearAllMocks() as it can reset vi.hoisted state
    mockPush.mockClear();
    mockReplace.mockClear();
    searchParams.cid = "RD-NFC-001"; // reset to default
    global.fetch = vi.fn();
  });

  it("shows loading spinner initially", () => {
    // Pending promise — component stays in loading state
    (global.fetch as ReturnType<typeof vi.fn>).mockReturnValue(new Promise(() => {}));

    render(<TapPage />);

    expect(screen.getByText(/reading card/i)).toBeInTheDocument();
  });

  it("shows welcome screen when action is welcome", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({
        action: "welcome",
        member_name: "John Doe",
        message: "Welcome back, John Doe!",
        redirect_url: null,
      }),
    });

    render(<TapPage />);

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: /welcome back, john doe/i })).toBeInTheDocument();
    });
    expect(screen.getByRole("button", { name: /go to dashboard/i })).toBeInTheDocument();
  });

  it("navigates to setup when action is setup", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({
        action: "setup",
        redirect_url: "/setup?cid=RD-NFC-001",
        message: "Complete your profile.",
      }),
    });

    render(<TapPage />);

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith("/setup?cid=RD-NFC-001");
    });
  });

  it("shows suspended screen when action is card_suspended", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({
        action: "card_suspended",
        message: "This card has been deactivated.",
      }),
    });

    render(<TapPage />);

    await waitFor(() => {
      expect(screen.getByText(/card deactivated/i)).toBeInTheDocument();
    });
    expect(screen.getByText(/contact club staff/i)).toBeInTheDocument();
  });

  it("shows error when API returns non-ok status", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false,
      json: async () => ({ detail: "Card not found" }),
    });

    render(<TapPage />);

    await waitFor(() => {
      expect(screen.getByText(/card not found/i)).toBeInTheDocument();
    });
  });

  it("shows error when fetch throws a network error", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("Network error"));

    render(<TapPage />);

    await waitFor(() => {
      expect(screen.getByText(/network error/i)).toBeInTheDocument();
    });
  });

  it("shows welcome with generic text when no member_name", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({
        action: "welcome",
        member_name: null,
        message: "Welcome back!",
      }),
    });

    render(<TapPage />);

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: /^welcome back$/i })).toBeInTheDocument();
    });
  });

  it("dashboard button navigates to /dashboard on click", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({
        action: "welcome",
        member_name: "Test User",
        message: "Welcome!",
      }),
    });

    render(<TapPage />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /go to dashboard/i })).toBeInTheDocument();
    });

    await userEvent.click(screen.getByRole("button", { name: /go to dashboard/i }));

    expect(mockPush).toHaveBeenCalledWith("/dashboard");
  });

  it("shows error when cid is missing from URL", async () => {
    searchParams.cid = null; // simulate missing ?cid=

    render(<TapPage />);

    await waitFor(() => {
      expect(screen.getByText(/no card id provided/i)).toBeInTheDocument();
    });
    // fetch should NOT be called when cid is absent
    expect(global.fetch).not.toHaveBeenCalled();
  });

  // ── Phase 2 new actions ────────────────────────────────────────────────────

  it("shows connection_made screen with member name", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({
        action: "connection_made",
        member_name: "Bob Jones",
        message: "Connected with Bob Jones!",
        redirect_url: null,
      }),
    });

    render(<TapPage />);

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: /connected!/i })).toBeInTheDocument();
    });
    expect(screen.getByText(/You are now connected with Bob Jones/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /view connections/i })).toBeInTheDocument();
  });

  it("connections button navigates to /dashboard/connections", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({
        action: "connection_made",
        member_name: "Alice",
        message: "Connected!",
        redirect_url: null,
      }),
    });

    render(<TapPage />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /view connections/i })).toBeInTheDocument();
    });
    await userEvent.click(screen.getByRole("button", { name: /view connections/i }));
    expect(mockPush).toHaveBeenCalledWith("/dashboard/connections");
  });

  it("shows payment_added screen with tab message", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({
        action: "payment_added",
        member_name: "Alice Smith",
        message: "Added Whisky Sour (฿350) to tab. Total: ฿350",
        redirect_url: null,
      }),
    });

    render(<TapPage />);

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: /added to tab/i })).toBeInTheDocument();
    });
    expect(screen.getByText(/Whisky Sour/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /view tab/i })).toBeInTheDocument();
  });

  it("view tab button navigates to /dashboard/tab", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({
        action: "payment_added",
        message: "Added item to tab.",
        redirect_url: null,
      }),
    });

    render(<TapPage />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /view tab/i })).toBeInTheDocument();
    });
    await userEvent.click(screen.getByRole("button", { name: /view tab/i }));
    expect(mockPush).toHaveBeenCalledWith("/dashboard/tab");
  });

  it("shows locker_assigned screen", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({
        action: "locker_assigned",
        message: "Locker A01 assigned to you.",
        redirect_url: null,
      }),
    });

    render(<TapPage />);

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: /locker assigned/i })).toBeInTheDocument();
    });
    expect(screen.getByText(/Locker A01 assigned/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /view locker/i })).toBeInTheDocument();
  });

  it("view locker button navigates to /dashboard/locker", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({
        action: "locker_assigned",
        message: "Locker assigned.",
        redirect_url: null,
      }),
    });

    render(<TapPage />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /view locker/i })).toBeInTheDocument();
    });
    await userEvent.click(screen.getByRole("button", { name: /view locker/i }));
    expect(mockPush).toHaveBeenCalledWith("/dashboard/locker");
  });

  it("shows locker_released screen", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({
        action: "locker_released",
        message: "Locker A01 released.",
        redirect_url: null,
      }),
    });

    render(<TapPage />);

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: /locker released/i })).toBeInTheDocument();
    });
    expect(screen.getByText(/Locker A01 released/i)).toBeInTheDocument();
  });

  it("shows locker_occupied error screen", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({
        action: "locker_occupied",
        message: "Locker A01 is currently occupied.",
        redirect_url: null,
      }),
    });

    render(<TapPage />);

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: /locker unavailable/i })).toBeInTheDocument();
    });
    expect(screen.getByText(/contact club staff/i)).toBeInTheDocument();
  });

  it("shows locker_already_assigned error screen", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({
        action: "locker_already_assigned",
        message: "You already have locker B05.",
        redirect_url: null,
      }),
    });

    render(<TapPage />);

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: /already assigned/i })).toBeInTheDocument();
    });
    expect(screen.getByText(/B05/i)).toBeInTheDocument();
  });
});
