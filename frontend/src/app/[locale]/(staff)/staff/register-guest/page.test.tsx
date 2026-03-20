import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import StaffRegisterGuestPage from "./page";

vi.mock("react-qr-code", () => ({
  __esModule: true,
  default: ({ value }: { value: string }) => (
    <div data-testid="qr-code" data-value={value} />
  ),
}));

describe("StaffRegisterGuestPage", () => {
  it("renders title and hint text", () => {
    render(<StaffRegisterGuestPage />);
    expect(screen.getByText(/guest registration/i)).toBeInTheDocument();
    expect(screen.getByText(/let the guest scan/i)).toBeInTheDocument();
  });

  it("renders QR code with qr-register URL", () => {
    render(<StaffRegisterGuestPage />);
    const qr = screen.getByTestId("qr-code");
    expect(qr).toBeInTheDocument();
    expect(qr.getAttribute("data-value")).toContain("/qr-register");
  });

  it("renders back button", () => {
    render(<StaffRegisterGuestPage />);
    expect(screen.getByRole("button", { name: /back/i })).toBeInTheDocument();
  });
});
