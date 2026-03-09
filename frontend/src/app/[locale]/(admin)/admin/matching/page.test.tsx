import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import AdminMatchingPage from "./page";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => "/admin/matching",
  useParams: () => ({}),
  useSearchParams: () => ({ get: () => null }),
}));

const mockGet = vi.hoisted(() => vi.fn());
vi.mock("@/lib/api-client", () => ({
  apiClient: { get: mockGet },
  ApiError: class ApiError extends Error {
    name = "ApiError";
  },
}));

// window.open is called by handleIntroduce
vi.stubGlobal("open", vi.fn());

const makePair = (
  buyerName = "Finance Guy",
  sellerName = "Tech Founder",
  score = 1.5,
  mutual = 2,
) => ({
  buyer: {
    member_id: "buyer-uuid-1",
    full_name: buyerName,
    company_name: "VC Fund",
    industry: "finance",
    tier: "platinum",
    segments: ["Finance & Investors"],
  },
  seller: {
    member_id: "seller-uuid-1",
    full_name: sellerName,
    company_name: "StartupCo",
    industry: "tech",
    tier: "gold",
    segments: ["Tech & Founders"],
  },
  mutual_connections: mutual,
  score,
});

describe("AdminMatchingPage", () => {
  beforeEach(() => {
    mockGet.mockReset();
    vi.mocked(window.open).mockReset();
  });

  it("shows loading spinner initially", () => {
    mockGet.mockReturnValue(new Promise(() => {}));
    render(<AdminMatchingPage />);
    expect(document.querySelector(".animate-spin")).toBeInTheDocument();
  });

  it("shows empty state when no pairs found", async () => {
    mockGet.mockResolvedValue([]);
    render(<AdminMatchingPage />);

    await waitFor(() => {
      expect(document.querySelector(".animate-spin")).not.toBeInTheDocument();
    });

    expect(
      screen.getByText(/no deal-flow pairs available/i)
    ).toBeInTheDocument();
  });

  it("shows page heading", () => {
    mockGet.mockReturnValue(new Promise(() => {}));
    render(<AdminMatchingPage />);
    expect(screen.getByText("Smart Matching")).toBeInTheDocument();
  });

  it("renders pair cards with buyer and seller names", async () => {
    mockGet.mockResolvedValue([makePair("Alice Capital", "Bob Tech")]);
    render(<AdminMatchingPage />);

    await waitFor(() => {
      expect(screen.getByText("Alice Capital")).toBeInTheDocument();
    });
    expect(screen.getByText("Bob Tech")).toBeInTheDocument();
  });

  it("shows Buyer and Seller labels", async () => {
    mockGet.mockResolvedValue([makePair()]);
    render(<AdminMatchingPage />);

    await waitFor(() => {
      expect(screen.getByText("Buyer")).toBeInTheDocument();
    });
    expect(screen.getByText("Seller")).toBeInTheDocument();
  });

  it("shows formatted score", async () => {
    mockGet.mockResolvedValue([makePair("A", "B", 2.3)]);
    render(<AdminMatchingPage />);

    await waitFor(() => {
      expect(screen.getByText(/2\.3/)).toBeInTheDocument();
    });
  });

  it("shows mutual connections count when > 0", async () => {
    mockGet.mockResolvedValue([makePair("A", "B", 1.0, 3)]);
    render(<AdminMatchingPage />);

    await waitFor(() => {
      expect(screen.getByText(/3 mutual/i)).toBeInTheDocument();
    });
  });

  it("does not show mutual connections label when count is 0", async () => {
    mockGet.mockResolvedValue([makePair("A", "B", 1.0, 0)]);
    render(<AdminMatchingPage />);

    await waitFor(() => {
      expect(screen.getByText("A")).toBeInTheDocument();
    });
    expect(screen.queryByText(/0 mutual/i)).not.toBeInTheDocument();
  });

  it("shows Introduce button for each pair", async () => {
    mockGet.mockResolvedValue([makePair()]);
    render(<AdminMatchingPage />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /introduce/i })).toBeInTheDocument();
    });
  });

  it("Introduce button calls window.open with mailto link", async () => {
    mockGet.mockResolvedValue([makePair("Finance Guy", "Tech Founder")]);
    render(<AdminMatchingPage />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /introduce/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /introduce/i }));

    expect(window.open).toHaveBeenCalledTimes(1);
    const url = vi.mocked(window.open).mock.calls[0][0] as string;
    expect(url).toMatch(/^mailto:/);
    // encodeURIComponent encodes spaces as %20 (not +)
    expect(url).toContain("Finance%20Guy");
  });

  it("renders multiple pairs", async () => {
    mockGet.mockResolvedValue([
      makePair("Alice", "Bob", 2.0),
      makePair("Carol", "Dave", 1.5),
    ]);
    render(<AdminMatchingPage />);

    await waitFor(() => {
      expect(screen.getByText("Alice")).toBeInTheDocument();
    });
    expect(screen.getByText("Carol")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /introduce/i })).toHaveLength(2);
  });

  it("shows segment badges for buyer and seller", async () => {
    mockGet.mockResolvedValue([makePair()]);
    render(<AdminMatchingPage />);

    await waitFor(() => {
      expect(screen.getByText("Finance & Investors")).toBeInTheDocument();
    });
    expect(screen.getByText("Tech & Founders")).toBeInTheDocument();
  });

  it("shows company name for each side", async () => {
    mockGet.mockResolvedValue([makePair()]);
    render(<AdminMatchingPage />);

    await waitFor(() => {
      expect(screen.getByText("VC Fund")).toBeInTheDocument();
    });
    expect(screen.getByText("StartupCo")).toBeInTheDocument();
  });

  it("does not crash on API error", async () => {
    mockGet.mockRejectedValue(new Error("Network error"));
    render(<AdminMatchingPage />);

    await waitFor(() => {
      expect(document.querySelector(".animate-spin")).not.toBeInTheDocument();
    });

    // Empty state shown
    expect(
      screen.getByText(/no deal-flow pairs available/i)
    ).toBeInTheDocument();
  });
});
