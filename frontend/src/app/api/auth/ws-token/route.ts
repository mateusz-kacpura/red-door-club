import { NextRequest, NextResponse } from "next/server";

/**
 * GET /api/auth/ws-token
 *
 * Returns the JWT access token for use in WebSocket connections.
 * Since the token is stored in an HttpOnly cookie (not accessible to JS),
 * this server-side route reads the cookie and passes it to the client.
 *
 * This is safe for same-origin requests from the frontend JS — the token
 * is needed immediately to open the WebSocket connection.
 */
export async function GET(request: NextRequest) {
  const token = request.cookies.get("access_token")?.value;
  if (!token) {
    return NextResponse.json({ detail: "Not authenticated" }, { status: 401 });
  }
  return NextResponse.json({ token });
}
