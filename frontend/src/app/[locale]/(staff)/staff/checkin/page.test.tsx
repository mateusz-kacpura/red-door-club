import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import StaffCheckinPage from "./page";

const mockGet = vi.hoisted(() => vi.fn());
const mockPost = vi.hoisted(() => vi.fn());
vi.mock("@/lib/api-client", () => ({
  apiClient: { get: mockGet, post: mockPost },
  ApiError: class ApiError extends Error {
    name = "ApiError";
    status: number;
    constructor(message: string, status = 400) {
      super(message);
      this.status = status;
    }
  },
}));

// Override the global useSearchParams mock to provide member ID
const mockPush = vi.fn();
const mockSearchParams = vi.hoisted(() => vi.fn(() => new URLSearchParams("member=member-uuid-1")));
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
    useSearchParams: mockSearchParams,
    usePathname: () => "/staff/checkin",
    useParams: () => ({}),
  };
});

const makeMember = (overrides = {}) => ({
  id: "member-uuid-1",
  full_name: "John Doe",
  tier: "gold",
  company_name: "Acme Corp",
  is_active: true,
  ...overrides,
});

const makeEvent = (overrides = {}) => ({
  id: "event-uuid-1",
  title: "Friday Mixer",
  ticket_price: "500.00",
  starts_at: new Date().toISOString(),
  promo_tiers: [],
  ...overrides,
});

const makeCheckinResult = (overrides = {}) => ({
  status: "checked_in",
  member_name: "John Doe",
  event_title: "Friday Mixer",
  fee: "500.00",
  is_promo: false,
  ...overrides,
});

describe("StaffCheckinPage", () => {
  beforeEach(() => {
    mockGet.mockReset();
    mockPost.mockReset();
    mockPush.mockReset();
    mockSearchParams.mockReturnValue(new URLSearchParams("member=member-uuid-1"));
  });

  it("shows loading spinner initially", () => {
    mockGet.mockReturnValue(new Promise(() => {}));
    render(<StaffCheckinPage />);
    expect(document.querySelector(".animate-spin")).toBeInTheDocument();
  });

  it("shows member info and events when loaded", async () => {
    const member = makeMember();
    const event = makeEvent();
    mockGet
      .mockImplementation((url: string) => {
        if (url.includes("/staff/member/")) return Promise.resolve(member);
        if (url.includes("/staff/today-events")) return Promise.resolve([event]);
        return Promise.reject(new Error("Unknown URL"));
      });

    render(<StaffCheckinPage />);

    await waitFor(() => {
      expect(screen.getByText("John Doe")).toBeInTheDocument();
    });
    expect(screen.getByText("Acme Corp")).toBeInTheDocument();
    expect(screen.getByText("gold")).toBeInTheDocument();
    expect(screen.getByText("Friday Mixer")).toBeInTheDocument();
  });

  it("shows no events message when no events today", async () => {
    mockGet.mockImplementation((url: string) => {
      if (url.includes("/staff/member/")) return Promise.resolve(makeMember());
      if (url.includes("/staff/today-events")) return Promise.resolve([]);
      return Promise.reject(new Error("Unknown URL"));
    });

    render(<StaffCheckinPage />);

    await waitFor(() => {
      expect(screen.getByText(/no events scheduled/i)).toBeInTheDocument();
    });
  });

  it("shows member not found when no member param", async () => {
    mockSearchParams.mockReturnValue(new URLSearchParams());
    render(<StaffCheckinPage />);

    await waitFor(() => {
      expect(screen.getByText(/member not found/i)).toBeInTheDocument();
    });
  });

  it("shows member not found on 404 API error", async () => {
    const { ApiError } = await import("@/lib/api-client");
    mockGet.mockImplementation((url: string) => {
      if (url.includes("/staff/member/")) return Promise.reject(new ApiError("Not found", 404));
      if (url.includes("/staff/today-events")) return Promise.resolve([]);
      return Promise.reject(new Error("Unknown URL"));
    });

    render(<StaffCheckinPage />);

    await waitFor(() => {
      expect(screen.getByText(/member not found/i)).toBeInTheDocument();
    });
  });

  it("shows PROMO label for VIP member", async () => {
    const member = makeMember({ tier: "vip" });
    const event = makeEvent({ ticket_price: "1000.00", promo_tiers: [] });
    mockGet.mockImplementation((url: string) => {
      if (url.includes("/staff/member/")) return Promise.resolve(member);
      if (url.includes("/staff/today-events")) return Promise.resolve([event]);
      return Promise.reject(new Error("Unknown URL"));
    });

    render(<StaffCheckinPage />);

    await waitFor(() => {
      expect(screen.getByText("vip")).toBeInTheDocument();
    });
    expect(screen.getByText(/promo/i)).toBeInTheDocument();
    expect(screen.getByText(/0 ฿/)).toBeInTheDocument();
  });

  it("shows PROMO for tier in event promo_tiers", async () => {
    const member = makeMember({ tier: "gold" });
    const event = makeEvent({ ticket_price: "500.00", promo_tiers: ["gold", "platinum"] });
    mockGet.mockImplementation((url: string) => {
      if (url.includes("/staff/member/")) return Promise.resolve(member);
      if (url.includes("/staff/today-events")) return Promise.resolve([event]);
      return Promise.reject(new Error("Unknown URL"));
    });

    render(<StaffCheckinPage />);

    await waitFor(() => {
      expect(screen.getByText("John Doe")).toBeInTheDocument();
    });
    expect(screen.getByText(/promo/i)).toBeInTheDocument();
  });

  it("shows regular price for non-promo tier", async () => {
    const member = makeMember({ tier: "silver" });
    const event = makeEvent({ ticket_price: "500.00", promo_tiers: ["gold"] });
    mockGet.mockImplementation((url: string) => {
      if (url.includes("/staff/member/")) return Promise.resolve(member);
      if (url.includes("/staff/today-events")) return Promise.resolve([event]);
      return Promise.reject(new Error("Unknown URL"));
    });

    render(<StaffCheckinPage />);

    await waitFor(() => {
      expect(screen.getByText("John Doe")).toBeInTheDocument();
    });
    expect(screen.queryByText(/promo/i)).not.toBeInTheDocument();
  });

  it("performs checkin on button click", async () => {
    const member = makeMember();
    const event = makeEvent();
    mockGet.mockImplementation((url: string) => {
      if (url.includes("/staff/member/")) return Promise.resolve(member);
      if (url.includes("/staff/today-events")) return Promise.resolve([event]);
      return Promise.reject(new Error("Unknown URL"));
    });
    mockPost.mockResolvedValue(makeCheckinResult());

    render(<StaffCheckinPage />);

    await waitFor(() => {
      expect(screen.getByText("Friday Mixer")).toBeInTheDocument();
    });

    const checkinBtn = screen.getByRole("button", { name: /check in/i });
    await userEvent.click(checkinBtn);

    await waitFor(() => {
      expect(mockPost).toHaveBeenCalledWith("/staff/checkin", {
        member_id: "member-uuid-1",
        event_id: "event-uuid-1",
      });
    });
  });

  it("shows success screen after checkin", async () => {
    const member = makeMember();
    const event = makeEvent();
    mockGet.mockImplementation((url: string) => {
      if (url.includes("/staff/member/")) return Promise.resolve(member);
      if (url.includes("/staff/today-events")) return Promise.resolve([event]);
      return Promise.reject(new Error("Unknown URL"));
    });
    mockPost.mockResolvedValue(makeCheckinResult({ fee: "500.00", is_promo: false }));

    render(<StaffCheckinPage />);

    await waitFor(() => {
      expect(screen.getByText("Friday Mixer")).toBeInTheDocument();
    });

    await userEvent.click(screen.getByRole("button", { name: /check in/i }));

    await waitFor(() => {
      expect(screen.getByText(/checked in/i)).toBeInTheDocument();
    });
    expect(screen.getByText("John Doe")).toBeInTheDocument();
  });

  it("shows promo result on success screen", async () => {
    const member = makeMember({ tier: "vip" });
    const event = makeEvent();
    mockGet.mockImplementation((url: string) => {
      if (url.includes("/staff/member/")) return Promise.resolve(member);
      if (url.includes("/staff/today-events")) return Promise.resolve([event]);
      return Promise.reject(new Error("Unknown URL"));
    });
    mockPost.mockResolvedValue(makeCheckinResult({ fee: "0", is_promo: true }));

    render(<StaffCheckinPage />);

    await waitFor(() => {
      expect(screen.getByText("Friday Mixer")).toBeInTheDocument();
    });

    await userEvent.click(screen.getByRole("button", { name: /check in/i }));

    await waitFor(() => {
      expect(screen.getByText(/checked in/i)).toBeInTheDocument();
    });
    expect(screen.getByText(/promo/i)).toBeInTheDocument();
  });

  it("shows already checked in on 409 error", async () => {
    const { ApiError } = await import("@/lib/api-client");
    const member = makeMember();
    const event = makeEvent();
    mockGet.mockImplementation((url: string) => {
      if (url.includes("/staff/member/")) return Promise.resolve(member);
      if (url.includes("/staff/today-events")) return Promise.resolve([event]);
      return Promise.reject(new Error("Unknown URL"));
    });
    mockPost.mockRejectedValue(new ApiError("Already checked in", 409));

    render(<StaffCheckinPage />);

    await waitFor(() => {
      expect(screen.getByText("Friday Mixer")).toBeInTheDocument();
    });

    await userEvent.click(screen.getByRole("button", { name: /check in/i }));

    await waitFor(() => {
      expect(screen.getByText("Already Checked In")).toBeInTheDocument();
    });
  });

  it("shows error state on generic API failure", async () => {
    const member = makeMember();
    const event = makeEvent();
    mockGet.mockImplementation((url: string) => {
      if (url.includes("/staff/member/")) return Promise.resolve(member);
      if (url.includes("/staff/today-events")) return Promise.resolve([event]);
      return Promise.reject(new Error("Unknown URL"));
    });
    mockPost.mockRejectedValue(new Error("Network error"));

    render(<StaffCheckinPage />);

    await waitFor(() => {
      expect(screen.getByText("Friday Mixer")).toBeInTheDocument();
    });

    await userEvent.click(screen.getByRole("button", { name: /check in/i }));

    await waitFor(() => {
      expect(screen.getByText("Error")).toBeInTheDocument();
    });
  });

  it("selects first event by default", async () => {
    const member = makeMember();
    const events = [
      makeEvent({ id: "e1", title: "Morning Brunch" }),
      makeEvent({ id: "e2", title: "Evening Gala" }),
    ];
    mockGet.mockImplementation((url: string) => {
      if (url.includes("/staff/member/")) return Promise.resolve(member);
      if (url.includes("/staff/today-events")) return Promise.resolve(events);
      return Promise.reject(new Error("Unknown URL"));
    });
    mockPost.mockResolvedValue(makeCheckinResult());

    render(<StaffCheckinPage />);

    await waitFor(() => {
      expect(screen.getByText("Morning Brunch")).toBeInTheDocument();
    });

    await userEvent.click(screen.getByRole("button", { name: /check in/i }));

    await waitFor(() => {
      expect(mockPost).toHaveBeenCalledWith("/staff/checkin", {
        member_id: "member-uuid-1",
        event_id: "e1",
      });
    });
  });

  it("allows selecting a different event", async () => {
    const member = makeMember();
    const events = [
      makeEvent({ id: "e1", title: "Morning Brunch", ticket_price: "200.00" }),
      makeEvent({ id: "e2", title: "Evening Gala", ticket_price: "800.00" }),
    ];
    mockGet.mockImplementation((url: string) => {
      if (url.includes("/staff/member/")) return Promise.resolve(member);
      if (url.includes("/staff/today-events")) return Promise.resolve(events);
      return Promise.reject(new Error("Unknown URL"));
    });
    mockPost.mockResolvedValue(makeCheckinResult());

    render(<StaffCheckinPage />);

    await waitFor(() => {
      expect(screen.getByText("Evening Gala")).toBeInTheDocument();
    });

    // Click on the second event
    await userEvent.click(screen.getByText("Evening Gala"));

    await userEvent.click(screen.getByRole("button", { name: /check in/i }));

    await waitFor(() => {
      expect(mockPost).toHaveBeenCalledWith("/staff/checkin", {
        member_id: "member-uuid-1",
        event_id: "e2",
      });
    });
  });

  it("shows Scan Next button after successful checkin", async () => {
    const member = makeMember();
    const event = makeEvent();
    mockGet.mockImplementation((url: string) => {
      if (url.includes("/staff/member/")) return Promise.resolve(member);
      if (url.includes("/staff/today-events")) return Promise.resolve([event]);
      return Promise.reject(new Error("Unknown URL"));
    });
    mockPost.mockResolvedValue(makeCheckinResult());

    render(<StaffCheckinPage />);

    await waitFor(() => {
      expect(screen.getByText("Friday Mixer")).toBeInTheDocument();
    });

    await userEvent.click(screen.getByRole("button", { name: /check in/i }));

    await waitFor(() => {
      expect(screen.getByText(/checked in/i)).toBeInTheDocument();
    });

    const scanNextBtn = screen.getByRole("button", { name: /scan next/i });
    await userEvent.click(scanNextBtn);
    expect(mockPush).toHaveBeenCalledWith("/staff");
  });

  it("shows Scan Next button on already checked in state", async () => {
    const { ApiError } = await import("@/lib/api-client");
    const member = makeMember();
    const event = makeEvent();
    mockGet.mockImplementation((url: string) => {
      if (url.includes("/staff/member/")) return Promise.resolve(member);
      if (url.includes("/staff/today-events")) return Promise.resolve([event]);
      return Promise.reject(new Error("Unknown URL"));
    });
    mockPost.mockRejectedValue(new ApiError("Already checked in", 409));

    render(<StaffCheckinPage />);

    await waitFor(() => {
      expect(screen.getByText("Friday Mixer")).toBeInTheDocument();
    });

    await userEvent.click(screen.getByRole("button", { name: /check in/i }));

    await waitFor(() => {
      expect(screen.getByText("Already Checked In")).toBeInTheDocument();
    });

    const scanNextBtn = screen.getByRole("button", { name: /scan next/i });
    await userEvent.click(scanNextBtn);
    expect(mockPush).toHaveBeenCalledWith("/staff");
  });

  it("shows Scan Next button on member not found state", async () => {
    mockSearchParams.mockReturnValue(new URLSearchParams());
    render(<StaffCheckinPage />);

    await waitFor(() => {
      expect(screen.getByText(/member not found/i)).toBeInTheDocument();
    });

    const scanNextBtn = screen.getByRole("button", { name: /scan next/i });
    await userEvent.click(scanNextBtn);
    expect(mockPush).toHaveBeenCalledWith("/staff");
  });

  it("shows Scan Next button on error state", async () => {
    const member = makeMember();
    const event = makeEvent();
    mockGet.mockImplementation((url: string) => {
      if (url.includes("/staff/member/")) return Promise.resolve(member);
      if (url.includes("/staff/today-events")) return Promise.resolve([event]);
      return Promise.reject(new Error("Unknown URL"));
    });
    mockPost.mockRejectedValue(new Error("Network error"));

    render(<StaffCheckinPage />);

    await waitFor(() => {
      expect(screen.getByText("Friday Mixer")).toBeInTheDocument();
    });

    await userEvent.click(screen.getByRole("button", { name: /check in/i }));

    await waitFor(() => {
      expect(screen.getByText("Error")).toBeInTheDocument();
    });

    const scanNextBtn = screen.getByRole("button", { name: /scan next/i });
    await userEvent.click(scanNextBtn);
    expect(mockPush).toHaveBeenCalledWith("/staff");
  });
});
