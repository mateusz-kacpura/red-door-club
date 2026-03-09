import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";
import TabRedirect from "./page";

const mockRedirect = vi.fn();

vi.mock("next/navigation", () => ({
  redirect: (url: string) => mockRedirect(url),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => "/tab",
  useParams: () => ({}),
  useSearchParams: () => ({ get: () => null }),
}));

describe("TabRedirect", () => {
  it("redirects to /dashboard/tab", () => {
    try {
      render(<TabRedirect />);
    } catch {
      // redirect() throws in Next.js test environment — that's expected
    }
    expect(mockRedirect).toHaveBeenCalledWith("/dashboard/tab");
  });
});
