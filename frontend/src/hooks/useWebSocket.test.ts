import { renderHook, act } from "@testing-library/react";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { useWebSocket } from "./useWebSocket";

function makeMockWsInstance() {
  return {
    close: vi.fn(),
    send: vi.fn(),
    onmessage: null as ((event: MessageEvent) => void) | null,
    onclose: null as (() => void) | null,
    onerror: null as ((event: Event) => void) | null,
    readyState: 1,
  };
}

describe("useWebSocket", () => {
  let mockWsInstance: ReturnType<typeof makeMockWsInstance>;
  let MockWebSocket: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.useFakeTimers();
    mockWsInstance = makeMockWsInstance();
    MockWebSocket = vi.fn(() => mockWsInstance);
    vi.stubGlobal("WebSocket", MockWebSocket);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("does not connect when enabled=false", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ token: "test-token" }),
      })
    );

    renderHook(() =>
      useWebSocket("/api/v1/ws/admin/live", vi.fn(), false)
    );

    // Flush microtasks
    await act(async () => {
      await Promise.resolve();
    });

    expect(MockWebSocket).not.toHaveBeenCalled();
  });

  it("fetches token and creates WebSocket", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ token: "test-token" }),
      })
    );

    renderHook(() =>
      useWebSocket("/api/v1/ws/admin/live", vi.fn())
    );

    await act(async () => {
      await Promise.resolve();
    });

    expect(MockWebSocket).toHaveBeenCalledOnce();
    const wsUrl = MockWebSocket.mock.calls[0][0] as string;
    expect(wsUrl).toContain("/api/v1/ws/admin/live");
    expect(wsUrl).toContain("token=test-token");
  });

  it("calls onMessage when message received", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ token: "test-token" }),
      })
    );

    const onMessage = vi.fn();

    renderHook(() => useWebSocket("/api/v1/ws/admin/live", onMessage));

    await act(async () => {
      await Promise.resolve();
    });

    const payload = { type: "live_update", data: { members_online: 5 } };
    act(() => {
      mockWsInstance.onmessage!({
        data: JSON.stringify(payload),
      } as MessageEvent);
    });

    expect(onMessage).toHaveBeenCalledOnce();
    expect(onMessage).toHaveBeenCalledWith(payload);
  });

  it("does not connect when token fetch fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new Error("Network error"))
    );

    renderHook(() =>
      useWebSocket("/api/v1/ws/admin/live", vi.fn())
    );

    await act(async () => {
      await Promise.resolve();
    });

    expect(MockWebSocket).not.toHaveBeenCalled();
  });

  it("cleans up WebSocket on unmount", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ token: "test-token" }),
      })
    );

    const { unmount } = renderHook(() =>
      useWebSocket("/api/v1/ws/admin/live", vi.fn())
    );

    await act(async () => {
      await Promise.resolve();
    });

    unmount();

    expect(mockWsInstance.close).toHaveBeenCalledOnce();
  });
});
