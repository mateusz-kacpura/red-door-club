import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QRRegisterForm } from "./qr-register-form";

// Mock apiClient
vi.mock("@/lib/api-client", () => ({
  apiClient: {
    post: vi.fn(),
  },
  ApiError: class ApiError extends Error {
    status: number;
    constructor(message: string, status = 400) {
      super(message);
      this.status = status;
    }
  },
}));

// Mock next/navigation
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
  }),
  useSearchParams: () => ({
    get: (key: string) => {
      const params: Record<string, string> = { pass: "RD-001", promo: "PRO-01", tier: "silver" };
      return params[key] ?? null;
    },
  }),
  usePathname: () => "/qr-register",
  useParams: () => ({}),
}));

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Fill step 1 required fields using placeholders (Labels have no htmlFor) */
async function fillStep1(name = "Alice Smith", email = "alice@example.com") {
  await userEvent.type(screen.getByPlaceholderText(/your full name/i), name);
  await userEvent.type(screen.getByPlaceholderText(/email@example.com/i), email);
}

/** Fill step 2 required fields */
async function fillStep2(company = "Acme Corp", industry = "Finance") {
  await userEvent.type(screen.getByPlaceholderText(/your company/i), company);
  fireEvent.change(screen.getByDisplayValue("Select industry..."), {
    target: { value: industry },
  });
}

/** Advance through all steps to reach step 5 (consent) */
async function advanceToStep5() {
  // Step 1
  await fillStep1();
  await userEvent.click(screen.getByRole("button", { name: /^next$/i }));

  // Step 2
  await waitFor(() => screen.getByText(/step 2/i));
  await fillStep2();
  await userEvent.click(screen.getByRole("button", { name: /^next$/i }));

  // Step 3 — pick an interest
  await waitFor(() => screen.getByText(/step 3/i));
  await userEvent.click(screen.getByRole("button", { name: /^finance$/i }));
  await userEvent.click(screen.getByRole("button", { name: /^next$/i }));

  // Step 4 — no required fields
  await waitFor(() => screen.getByText(/step 4/i));
  await userEvent.click(screen.getByRole("button", { name: /^next$/i }));

  // Step 5
  await waitFor(() => screen.getByText(/step 5/i));
}

describe("QRRegisterForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── Rendering ──────────────────────────────────────────────────────────────

  it("renders step 1 (Identity) by default", () => {
    render(<QRRegisterForm />);

    expect(screen.getByText(/step 1 — identity/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/your full name/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/email@example.com/i)).toBeInTheDocument();
  });

  it("shows step progress numbers (1–5)", () => {
    render(<QRRegisterForm />);

    // All 5 step numbers should appear in the progress bar
    expect(screen.getByText("1")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
    expect(screen.getByText("4")).toBeInTheDocument();
    expect(screen.getByText("5")).toBeInTheDocument();
  });

  it("Next button is disabled when step 1 required fields are empty", () => {
    render(<QRRegisterForm />);
    expect(screen.getByRole("button", { name: /^next$/i })).toBeDisabled();
  });

  // ── Step navigation ────────────────────────────────────────────────────────

  it("enables Next button when step 1 required fields are filled", async () => {
    render(<QRRegisterForm />);
    await fillStep1();

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /^next$/i })).not.toBeDisabled();
    });
  });

  it("advances to step 2 when Next is clicked on step 1", async () => {
    render(<QRRegisterForm />);
    await fillStep1();
    await userEvent.click(screen.getByRole("button", { name: /^next$/i }));

    await waitFor(() => {
      expect(screen.getByText(/step 2 — business/i)).toBeInTheDocument();
    });
  });

  it("Back button returns to previous step", async () => {
    render(<QRRegisterForm />);

    // Go to step 2
    await fillStep1();
    await userEvent.click(screen.getByRole("button", { name: /^next$/i }));
    await waitFor(() => screen.getByText(/step 2/i));

    // Go back
    await userEvent.click(screen.getByRole("button", { name: /^back$/i }));

    await waitFor(() => {
      expect(screen.getByText(/step 1 — identity/i)).toBeInTheDocument();
    });
  });

  // ── Step 2 — Business ──────────────────────────────────────────────────────

  it("Next disabled on step 2 until company name and industry are filled", async () => {
    render(<QRRegisterForm />);
    await fillStep1();
    await userEvent.click(screen.getByRole("button", { name: /^next$/i }));
    await waitFor(() => screen.getByText(/step 2/i));

    // Next should be disabled with empty company/industry
    expect(screen.getByRole("button", { name: /^next$/i })).toBeDisabled();

    // Fill both required fields
    await fillStep2();

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /^next$/i })).not.toBeDisabled();
    });
  });

  // ── Step 3 — Interests ─────────────────────────────────────────────────────

  it("requires at least one interest to proceed from step 3", async () => {
    render(<QRRegisterForm />);

    // Navigate to step 3
    await fillStep1();
    await userEvent.click(screen.getByRole("button", { name: /^next$/i }));
    await waitFor(() => screen.getByText(/step 2/i));
    await fillStep2();
    await userEvent.click(screen.getByRole("button", { name: /^next$/i }));
    await waitFor(() => screen.getByText(/step 3/i));

    // Next disabled with no interests
    expect(screen.getByRole("button", { name: /^next$/i })).toBeDisabled();

    // Select an interest
    await userEvent.click(screen.getByRole("button", { name: /^tech$/i }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /^next$/i })).not.toBeDisabled();
    });
  });

  // ── Step 5 — Consent ───────────────────────────────────────────────────────

  it("Complete Registration button is disabled without PDPA and ToS consent", async () => {
    render(<QRRegisterForm />);
    await advanceToStep5();

    expect(screen.getByRole("button", { name: /complete registration/i })).toBeDisabled();
  });

  it("Complete Registration button enabled after both consents checked", async () => {
    render(<QRRegisterForm />);
    await advanceToStep5();

    // Check PDPA (first checkbox)
    const checkboxes = screen.getAllByRole("checkbox");
    await userEvent.click(checkboxes[0]); // PDPA
    await userEvent.click(checkboxes[1]); // ToS

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /complete registration/i })).not.toBeDisabled();
    });
  });

  // ── Submission ─────────────────────────────────────────────────────────────

  it("calls apiClient.post with correct payload on submit", async () => {
    const { apiClient } = await import("@/lib/api-client");
    (apiClient.post as ReturnType<typeof vi.fn>).mockResolvedValue({ id: "user-123" });

    render(<QRRegisterForm />);
    await advanceToStep5();

    const checkboxes = screen.getAllByRole("checkbox");
    await userEvent.click(checkboxes[0]); // PDPA
    await userEvent.click(checkboxes[1]); // ToS

    await waitFor(() =>
      expect(screen.getByRole("button", { name: /complete registration/i })).not.toBeDisabled()
    );

    await userEvent.click(screen.getByRole("button", { name: /complete registration/i }));

    await waitFor(() => {
      expect(apiClient.post).toHaveBeenCalledWith(
        "/auth/register",
        expect.objectContaining({
          full_name: "Alice Smith",
          email: "alice@example.com",
          pdpa_consent: true,
        })
      );
    });
  });

  it("shows error message when API call fails", async () => {
    const { apiClient, ApiError } = await import("@/lib/api-client");
    (apiClient.post as ReturnType<typeof vi.fn>).mockRejectedValue(
      new ApiError("Email already registered", 409)
    );

    render(<QRRegisterForm />);
    await advanceToStep5();

    const checkboxes = screen.getAllByRole("checkbox");
    await userEvent.click(checkboxes[0]);
    await userEvent.click(checkboxes[1]);

    await waitFor(() =>
      expect(screen.getByRole("button", { name: /complete registration/i })).not.toBeDisabled()
    );

    await userEvent.click(screen.getByRole("button", { name: /complete registration/i }));

    await waitFor(() => {
      expect(screen.getByText(/email already registered/i)).toBeInTheDocument();
    });
  });
});
