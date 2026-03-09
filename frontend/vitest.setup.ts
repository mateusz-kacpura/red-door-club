
import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, beforeEach, vi } from "vitest";
import enMessages from "./messages/en.json";

// Resolve a dot-separated translation key against en.json, with {param} interpolation.
function resolveKey(key: string, params?: Record<string, unknown>): string {
  const parts = key.split(".");
  let node: unknown = enMessages;
  for (const part of parts) {
    if (node && typeof node === "object") {
      node = (node as Record<string, unknown>)[part];
    } else {
      node = undefined;
      break;
    }
  }
  const value = typeof node === "string" ? node : key;
  if (!params) return value;
  return value.replace(/\{(\w+)\}/g, (_, k: string) => String(params[k] ?? k));
}

// Mock @tolgee/react globally — avoids requiring TolgeeProvider in unit tests.
// The `t` function resolves dot-separated keys against en.json and performs
// simple {param} interpolation, matching how Tolgee works at runtime.
vi.mock("@tolgee/react", () => ({
  useTranslate: () => ({ t: resolveKey }),
  T: ({ keyName, params }: { keyName: string; params?: Record<string, unknown> }) =>
    resolveKey(keyName, params),
  TolgeeProvider: ({ children }: { children: unknown }) => children,
  useTolgeeSSR: (tolgee: unknown) => tolgee,
}));

// Mock localStorage (Zustand persist middleware requires a working setItem)
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => { store[key] = value; },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { store = {}; },
    get length() { return Object.keys(store).length; },
    key: (index: number) => Object.keys(store)[index] ?? null,
  };
})();

Object.defineProperty(globalThis, "localStorage", {
  value: localStorageMock,
  writable: true,
});

beforeEach(() => {
  localStorageMock.clear();
});

// Cleanup after each test
afterEach(() => {
  cleanup();
});

// Mock Next.js router
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
  }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => "/",
  useParams: () => ({}),
}));

// Mock matchMedia for responsive components
Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Mock ResizeObserver
global.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));

// Mock IntersectionObserver
global.IntersectionObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));
