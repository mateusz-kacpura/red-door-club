import { NextRequest, NextResponse } from "next/server";
import { backendFetch, BackendApiError } from "@/lib/server-api";

export async function GET(request: NextRequest) {
  try {
    const accessToken = request.cookies.get("access_token")?.value;
    if (!accessToken) {
      return NextResponse.json({ detail: "Not authenticated" }, { status: 401 });
    }
    const data = await backendFetch("/api/v1/staff/today-events", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    return NextResponse.json(data);
  } catch (error) {
    if (error instanceof BackendApiError) {
      const detail = (error.data as { detail?: string })?.detail ?? error.message;
      return NextResponse.json({ detail }, { status: error.status });
    }
    return NextResponse.json({ detail: "Internal server error" }, { status: 500 });
  }
}
