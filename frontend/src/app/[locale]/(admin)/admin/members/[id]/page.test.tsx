import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import MemberDetailPage from "./page";

// Mock react-qr-code so jsdom doesn't choke on SVG rendering internals
vi.mock("react-qr-code", () => ({
  default: ({ value }: { value: string }) => (
    <div data-testid="qr-code" data-value={value} />
  ),
}));

const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush, replace: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => "/admin/members/member-uuid-1",
  useParams: () => ({ id: "member-uuid-1" }),
  useSearchParams: () => ({ get: () => null }),
}));

const mockGet = vi.hoisted(() => vi.fn());
const mockPatch = vi.hoisted(() => vi.fn());
const mockPost = vi.hoisted(() => vi.fn());
vi.mock("@/lib/api-client", () => ({
  apiClient: { get: mockGet, patch: mockPatch, post: mockPost },
  ApiError: class ApiError extends Error { name = "ApiError"; },
}));

const makeMember = (overrides = {}) => ({
  id: "member-uuid-1",
  email: "alice@example.com",
  full_name: "Alice Chen",
  company_name: "Acme Corp",
  user_type: "individual",
  tier: "gold",
  is_active: true,
  is_superuser: false,
  created_at: new Date().toISOString(),
  segment_groups: [],
  staff_notes: null,
  connections_count: 5,
  tab_total: 1500,
  service_requests_count: 3,
  recent_taps: [],
  interests: [],
  industry: null,
  revenue_range: null,
  phone: null,
  nfc_cards: [],
  ...overrides,
});

describe("MemberDetailPage", () => {
  beforeEach(() => {
    mockGet.mockReset();
    mockPatch.mockReset();
    mockPost.mockReset();
    mockPush.mockReset();
  });

  it("shows loading spinner initially", () => {
    mockGet.mockReturnValue(new Promise(() => {}));
    render(<MemberDetailPage />);
    expect(document.querySelector(".animate-spin")).toBeInTheDocument();
  });

  it("shows member not found when fetch returns null", async () => {
    mockGet.mockRejectedValue(new Error("Not Found"));
    render(<MemberDetailPage />);
    await waitFor(() => {
      expect(screen.getByText(/member not found/i)).toBeInTheDocument();
    });
  });

  it("renders member name, email and tier badge", async () => {
    mockGet.mockResolvedValue(makeMember());
    render(<MemberDetailPage />);
    await waitFor(() => {
      expect(screen.getByText("Alice Chen")).toBeInTheDocument();
    });
    expect(screen.getByText("alice@example.com")).toBeInTheDocument();
    expect(screen.getByText("gold")).toBeInTheDocument();
  });

  it("shows stat cards with connections, tab total, and service requests", async () => {
    mockGet.mockResolvedValue(makeMember({ connections_count: 7, tab_total: 2000, service_requests_count: 4 }));
    render(<MemberDetailPage />);
    await waitFor(() => {
      expect(screen.getByText("7")).toBeInTheDocument();
    });
    expect(screen.getByText("Connections")).toBeInTheDocument();
    expect(screen.getByText(/2,000/)).toBeInTheDocument();
    expect(screen.getByText("4")).toBeInTheDocument();
    expect(screen.getByText("Service Requests")).toBeInTheDocument();
  });

  it("shows no tap history when recent_taps is empty", async () => {
    mockGet.mockResolvedValue(makeMember({ recent_taps: [] }));
    render(<MemberDetailPage />);
    await waitFor(() => {
      expect(screen.getByText(/no tap history/i)).toBeInTheDocument();
    });
  });

  it("shows recent taps with tap type label", async () => {
    const tap = {
      id: "tap-uuid-1",
      tap_type: "venue_entry",
      card_id: "CARD-001",
      tapped_at: new Date().toISOString(),
      location: "Main entrance",
    };
    mockGet.mockResolvedValue(makeMember({ recent_taps: [tap] }));
    render(<MemberDetailPage />);
    await waitFor(() => {
      expect(screen.getByText("venue entry")).toBeInTheDocument();
    });
    expect(screen.getByText("Main entrance")).toBeInTheDocument();
  });

  it("pre-fills staff notes textarea from member data", async () => {
    mockGet.mockResolvedValue(makeMember({ staff_notes: "VIP guest, prefers booth" }));
    render(<MemberDetailPage />);
    await waitFor(() => {
      expect(screen.getByDisplayValue("VIP guest, prefers booth")).toBeInTheDocument();
    });
  });

  it("calls PATCH when Save Notes clicked", async () => {
    mockGet.mockResolvedValue(makeMember({ staff_notes: "" }));
    mockPatch.mockResolvedValue({});
    render(<MemberDetailPage />);
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /save notes/i })).toBeInTheDocument();
    });
    const textarea = screen.getByPlaceholderText(/add internal notes/i);
    await userEvent.clear(textarea);
    await userEvent.type(textarea, "New note");
    await userEvent.click(screen.getByRole("button", { name: /save notes/i }));
    expect(mockPatch).toHaveBeenCalledWith(
      "/admin/members/member-uuid-1/notes",
      { notes: "New note" }
    );
  });

  it("navigates back to members list on Back button click", async () => {
    mockGet.mockResolvedValue(makeMember());
    render(<MemberDetailPage />);
    await waitFor(() => {
      expect(screen.getByText("Alice Chen")).toBeInTheDocument();
    });
    await userEvent.click(screen.getByRole("button", { name: /members/i }));
    expect(mockPush).toHaveBeenCalledWith("/admin/members");
  });

  // ── Edit Profile ───────────────────────────────────────────────────────────

  it("shows Edit Profile button when member is loaded", async () => {
    mockGet.mockResolvedValue(makeMember());
    render(<MemberDetailPage />);
    await waitFor(() => {
      expect(screen.getByText("Alice Chen")).toBeInTheDocument();
    });
    expect(screen.getByRole("button", { name: /edit profile/i })).toBeInTheDocument();
  });

  it("clicking Edit Profile button opens the edit form", async () => {
    mockGet.mockResolvedValue(makeMember());
    render(<MemberDetailPage />);
    await waitFor(() => {
      expect(screen.getByText("Alice Chen")).toBeInTheDocument();
    });
    await userEvent.click(screen.getByRole("button", { name: /edit profile/i }));
    // Form fields should appear
    expect(screen.getByDisplayValue("Alice Chen")).toBeInTheDocument();
    expect(screen.getByDisplayValue("alice@example.com")).toBeInTheDocument();
  });

  it("edit form pre-fills company name when present", async () => {
    mockGet.mockResolvedValue(makeMember({ company_name: "Acme Corp" }));
    render(<MemberDetailPage />);
    await waitFor(() => {
      expect(screen.getByText("Alice Chen")).toBeInTheDocument();
    });
    await userEvent.click(screen.getByRole("button", { name: /edit profile/i }));
    expect(screen.getByDisplayValue("Acme Corp")).toBeInTheDocument();
  });

  it("clicking Cancel in edit form closes the form", async () => {
    mockGet.mockResolvedValue(makeMember());
    render(<MemberDetailPage />);
    await waitFor(() => {
      expect(screen.getByText("Alice Chen")).toBeInTheDocument();
    });
    await userEvent.click(screen.getByRole("button", { name: /edit profile/i }));
    // Form is open — full_name input present
    expect(screen.getByDisplayValue("Alice Chen")).toBeInTheDocument();
    // The first cancel button in the form (not the toggle button)
    const cancelBtns = screen.getAllByRole("button", { name: /cancel/i });
    await userEvent.click(cancelBtns[cancelBtns.length - 1]);
    // Form should be gone
    expect(screen.queryByDisplayValue("Alice Chen")).not.toBeInTheDocument();
  });

  it("Save Profile calls PATCH with updated data", async () => {
    mockGet.mockResolvedValue(makeMember());
    mockPatch.mockResolvedValue(makeMember({ full_name: "Alice Updated" }));
    render(<MemberDetailPage />);
    await waitFor(() => {
      expect(screen.getByText("Alice Chen")).toBeInTheDocument();
    });
    await userEvent.click(screen.getByRole("button", { name: /edit profile/i }));

    // Clear and retype full_name
    const nameInput = screen.getByDisplayValue("Alice Chen");
    await userEvent.clear(nameInput);
    await userEvent.type(nameInput, "Alice Updated");

    await userEvent.click(screen.getByRole("button", { name: /save changes/i }));

    await waitFor(() => {
      expect(mockPatch).toHaveBeenCalledWith(
        "/admin/members/member-uuid-1",
        expect.objectContaining({ full_name: "Alice Updated" })
      );
    });
  });

  // ── NFC QR Code ────────────────────────────────────────────────────────────

  it("shows Entry QR for every member", async () => {
    mockGet.mockResolvedValue(makeMember({ nfc_cards: [] }));
    render(<MemberDetailPage />);
    await waitFor(() => {
      expect(screen.getByText("Alice Chen")).toBeInTheDocument();
    });
    const qrCodes = screen.getAllByTestId("qr-code");
    const entryQr = qrCodes.find((el) =>
      el.getAttribute("data-value")?.includes("/staff/checkin?member="),
    );
    expect(entryQr).toBeDefined();
  });

  it("does not show NFC QR section when member has no NFC cards", async () => {
    mockGet.mockResolvedValue(makeMember({ nfc_cards: [] }));
    render(<MemberDetailPage />);
    await waitFor(() => {
      expect(screen.getByText("Alice Chen")).toBeInTheDocument();
    });
    const qrCodes = screen.getAllByTestId("qr-code");
    const nfcQr = qrCodes.find((el) =>
      el.getAttribute("data-value")?.includes("/tap?cid="),
    );
    expect(nfcQr).toBeUndefined();
  });

  it("shows NFC QR code when member has an NFC card", async () => {
    const nfcCards = [{ card_id: "RD-NFC-001", status: "active", tier_at_issue: "gold" }];
    mockGet.mockResolvedValue(makeMember({ nfc_cards: nfcCards }));
    render(<MemberDetailPage />);
    await waitFor(() => {
      expect(screen.getByText("Alice Chen")).toBeInTheDocument();
    });
    const qrCodes = screen.getAllByTestId("qr-code");
    const nfcQr = qrCodes.find((el) =>
      el.getAttribute("data-value")?.includes("/tap?cid="),
    );
    expect(nfcQr).toBeDefined();
  });

  it("NFC QR code encodes the /tap?cid= URL", async () => {
    const nfcCards = [{ card_id: "RD-NFC-001", status: "active", tier_at_issue: "gold" }];
    mockGet.mockResolvedValue(makeMember({ nfc_cards: nfcCards }));
    render(<MemberDetailPage />);
    await waitFor(() => {
      expect(screen.getByText("Alice Chen")).toBeInTheDocument();
    });
    const qrCodes = screen.getAllByTestId("qr-code");
    const nfcQr = qrCodes.find((el) =>
      el.getAttribute("data-value")?.includes("/tap?cid=RD-NFC-001"),
    );
    expect(nfcQr).toBeDefined();
  });

  it("shows card_id text alongside the QR code", async () => {
    const nfcCards = [{ card_id: "RD-NFC-001", status: "active", tier_at_issue: "gold" }];
    mockGet.mockResolvedValue(makeMember({ nfc_cards: nfcCards }));
    render(<MemberDetailPage />);
    await waitFor(() => {
      expect(screen.getByText("RD-NFC-001")).toBeInTheDocument();
    });
  });

  // ── Promoter Stats ────────────────────────────────────────────────────────

  it("shows promoter stat cards when member is a promoter with stats", async () => {
    mockGet.mockResolvedValue(makeMember({
      user_type: "promoter",
      promoter_stats: {
        total_codes: 2,
        total_uses: 15,
        total_revenue: 5000,
        commission_earned: 2500,
        pending_payout: 500,
      },
    }));
    render(<MemberDetailPage />);
    await waitFor(() => {
      expect(screen.getByText("Total Codes")).toBeInTheDocument();
    });
    expect(screen.getByText("2")).toBeInTheDocument();
    expect(screen.getByText("15")).toBeInTheDocument();
    expect(screen.getByText("Conversions")).toBeInTheDocument();
  });

  it("shows regular stat cards when member is not a promoter", async () => {
    mockGet.mockResolvedValue(makeMember({ user_type: "member" }));
    render(<MemberDetailPage />);
    await waitFor(() => {
      expect(screen.getByText("Connections")).toBeInTheDocument();
    });
    expect(screen.getByText("Total Spent")).toBeInTheDocument();
    expect(screen.queryByText("Total Codes")).not.toBeInTheDocument();
  });

  // ── Promoter QR Code Section ──────────────────────────────────────────────

  it("shows promoter QR code section with code when promoter has codes", async () => {
    mockGet.mockResolvedValue(makeMember({
      user_type: "promoter",
      is_promoter: true,
      promoter_stats: { total_codes: 1, total_uses: 3, total_revenue: 1000, commission_earned: 500, pending_payout: 0 },
      promoter_codes: [{
        id: "code-uuid-1",
        code: "VIP2026",
        tier_grant: null,
        quota: 0,
        uses_count: 3,
        revenue_attributed: 1000,
        commission_rate: 0.5,
        is_active: true,
        created_at: new Date().toISOString(),
      }],
    }));
    render(<MemberDetailPage />);
    await waitFor(() => {
      expect(screen.getByText("Promoter QR Code")).toBeInTheDocument();
    });
    expect(screen.getByText("VIP2026")).toBeInTheDocument();
    // QR code rendered
    const qrCodes = screen.getAllByTestId("qr-code");
    const promoQr = qrCodes.find(el => el.getAttribute("data-value")?.includes("qr-register?promo=VIP2026"));
    expect(promoQr).toBeTruthy();
  });

  it("shows 'no code' state with generate form when promoter has no codes", async () => {
    mockGet.mockResolvedValue(makeMember({
      user_type: "promoter",
      is_promoter: true,
      promoter_stats: { total_codes: 0, total_uses: 0, total_revenue: 0, commission_earned: 0, pending_payout: 0 },
      promoter_codes: [],
    }));
    render(<MemberDetailPage />);
    await waitFor(() => {
      expect(screen.getByText("Promoter QR Code")).toBeInTheDocument();
    });
    expect(screen.getByText(/hasn't generated a QR code/i)).toBeInTheDocument();
    expect(screen.getByText("Generate")).toBeInTheDocument();
  });

  it("does not show promoter QR section for non-promoter members", async () => {
    mockGet.mockResolvedValue(makeMember({ user_type: "member", is_promoter: false }));
    render(<MemberDetailPage />);
    await waitFor(() => {
      expect(screen.getByText("Alice Chen")).toBeInTheDocument();
    });
    expect(screen.queryByText("Promoter QR Code")).not.toBeInTheDocument();
  });

  it("calls POST to generate a promo code when Generate button clicked", async () => {
    const member = makeMember({
      user_type: "promoter",
      is_promoter: true,
      promoter_stats: { total_codes: 0, total_uses: 0, total_revenue: 0, commission_earned: 0, pending_payout: 0 },
      promoter_codes: [],
    });
    mockGet.mockResolvedValue(member);
    mockPost.mockResolvedValue({});
    render(<MemberDetailPage />);
    await waitFor(() => {
      expect(screen.getByText("Generate")).toBeInTheDocument();
    });
    // Type code name
    const input = screen.getByPlaceholderText("CODE NAME");
    await userEvent.type(input, "NEWCODE");
    // Re-mock get for re-fetch after generate
    mockGet.mockResolvedValue({ ...member, promoter_codes: [{ id: "new-id", code: "NEWCODE", uses_count: 0, revenue_attributed: 0, is_active: true, created_at: new Date().toISOString() }] });
    await userEvent.click(screen.getByText("Generate"));
    await waitFor(() => {
      expect(mockPost).toHaveBeenCalledWith("/admin/promo-codes", expect.objectContaining({
        code: "NEWCODE",
        promoter_id: "member-uuid-1",
      }));
    });
  });

  // ── Staff Role Management ──────────────────────────────────────────────

  it("shows Make Staff button for non-admin members", async () => {
    mockGet.mockResolvedValue(makeMember({ role: "user" }));
    render(<MemberDetailPage />);
    await waitFor(() => {
      expect(screen.getByText(/make staff/i)).toBeInTheDocument();
    });
  });

  it("shows Revoke Staff button for staff members", async () => {
    mockGet.mockResolvedValue(makeMember({ role: "staff" }));
    render(<MemberDetailPage />);
    await waitFor(() => {
      expect(screen.getByText(/revoke staff/i)).toBeInTheDocument();
    });
  });

  it("does not show staff button for admin members", async () => {
    mockGet.mockResolvedValue(makeMember({ role: "admin" }));
    render(<MemberDetailPage />);
    await waitFor(() => {
      expect(screen.getByText("Alice Chen")).toBeInTheDocument();
    });
    expect(screen.queryByText(/make staff/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/revoke staff/i)).not.toBeInTheDocument();
  });

  it("calls make-staff API when Make Staff is clicked", async () => {
    const member = makeMember({ role: "user" });
    mockGet
      .mockResolvedValueOnce(member)
      .mockResolvedValueOnce(makeMember({ role: "staff" }));
    mockPost.mockResolvedValue({ ok: true });

    render(<MemberDetailPage />);
    await waitFor(() => {
      expect(screen.getByText(/make staff/i)).toBeInTheDocument();
    });

    await userEvent.click(screen.getByText(/make staff/i));

    await waitFor(() => {
      expect(mockPost).toHaveBeenCalledWith(
        "/admin/members/member-uuid-1/make-staff",
        {}
      );
    });
  });

  it("calls revoke-staff API when Revoke Staff is clicked", async () => {
    const member = makeMember({ role: "staff" });
    mockGet
      .mockResolvedValueOnce(member)
      .mockResolvedValueOnce(makeMember({ role: "user" }));
    mockPost.mockResolvedValue({ ok: true });

    render(<MemberDetailPage />);
    await waitFor(() => {
      expect(screen.getByText(/revoke staff/i)).toBeInTheDocument();
    });

    await userEvent.click(screen.getByText(/revoke staff/i));

    await waitFor(() => {
      expect(mockPost).toHaveBeenCalledWith(
        "/admin/members/member-uuid-1/revoke-staff",
        {}
      );
    });
  });

  it("shows tier dropdown with platinum and vip in edit form", async () => {
    mockGet.mockResolvedValue(makeMember());
    render(<MemberDetailPage />);
    await waitFor(() => {
      expect(screen.getByText("Alice Chen")).toBeInTheDocument();
    });
    await userEvent.click(screen.getByRole("button", { name: /edit profile/i }));
    const tierSelect = document.querySelector("select") as HTMLSelectElement;
    const options = Array.from(tierSelect.options).map((o) => o.value);
    expect(options).toContain("platinum");
    expect(options).toContain("vip");
  });

  it("shows rename input when pencil icon clicked on promoter code", async () => {
    mockGet.mockResolvedValue(makeMember({
      user_type: "promoter",
      is_promoter: true,
      promoter_stats: { total_codes: 1, total_uses: 0, total_revenue: 0, commission_earned: 0, pending_payout: 0 },
      promoter_codes: [{
        id: "code-uuid-1",
        code: "OLDCODE",
        tier_grant: null,
        quota: 0,
        uses_count: 0,
        revenue_attributed: 0,
        commission_rate: 0.5,
        is_active: true,
        created_at: new Date().toISOString(),
      }],
    }));
    render(<MemberDetailPage />);
    await waitFor(() => {
      expect(screen.getByText("OLDCODE")).toBeInTheDocument();
    });
    // The pencil button is the small ghost button next to "OLDCODE" text
    // It's within the same flex container as the code name
    const codeText = screen.getByText("OLDCODE");
    const container = codeText.closest("div");
    const pencilBtn = container?.querySelector("button");
    expect(pencilBtn).toBeTruthy();
    await userEvent.click(pencilBtn!);
    // Rename input should appear with current code value
    await waitFor(() => {
      expect(screen.getByDisplayValue("OLDCODE")).toBeInTheDocument();
    });
  });
});
