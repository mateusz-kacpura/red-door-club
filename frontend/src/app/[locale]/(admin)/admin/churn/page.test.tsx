import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import AdminChurnPage from "./page";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => "/admin/churn",
  useParams: () => ({}),
  useSearchParams: () => ({ get: () => null }),
}));

vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: React.PropsWithChildren<{ href: string }>) => (
    <a href={href} {...props}>{children}</a>
  ),
}));

const mockGet = vi.hoisted(() => vi.fn());
vi.mock("@/lib/api-client", () => ({
  apiClient: { get: mockGet },
  ApiError: class ApiError extends Error {
    name = "ApiError";
  },
}));

const makeOverview = (overrides: Partial<Record<string, unknown>> = {}) => ({
  retention_rate_30d: 85.0,
  avg_churn_score: 18.5,
  total_members: 40,
  active_30d: 34,
  risk_distribution: {
    healthy: 28,
    low: 6,
    medium: 4,
    high: 2,
    critical: 0,
  },
  at_risk_members: [],
  ...overrides,
});

let _memberCounter = 0;
const makeAtRiskMember = (
  name = "Absent Member",
  score = 65,
  risk = "high",
  lastSeen: string | null = "2025-12-01T12:00:00Z",
) => ({
  member_id: `member-uuid-${++_memberCounter}`,
  full_name: name,
  tier: "silver",
  company_name: "OldCo",
  churn_score: score,
  risk_level: risk,
  last_seen_at: lastSeen,
  primary_risk_factor: "Last seen 75d ago",
});

describe("AdminChurnPage", () => {
  beforeEach(() => {
    mockGet.mockReset();
  });

  it("shows loading spinner initially", () => {
    mockGet.mockReturnValue(new Promise(() => {}));
    render(<AdminChurnPage />);
    expect(document.querySelector(".animate-spin")).toBeInTheDocument();
  });

  it("shows error state when API fails", async () => {
    mockGet.mockRejectedValue(new Error("Server error"));
    render(<AdminChurnPage />);

    await waitFor(() => {
      expect(screen.getByText(/failed to load churn data/i)).toBeInTheDocument();
    });
  });

  it("shows page heading after data loads", async () => {
    mockGet.mockResolvedValue(makeOverview());
    render(<AdminChurnPage />);

    await waitFor(() => {
      expect(screen.getByText("Churn Risk Analytics")).toBeInTheDocument();
    });
  });

  it("shows retention rate card", async () => {
    mockGet.mockResolvedValue(makeOverview({ retention_rate_30d: 85.0 }));
    render(<AdminChurnPage />);

    await waitFor(() => {
      expect(screen.getByText("85%")).toBeInTheDocument();
    });
    expect(screen.getByText(/retention rate/i)).toBeInTheDocument();
  });

  it("shows active / total member count", async () => {
    mockGet.mockResolvedValue(makeOverview({ active_30d: 34, total_members: 40 }));
    render(<AdminChurnPage />);

    await waitFor(() => {
      expect(screen.getByText("34 / 40 members")).toBeInTheDocument();
    });
  });

  it("shows average risk score card", async () => {
    mockGet.mockResolvedValue(makeOverview({ avg_churn_score: 18.5 }));
    render(<AdminChurnPage />);

    await waitFor(() => {
      expect(screen.getByText("18.5")).toBeInTheDocument();
    });
    expect(screen.getByText(/avg churn score/i)).toBeInTheDocument();
  });

  it("shows critical count card", async () => {
    mockGet.mockResolvedValue(
      makeOverview({ risk_distribution: { healthy: 10, low: 5, medium: 3, high: 2, critical: 1 } })
    );
    render(<AdminChurnPage />);

    await waitFor(() => {
      expect(screen.getByText("Critical")).toBeInTheDocument();
    });
    // The critical count value — multiple "1"s may exist; ensure at least one present
    const criticalSection = screen.getByText("Critical").closest("div")!.parentElement!;
    expect(criticalSection.textContent).toContain("1");
  });

  it("shows healthy count card", async () => {
    mockGet.mockResolvedValue(
      makeOverview({ risk_distribution: { healthy: 28, low: 6, medium: 4, high: 2, critical: 0 } })
    );
    render(<AdminChurnPage />);

    await waitFor(() => {
      expect(screen.getAllByText("Healthy").length).toBeGreaterThan(0);
    });
  });

  it("shows empty at-risk message when no members at risk", async () => {
    mockGet.mockResolvedValue(makeOverview({ at_risk_members: [] }));
    render(<AdminChurnPage />);

    await waitFor(() => {
      expect(screen.getByText(/no at-risk members/i)).toBeInTheDocument();
    });
  });

  it("renders at-risk member name and company", async () => {
    mockGet.mockResolvedValue(
      makeOverview({
        at_risk_members: [makeAtRiskMember("John Ghost", 70, "high")],
      })
    );
    render(<AdminChurnPage />);

    await waitFor(() => {
      expect(screen.getByText("John Ghost")).toBeInTheDocument();
    });
    expect(screen.getByText("OldCo")).toBeInTheDocument();
  });

  it("renders churn score value in table row", async () => {
    mockGet.mockResolvedValue(
      makeOverview({
        at_risk_members: [makeAtRiskMember("Jane Risk", 75, "high")],
      })
    );
    render(<AdminChurnPage />);

    await waitFor(() => {
      expect(screen.getByText("Jane Risk")).toBeInTheDocument();
    });
    expect(screen.getByText("75")).toBeInTheDocument();
  });

  it("renders primary risk factor text", async () => {
    mockGet.mockResolvedValue(
      makeOverview({
        at_risk_members: [makeAtRiskMember("Ghost Member", 65, "high")],
      })
    );
    render(<AdminChurnPage />);

    await waitFor(() => {
      expect(screen.getByText("Last seen 75d ago")).toBeInTheDocument();
    });
  });

  it("renders multiple at-risk members", async () => {
    mockGet.mockResolvedValue(
      makeOverview({
        at_risk_members: [
          makeAtRiskMember("Alice At-Risk", 80, "critical"),
          makeAtRiskMember("Bob At-Risk", 55, "medium"),
        ],
      })
    );
    render(<AdminChurnPage />);

    await waitFor(() => {
      expect(screen.getByText("Alice At-Risk")).toBeInTheDocument();
    });
    expect(screen.getByText("Bob At-Risk")).toBeInTheDocument();
  });

  it("shows 'Never' when last_seen_at is null", async () => {
    mockGet.mockResolvedValue(
      makeOverview({
        at_risk_members: [makeAtRiskMember("Ghost", 60, "medium", null)],
      })
    );
    render(<AdminChurnPage />);

    await waitFor(() => {
      expect(screen.getByText("Never")).toBeInTheDocument();
    });
  });

  it("member name is a link to admin member detail", async () => {
    const member = makeAtRiskMember();
    mockGet.mockResolvedValue(
      makeOverview({ at_risk_members: [member] })
    );
    render(<AdminChurnPage />);

    await waitFor(() => {
      const link = screen.getByRole("link", { name: /absent member/i });
      expect(link).toBeInTheDocument();
      expect(link.getAttribute("href")).toContain(`/admin/members/${member.member_id}`);
    });
  });

  it("shows 'out of 100' sub-label under avg score", async () => {
    mockGet.mockResolvedValue(makeOverview());
    render(<AdminChurnPage />);

    await waitFor(() => {
      expect(screen.getByText("out of 100")).toBeInTheDocument();
    });
  });
});
