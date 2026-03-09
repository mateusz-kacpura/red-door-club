"use client";

import { useEffect, useRef, useCallback } from "react";

const WS_BASE_URL =
  process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:8008";

const RECONNECT_DELAY_MS = 3000;

/**
 * useWebSocket — manages a WebSocket connection with auto-reconnect.
 *
 * Fetches a short-lived JWT via /api/auth/ws-token (reads the HttpOnly cookie
 * server-side) and connects to the backend WebSocket with ?token=<jwt>.
 *
 * @param path   WebSocket path, e.g. "/api/v1/ws/admin/live"
 * @param onMessage  Called with the parsed JSON payload on each message
 * @param enabled    Set to false to skip connecting (e.g. when user is not admin)
 */
export function useWebSocket(
  path: string,
  onMessage: (data: unknown) => void,
  enabled = true
) {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);
  const onMessageRef = useRef(onMessage);
  onMessageRef.current = onMessage;

  const connect = useCallback(async () => {
    if (!mountedRef.current || !enabled) return;

    // Fetch the JWT token from the Next.js proxy route
    let token: string;
    try {
      const res = await fetch("/api/auth/ws-token");
      if (!res.ok) return; // not authenticated, skip
      const data = await res.json();
      token = data.token;
    } catch {
      return;
    }

    const url = `${WS_BASE_URL}${path}?token=${token}`;
    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onmessage = (event) => {
      try {
        const parsed = JSON.parse(event.data);
        onMessageRef.current(parsed);
      } catch {
        // ignore malformed messages
      }
    };

    ws.onclose = () => {
      if (!mountedRef.current) return;
      // Auto-reconnect after delay
      reconnectTimer.current = setTimeout(connect, RECONNECT_DELAY_MS);
    };

    ws.onerror = () => {
      ws.close();
    };
  }, [path, enabled]);

  useEffect(() => {
    mountedRef.current = true;
    if (enabled) connect();

    return () => {
      mountedRef.current = false;
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
      wsRef.current?.close();
    };
  }, [connect, enabled]);
}
