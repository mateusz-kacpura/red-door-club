import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { parseMemberId } from "./page";

// Mock html5-qrcode to avoid browser API access
vi.mock("html5-qrcode", () => ({
  Html5Qrcode: vi.fn(),
}));

const mockPush = vi.fn();
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
    useSearchParams: () => new URLSearchParams(),
    usePathname: () => "/staff",
    useParams: () => ({}),
  };
});

describe("parseMemberId", () => {
  it("extracts UUID from full URL", () => {
    expect(
      parseMemberId("https://example.com/staff/checkin?member=550e8400-e29b-41d4-a716-446655440000"),
    ).toBe("550e8400-e29b-41d4-a716-446655440000");
  });

  it("extracts UUID from path-only string", () => {
    expect(
      parseMemberId("/staff/checkin?member=550e8400-e29b-41d4-a716-446655440000"),
    ).toBe("550e8400-e29b-41d4-a716-446655440000");
  });

  it("extracts raw UUID", () => {
    expect(parseMemberId("550e8400-e29b-41d4-a716-446655440000")).toBe(
      "550e8400-e29b-41d4-a716-446655440000",
    );
  });

  it("returns null for invalid QR text", () => {
    expect(parseMemberId("random text")).toBeNull();
  });

  it("returns null for URL without member param", () => {
    expect(parseMemberId("https://example.com/staff/checkin")).toBeNull();
  });

  it("returns null for URL with non-UUID member param", () => {
    expect(parseMemberId("https://example.com/staff/checkin?member=abc")).toBeNull();
  });
});

describe("StaffScannerPage", () => {
  it("renders page title and scanner container", async () => {
    // Dynamic import to ensure mocks are applied
    const { default: StaffScannerPage } = await import("./page");
    render(<StaffScannerPage />);

    expect(screen.getByText("Scan QR Code")).toBeInTheDocument();
    expect(document.getElementById("qr-reader")).toBeInTheDocument();
  });
});
