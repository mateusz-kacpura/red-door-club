import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";
import LockerRedirect from "./page";

const mockRedirect = vi.fn();

vi.mock("next/navigation", () => ({
  redirect: (url: string) => mockRedirect(url),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => "/locker",
  useParams: () => ({}),
  useSearchParams: () => ({ get: () => null }),
}));

describe("LockerRedirect", () => {
  it("redirects to /dashboard/locker", () => {
    try {
      render(<LockerRedirect />);
    } catch {
      // redirect() throws in Next.js test environment — that's expected
    }
    expect(mockRedirect).toHaveBeenCalledWith("/dashboard/locker");
  });
});
