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

  it("PDF button is rendered for each batch", async () => {
    setupMocks([makeBatch(), makeBatch()]);
    render(<AdminQrGeneratorPage />);

    await waitFor(() => {
      // Button label is hardcoded "PDF" (no translation)
      const buttons = screen.getAllByText("PDF");
      expect(buttons.length).toBe(2);
    });
  });

  it("clicking PDF button calls fetch with correct URL", async () => {
    const batch = makeBatch({ id: "batch-uuid-pdf" });
    setupMocks([batch]);

    mockFetch.mockResolvedValue({
      ok: true,
      blob: () => Promise.resolve(new Blob(["%PDF fake"], { type: "application/pdf" })),
    });

    render(<AdminQrGeneratorPage />);

    await waitFor(() => {
      expect(screen.getAllByText("PDF").length).toBeGreaterThan(0);
    });

    fireEvent.click(screen.getAllByText("PDF")[0]);

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith("/api/admin/qr-batches/batch-uuid-pdf/pdf");
    });
  });

  // ── Download PNG ──────────────────────────────────────────────────────────

  it("PNG button is rendered for each batch", async () => {
    setupMocks([makeBatch(), makeBatch()]);
    render(<AdminQrGeneratorPage />);

    await waitFor(() => {
      const buttons = screen.getAllByText("PNG");
      expect(buttons.length).toBe(2);
    });
  });

  it("clicking PNG button calls fetch with correct URL", async () => {
    const batch = makeBatch({ id: "batch-uuid-png" });
    setupMocks([batch]);

    mockFetch.mockResolvedValue({
      ok: true,
      blob: () => Promise.resolve(new Blob(["PK fake zip"], { type: "application/zip" })),
    });

    render(<AdminQrGeneratorPage />);

    await waitFor(() => {
      expect(screen.getAllByText("PNG").length).toBeGreaterThan(0);
    });

    fireEvent.click(screen.getAllByText("PNG")[0]);

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith("/api/admin/qr-batches/batch-uuid-png/png-zip");
    });
  });

  // ── Add codes ─────────────────────────────────────────────────────────────

  it("Add button is rendered for each batch", async () => {
    setupMocks([makeBatch(), makeBatch()]);
    render(<AdminQrGeneratorPage />);

    await waitFor(() => {
      // One "Add" toggle button per batch
      const addButtons = screen.getAllByText("Add");
      expect(addButtons.length).toBeGreaterThanOrEqual(2);
    });
  });

  it("clicking Add button shows inline form with count input", async () => {
    const batch = makeBatch({ id: "batch-uuid-add-open" });
    setupMocks([batch]);
    render(<AdminQrGeneratorPage />);

    await waitFor(() => {
      expect(screen.getAllByText("Add").length).toBeGreaterThan(0);
    });

    fireEvent.click(screen.getAllByText("Add")[0]);

    await waitFor(() => {
      expect(screen.getByText("Number of codes to add")).toBeInTheDocument();
      // Confirm button "Add" also appears inside the panel
      expect(screen.getAllByText("Add").length).toBeGreaterThanOrEqual(2);
    });
  });

  it("submitting Add form calls POST /append and refreshes list", async () => {
    const batch = makeBatch({ id: "batch-uuid-append" });
    setupMocks([batch]);

    mockFetch.mockResolvedValue({ ok: true, json: () => Promise.resolve({}) });

    render(<AdminQrGeneratorPage />);

    await waitFor(() => {
      fireEvent.click(screen.getAllByText("Add")[0]);
    });

    await waitFor(() => {
      expect(screen.getByText("Number of codes to add")).toBeInTheDocument();
    });

    // The last "Add" button is the confirm button inside the panel
    const addButtons = screen.getAllByText("Add");
    fireEvent.click(addButtons[addButtons.length - 1]);

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        "/api/admin/qr-batches/batch-uuid-append/append",
        expect.objectContaining({ method: "POST" }),
      );
    });
  });

  it("Add form shows error message on failed append", async () => {
    const batch = makeBatch({ id: "batch-uuid-add-err" });
    setupMocks([batch]);

    mockFetch.mockResolvedValue({
      ok: false,
      json: () => Promise.resolve({ detail: "Append failed" }),
    });

    render(<AdminQrGeneratorPage />);

    await waitFor(() => {
      fireEvent.click(screen.getAllByText("Add")[0]);
    });

    await waitFor(() => {
      expect(screen.getByText("Number of codes to add")).toBeInTheDocument();
    });

    const addButtons = screen.getAllByText("Add");
    fireEvent.click(addButtons[addButtons.length - 1]);

    await waitFor(() => {
      expect(screen.getByText("Append failed")).toBeInTheDocument();
    });
  });

  it("clicking Add again closes the inline panel", async () => {
    const batch = makeBatch({ id: "batch-uuid-add-toggle" });
    setupMocks([batch]);
    render(<AdminQrGeneratorPage />);

    await waitFor(() => {
      fireEvent.click(screen.getAllByText("Add")[0]);
    });

    await waitFor(() => {
      expect(screen.getByText("Number of codes to add")).toBeInTheDocument();
    });

    // Click the toggle button again (first "Add") to close
    fireEvent.click(screen.getAllByText("Add")[0]);

    await waitFor(() => {
      expect(screen.queryByText("Number of codes to add")).not.toBeInTheDocument();
    });
  });

  // ── Remove codes ──────────────────────────────────────────────────────────

  it("Remove button is rendered for each batch", async () => {
    setupMocks([makeBatch(), makeBatch()]);
    render(<AdminQrGeneratorPage />);

    await waitFor(() => {
      const removeButtons = screen.getAllByText("Remove");
      expect(removeButtons.length).toBeGreaterThanOrEqual(2);
    });
  });

  it("clicking Remove shows inline form with warning and count input", async () => {
    const batch = makeBatch({ id: "batch-uuid-reduce-open" });
    setupMocks([batch]);
    render(<AdminQrGeneratorPage />);

    await waitFor(() => {
      expect(screen.getAllByText("Remove").length).toBeGreaterThan(0);
    });

    fireEvent.click(screen.getAllByText("Remove")[0]);

    await waitFor(() => {
      expect(
        screen.getByText("Only unconverted codes will be removed, starting from the newest."),
      ).toBeInTheDocument();
      expect(screen.getByText("Codes to remove (unconverted only)")).toBeInTheDocument();
    });
  });

  it("submitting Remove form calls POST /reduce", async () => {
    const batch = makeBatch({ id: "batch-uuid-reduce-submit" });
    setupMocks([batch]);

    mockFetch.mockResolvedValue({ ok: true, json: () => Promise.resolve({}) });

    render(<AdminQrGeneratorPage />);

    await waitFor(() => {
      fireEvent.click(screen.getAllByText("Remove")[0]);
    });

    await waitFor(() => {
      expect(screen.getByText("Codes to remove (unconverted only)")).toBeInTheDocument();
    });

    // The last "Remove" button is the confirm button inside the panel
    const removeButtons = screen.getAllByText("Remove");
    fireEvent.click(removeButtons[removeButtons.length - 1]);

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        "/api/admin/qr-batches/batch-uuid-reduce-submit/reduce",
        expect.objectContaining({ method: "POST" }),
      );
    });
  });

  // ── Delete batch ──────────────────────────────────────────────────────────

  it("Delete button is rendered for each batch", async () => {
    setupMocks([makeBatch(), makeBatch()]);
    render(<AdminQrGeneratorPage />);

    await waitFor(() => {
      const deleteButtons = screen.getAllByText("Delete");
      expect(deleteButtons.length).toBeGreaterThanOrEqual(2);
    });
  });

  it("clicking Delete shows inline form with password input and delete warning", async () => {
    const batch = makeBatch({ id: "batch-uuid-delete-open" });
    setupMocks([batch]);
    render(<AdminQrGeneratorPage />);

    await waitFor(() => {
      expect(screen.getAllByText("Delete").length).toBeGreaterThan(0);
    });

    fireEvent.click(screen.getAllByText("Delete")[0]);

    await waitFor(() => {
      expect(
        screen.getByText(
          "This action is irreversible. All QR codes in this batch will be permanently deleted.",
        ),
      ).toBeInTheDocument();
      expect(
        screen.getByText("Enter your password to confirm deletion"),
      ).toBeInTheDocument();
      // Confirm button has unique text "Confirm Delete"
      expect(screen.getByText("Confirm Delete")).toBeInTheDocument();
    });
  });

  it("Confirm Delete button is disabled when password is empty", async () => {
    const batch = makeBatch({ id: "batch-uuid-delete-disabled" });
    setupMocks([batch]);
    render(<AdminQrGeneratorPage />);

    await waitFor(() => {
      fireEvent.click(screen.getAllByText("Delete")[0]);
    });

    await waitFor(() => {
      expect(screen.getByText("Confirm Delete")).toBeInTheDocument();
    });

    const confirmBtn = screen.getByRole("button", { name: "Confirm Delete" });
    expect(confirmBtn).toBeDisabled();
  });

  it("submitting Delete form with password calls DELETE endpoint", async () => {
    const batch = makeBatch({ id: "batch-uuid-del-submit" });
    setupMocks([batch]);

    mockFetch.mockResolvedValue({ ok: true, json: () => Promise.resolve({}) });

    const { container } = render(<AdminQrGeneratorPage />);

    await waitFor(() => {
      fireEvent.click(screen.getAllByText("Delete")[0]);
    });

    await waitFor(() => {
      expect(screen.getByText("Confirm Delete")).toBeInTheDocument();
    });

    // Fill password via the password input
    const passwordInput = container.querySelector('input[type="password"]') as HTMLInputElement;
    fireEvent.change(passwordInput, { target: { value: "password123" } });

    // Confirm Delete button should now be enabled
    const confirmBtn = screen.getByRole("button", { name: "Confirm Delete" });
    expect(confirmBtn).not.toBeDisabled();

    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        "/api/admin/qr-batches/batch-uuid-del-submit",
        expect.objectContaining({
          method: "DELETE",
          body: JSON.stringify({ password: "password123" }),
        }),
      );
    });
  });

  it("Delete form shows error on wrong password response", async () => {
    const batch = makeBatch({ id: "batch-uuid-del-err" });
    setupMocks([batch]);

    mockFetch.mockResolvedValue({
      ok: false,
      json: () => Promise.resolve({ detail: "Incorrect password." }),
    });

    const { container } = render(<AdminQrGeneratorPage />);

    await waitFor(() => {
      fireEvent.click(screen.getAllByText("Delete")[0]);
    });

    await waitFor(() => {
      expect(screen.getByText("Confirm Delete")).toBeInTheDocument();
    });

    const passwordInput = container.querySelector('input[type="password"]') as HTMLInputElement;
    fireEvent.change(passwordInput, { target: { value: "wrongpass" } });

    fireEvent.click(screen.getByRole("button", { name: "Confirm Delete" }));

    await waitFor(() => {
      expect(screen.getByText("Incorrect password.")).toBeInTheDocument();
    });
  });

  // ── Action panel — Cancel & toggling ──────────────────────────────────────

  it("Cancel button in action panel closes the panel", async () => {
    const batch = makeBatch({ id: "batch-uuid-cancel" });
    setupMocks([batch]);
    render(<AdminQrGeneratorPage />);

    await waitFor(() => {
      fireEvent.click(screen.getAllByText("Add")[0]);
    });

    await waitFor(() => {
      expect(screen.getByText("Number of codes to add")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Cancel"));

    await waitFor(() => {
      expect(screen.queryByText("Number of codes to add")).not.toBeInTheDocument();
    });
  });

  it("opening a different action replaces the previous panel", async () => {
    const batch = makeBatch({ id: "batch-uuid-switch" });
    setupMocks([batch]);
    render(<AdminQrGeneratorPage />);

    // Open Add panel
    await waitFor(() => {
      fireEvent.click(screen.getAllByText("Add")[0]);
    });

    await waitFor(() => {
      expect(screen.getByText("Number of codes to add")).toBeInTheDocument();
    });

    // Open Remove panel — Add panel should disappear
    fireEvent.click(screen.getAllByText("Remove")[0]);

    await waitFor(() => {
      expect(screen.queryByText("Number of codes to add")).not.toBeInTheDocument();
      expect(screen.getByText("Codes to remove (unconverted only)")).toBeInTheDocument();
    });
  });
});
