import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import AdminCorporatePage from "./page";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => "/admin/corporate",
  useParams: () => ({}),
  useSearchParams: () => ({ get: () => null }),
}));

vi.mock("next/link", () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock("@/lib/constants", () => ({
  ROUTES: { ADMIN_CORPORATE: "/admin/corporate" },
}));

const mockGet = vi.hoisted(() => vi.fn());
const mockPost = vi.hoisted(() => vi.fn());
vi.mock("@/lib/api-client", () => ({
  apiClient: { get: mockGet, post: mockPost },
  ApiError: class ApiError extends Error { name = "ApiError"; },
}));

const makeAccount = (overrides = {}) => ({
  id: "corp-uuid-1",
  company_name: "Acme Corp",
  billing_contact_name: "John Smith",
  billing_contact_email: "john@acme.com",
  package_type: "starter",
  max_seats: 5,
  active_seats: 2,
  annual_fee: 120000,
  renewal_date: null,
  status: "active",
  created_at: new Date().toISOString(),
  ...overrides,
});

describe("AdminCorporatePage", () => {
  beforeEach(() => {
    mockGet.mockReset();
    mockPost.mockReset();
    mockGet.mockResolvedValue([]);
  });

  it("shows loading spinner initially", () => {
    mockGet.mockReturnValue(new Promise(() => {}));
    render(<AdminCorporatePage />);
    expect(document.querySelector(".animate-spin")).toBeInTheDocument();
  });

  it("shows Corporate Accounts heading", async () => {
    mockGet.mockResolvedValue([]);
    render(<AdminCorporatePage />);
    await waitFor(() => {
      expect(screen.getByText(/corporate accounts/i)).toBeInTheDocument();
    });
  });

  it("shows empty state when no accounts", async () => {
    mockGet.mockResolvedValue([]);
    render(<AdminCorporatePage />);
    await waitFor(() => {
      expect(screen.getByText(/no corporate accounts/i)).toBeInTheDocument();
    });
  });

  it("shows account names with data", async () => {
    mockGet.mockResolvedValue([
      makeAccount({ company_name: "Acme Corp" }),
      makeAccount({ id: "corp-2", company_name: "Globex Ltd" }),
    ]);
    render(<AdminCorporatePage />);
    await waitFor(() => {
      expect(screen.getByText("Acme Corp")).toBeInTheDocument();
    });
    expect(screen.getByText("Globex Ltd")).toBeInTheDocument();
  });

  it("shows seat count for each account", async () => {
    mockGet.mockResolvedValue([makeAccount({ active_seats: 3, max_seats: 5 })]);
    render(<AdminCorporatePage />);
    await waitFor(() => {
      // Component renders {a.active_seats}/{a.max_seats} with no spaces around slash
      expect(screen.getByText(/3\/5/)).toBeInTheDocument();
    });
  });

  it("shows status badge for active accounts", async () => {
    mockGet.mockResolvedValue([makeAccount({ status: "active" })]);
    render(<AdminCorporatePage />);
    await waitFor(() => {
      expect(screen.getByText("active")).toBeInTheDocument();
    });
  });

  it("shows New Account button", async () => {
    mockGet.mockResolvedValue([]);
    render(<AdminCorporatePage />);
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /new account/i })).toBeInTheDocument();
    });
  });

  it("toggles create form when New Account button clicked", async () => {
    mockGet.mockResolvedValue([]);
    render(<AdminCorporatePage />);
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /new account/i })).toBeInTheDocument();
    });

    await userEvent.click(screen.getByRole("button", { name: /new account/i }));

    // Form header appears after toggle
    expect(screen.getByText("Create Corporate Account")).toBeInTheDocument();
  });

  it("submits create form and shows success toast", async () => {
    const { toast } = await import("sonner");
    mockGet.mockResolvedValue([]);
    const newAccount = makeAccount({ company_name: "NewCo Inc" });
    mockPost.mockResolvedValueOnce(newAccount);
    mockGet.mockResolvedValueOnce([newAccount]);

    render(<AdminCorporatePage />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /new account/i })).toBeInTheDocument();
    });

    await userEvent.click(screen.getByRole("button", { name: /new account/i }));

    // Inputs have no placeholder — find by role index
    const textboxes = screen.getAllByRole("textbox");
    await userEvent.type(textboxes[0], "NewCo Inc");       // company_name
    await userEvent.type(textboxes[1], "Jane Doe");        // billing_contact_name
    await userEvent.type(textboxes[2], "jane@newco.com");  // billing_contact_email (type="email")

    // Submit button text is "Create"
    const submitButton = screen.getByRole("button", { name: /^create$/i });
    await userEvent.click(submitButton);

    await waitFor(() => {
      expect(mockPost).toHaveBeenCalledWith(
        "/admin/corporate",
        expect.objectContaining({ company_name: "NewCo Inc" }),
      );
    });
    expect(toast.success).toHaveBeenCalled();
  });

  it("shows suspended badge for suspended accounts", async () => {
    mockGet.mockResolvedValue([makeAccount({ status: "suspended" })]);
    render(<AdminCorporatePage />);
    await waitFor(() => {
      expect(screen.getByText("suspended")).toBeInTheDocument();
    });
  });
});
