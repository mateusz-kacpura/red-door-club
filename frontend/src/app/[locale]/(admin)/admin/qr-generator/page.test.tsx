import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import AdminQrGeneratorPage from "./page";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => "/admin/qr-generator",
  useParams: () => ({}),
  useSearchParams: () => ({ get: () => null }),
}));

// Mock react-qr-code so jsdom doesn't choke on canvas/SVG rendering internals
vi.mock("react-qr-code", () => ({
  default: ({ value }: { value: string }) => (
    <div data-testid="qr-code" data-value={value} />
  ),
}));

const mockGet = vi.hoisted(() => vi.fn());
const mockPost = vi.hoisted(() => vi.fn());
vi.mock("@/lib/api-client", () => ({
  apiClient: { get: mockGet, post: mockPost },
  ApiError: class ApiError extends Error {
    name = "ApiError";
  },
}));

// Mock global fetch for PDF download
const mockFetch = vi.hoisted(() => vi.fn());
vi.stubGlobal("fetch", mockFetch);

// Mock URL.createObjectURL / revokeObjectURL
vi.stubGlobal("URL", {
  createObjectURL: vi.fn(() => "blob:mock"),
  revokeObjectURL: vi.fn(),
});

// ── Helpers ──────────────────────────────────────────────────────────────────

let _batchCounter = 0;
const makeBatch = (overrides: Partial<Record<string, unknown>> = {}) => ({
  id: `batch-uuid-${++_batchCounter}`,
  promoter_id: null,
  promo_code: null,
  tier: "silver",
  count: 10,
  prefix: "RD-",
  notes: null,
  created_at: "2026-03-09T10:00:00Z",
  conversion_rate: 0.0,
  converted_count: 0,
  ...overrides,
});

let _codeCounter = 0;
const makeCode = (passId: string, converted = false) => ({
  id: `code-uuid-${++_codeCounter}`,
  batch_id: "batch-uuid-1",
  pass_id: passId,
  converted_at: converted ? "2026-03-09T12:00:00Z" : null,
});

const makePromoter = (name = "Alice Promoter", id = "promoter-uuid-1") => ({
  promoter_id: id,
  full_name: name,
  email: `${name.toLowerCase().replace(" ", ".")}@example.com`,
});

// Default: get() is called with two paths — /admin/qr-batches and /admin/promoters
const setupMocks = (
  batches: ReturnType<typeof makeBatch>[] = [],
  promoters: ReturnType<typeof makePromoter>[] = [],
) => {
  mockGet.mockImplementation((path: string) => {
    if (path === "/admin/qr-batches") return Promise.resolve(batches);
    if (path === "/admin/promoters") return Promise.resolve(promoters);
    return Promise.resolve([]);
  });
};

describe("AdminQrGeneratorPage", () => {
  beforeEach(() => {
    mockGet.mockReset();
    mockPost.mockReset();
    mockFetch.mockReset();
    _batchCounter = 0;
    _codeCounter = 0;
  });

  // ── Loading & empty states ─────────────────────────────────────────────────

  it("shows loading spinner initially", () => {
    mockGet.mockReturnValue(new Promise(() => {}));
    render(<AdminQrGeneratorPage />);
    expect(document.querySelector(".animate-spin")).toBeInTheDocument();
  });

  it("shows empty state when no batches exist", async () => {
    setupMocks([]);
    render(<AdminQrGeneratorPage />);

    await waitFor(() => {
      expect(screen.getByText("No batches generated yet.")).toBeInTheDocument();
    });
  });

  // ── Batch list rendering ───────────────────────────────────────────────────

  it("shows page heading with batch count", async () => {
    setupMocks([makeBatch(), makeBatch()]);
    render(<AdminQrGeneratorPage />);

    await waitFor(() => {
      expect(screen.getByText(/QR Generator/)).toBeInTheDocument();
    });
    // totalBatches with count=2
    expect(screen.getByText("2 batches")).toBeInTheDocument();
  });

  it("renders batch card showing prefix and count", async () => {
    setupMocks([makeBatch({ prefix: "VIP-", count: 25 })]);
    render(<AdminQrGeneratorPage />);

    await waitFor(() => {
      expect(screen.getByText(/VIP-.*×.*25/)).toBeInTheDocument();
    });
  });

  it("renders tier badge on batch card", async () => {
    setupMocks([makeBatch({ tier: "gold" })]);
    render(<AdminQrGeneratorPage />);

    await waitFor(() => {
      expect(screen.getByText("gold")).toBeInTheDocument();
    });
  });

  it("renders promo_code badge when promo code is set", async () => {
    setupMocks([makeBatch({ promo_code: "PRO-07" })]);
    render(<AdminQrGeneratorPage />);

    await waitFor(() => {
      expect(screen.getByText("PRO-07")).toBeInTheDocument();
    });
  });

  it("does not render promo code badge when promo_code is null", async () => {
    setupMocks([makeBatch({ promo_code: null })]);
    render(<AdminQrGeneratorPage />);

    await waitFor(() => {
      // Tier badge is present, but no promo code span
      expect(screen.getByText("silver")).toBeInTheDocument();
    });
    expect(screen.queryByText(/PRO-/)).not.toBeInTheDocument();
  });

  it("renders conversion stats — count and rate", async () => {
    setupMocks([makeBatch({ count: 20, converted_count: 5, conversion_rate: 0.25 })]);
    render(<AdminQrGeneratorPage />);

    await waitFor(() => {
      expect(screen.getByText(/5\/20/)).toBeInTheDocument();
    });
    expect(screen.getByText(/25%/)).toBeInTheDocument();
  });

  it("renders batch notes when present", async () => {
    setupMocks([makeBatch({ notes: "VIP event 2026" })]);
    render(<AdminQrGeneratorPage />);

    await waitFor(() => {
      expect(screen.getByText("VIP event 2026")).toBeInTheDocument();
    });
  });

  it("does not show notes element when notes is null", async () => {
    setupMocks([makeBatch({ notes: null })]);
    render(<AdminQrGeneratorPage />);

    await waitFor(() => {
      expect(screen.getByText(/RD-.*×.*10/)).toBeInTheDocument();
    });
    expect(screen.queryByText("VIP event 2026")).not.toBeInTheDocument();
  });

  it("renders multiple batch cards", async () => {
    setupMocks([
      makeBatch({ prefix: "RD-", tier: "silver" }),
      makeBatch({ prefix: "VIP-", tier: "gold" }),
    ]);
    render(<AdminQrGeneratorPage />);

    await waitFor(() => {
      expect(screen.getByText(/RD-.*×.*10/)).toBeInTheDocument();
    });
    expect(screen.getByText(/VIP-.*×.*10/)).toBeInTheDocument();
  });

  // ── Form ──────────────────────────────────────────────────────────────────

  it("form is hidden on initial render", async () => {
    setupMocks([]);
    render(<AdminQrGeneratorPage />);

    await waitFor(() => {
      expect(screen.queryByText("New Batch")).toBeInTheDocument();
    });
    // The form fields should not be visible until button is clicked
    expect(screen.queryByLabelText("Tier")).not.toBeInTheDocument();
  });

  it("form appears after clicking New Batch button", async () => {
    setupMocks([]);
    render(<AdminQrGeneratorPage />);

    await waitFor(() => {
      expect(screen.getByText("New Batch")).toBeInTheDocument();
    });

    fireEvent.click(screen.getAllByText("New Batch")[0]);

    await waitFor(() => {
      expect(screen.getByText("Tier")).toBeInTheDocument();
    });
  });

  it("form closes after clicking Cancel", async () => {
    setupMocks([]);
    render(<AdminQrGeneratorPage />);

    await waitFor(() => {
      fireEvent.click(screen.getAllByText("New Batch")[0]);
    });

    await waitFor(() => {
      expect(screen.getByText("Tier")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Cancel"));

    await waitFor(() => {
      expect(screen.queryByText("Tier")).not.toBeInTheDocument();
    });
  });

  it("submitting form calls POST and refreshes batch list", async () => {
    const newBatch = makeBatch({ tier: "gold", count: 5, prefix: "RD-" });
    mockPost.mockResolvedValue(newBatch);

    // First call: empty list, second: returns new batch
    let callCount = 0;
    mockGet.mockImplementation((path: string) => {
      if (path === "/admin/promoters") return Promise.resolve([]);
      if (path === "/admin/qr-batches") {
        callCount++;
        return Promise.resolve(callCount === 1 ? [] : [newBatch]);
      }
      return Promise.resolve([]);
    });

    render(<AdminQrGeneratorPage />);

    await waitFor(() => {
      fireEvent.click(screen.getAllByText("New Batch")[0]);
    });

    await waitFor(() => {
      expect(screen.getByText("Generate Batch")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Generate Batch"));

    await waitFor(() => {
      expect(mockPost).toHaveBeenCalledWith(
        "/admin/qr-batches",
        expect.objectContaining({ tier: "silver", prefix: "RD-" }),
      );
    });
  });

  it("form shows error message on failed submit", async () => {
    const { ApiError } = await import("@/lib/api-client");
    mockPost.mockRejectedValue(new ApiError("Batch creation failed"));
    setupMocks([]);

    render(<AdminQrGeneratorPage />);

    await waitFor(() => {
      fireEvent.click(screen.getAllByText("New Batch")[0]);
    });

    await waitFor(() => {
      expect(screen.getByText("Generate Batch")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Generate Batch"));

    await waitFor(() => {
      expect(screen.getByText("Batch creation failed")).toBeInTheDocument();
    });
  });

  // ── Preview panel ─────────────────────────────────────────────────────────

  it("clicking Preview fetches batch detail and shows QR codes", async () => {
    const batch = makeBatch({ id: "batch-uuid-preview" });
    const detail = {
      ...batch,
      codes: [
        makeCode("RD-000001"),
        makeCode("RD-000002"),
        makeCode("RD-000003", true),
      ],
    };

    mockGet.mockImplementation((path: string) => {
      if (path === "/admin/qr-batches") return Promise.resolve([batch]);
      if (path === "/admin/promoters") return Promise.resolve([]);
      if (path === "/admin/qr-batches/batch-uuid-preview") return Promise.resolve(detail);
      return Promise.resolve([]);
    });

    render(<AdminQrGeneratorPage />);

    await waitFor(() => {
      expect(screen.getAllByText("Preview").length).toBeGreaterThan(0);
    });

    fireEvent.click(screen.getAllByText("Preview")[0]);

    await waitFor(() => {
      expect(screen.getAllByTestId("qr-code").length).toBeGreaterThan(0);
    });
  });

  it("clicking Preview again hides the preview panel", async () => {
    const batch = makeBatch({ id: "batch-uuid-toggle" });
    const detail = { ...batch, codes: [makeCode("RD-000001")] };

    mockGet.mockImplementation((path: string) => {
      if (path === "/admin/qr-batches") return Promise.resolve([batch]);
      if (path === "/admin/promoters") return Promise.resolve([]);
      if (path === "/admin/qr-batches/batch-uuid-toggle") return Promise.resolve(detail);
      return Promise.resolve([]);
    });

    render(<AdminQrGeneratorPage />);

    await waitFor(() => {
      fireEvent.click(screen.getAllByText("Preview")[0]);
    });

    // Wait for QR codes to appear
    await waitFor(() => {
      expect(screen.queryAllByTestId("qr-code").length).toBeGreaterThan(0);
    });

    // Click again to close
    fireEvent.click(screen.getAllByText("Preview")[0]);

    await waitFor(() => {
      expect(screen.queryAllByTestId("qr-code").length).toBe(0);
    });
  });

  it("preview shows pass_id for each code", async () => {
    const batch = makeBatch({ id: "batch-uuid-passids" });
    const detail = {
      ...batch,
      codes: [makeCode("RD-000011"), makeCode("RD-000012")],
    };

    mockGet.mockImplementation((path: string) => {
      if (path === "/admin/qr-batches") return Promise.resolve([batch]);
      if (path === "/admin/promoters") return Promise.resolve([]);
      if (path.includes("batch-uuid-passids")) return Promise.resolve(detail);
      return Promise.resolve([]);
    });

    render(<AdminQrGeneratorPage />);

    await waitFor(() => {
      fireEvent.click(screen.getAllByText("Preview")[0]);
    });

    await waitFor(() => {
      expect(screen.getByText("RD-000011")).toBeInTheDocument();
      expect(screen.getByText("RD-000012")).toBeInTheDocument();
    });
  });

  // ── Download PDF ──────────────────────────────────────────────────────────

  it("Download PDF button is rendered for each batch", async () => {
    setupMocks([makeBatch(), makeBatch()]);
    render(<AdminQrGeneratorPage />);

    await waitFor(() => {
      const buttons = screen.getAllByText("Download PDF");
      expect(buttons.length).toBe(2);
    });
  });

  it("clicking Download PDF calls fetch with correct URL", async () => {
    const batch = makeBatch({ id: "batch-uuid-pdf" });
    setupMocks([batch]);

    // Stub click so jsdom doesn't try to navigate
    vi.stubGlobal("HTMLAnchorElement", class extends HTMLAnchorElement {
      click() { /* no-op in tests */ }
    });

    mockFetch.mockResolvedValue({
      ok: true,
      blob: () => Promise.resolve(new Blob(["%PDF fake"], { type: "application/pdf" })),
    });

    render(<AdminQrGeneratorPage />);

    await waitFor(() => {
      expect(screen.getAllByText("Download PDF").length).toBeGreaterThan(0);
    });

    fireEvent.click(screen.getAllByText("Download PDF")[0]);

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith("/api/admin/qr-batches/batch-uuid-pdf/pdf");
    });
  });
});
