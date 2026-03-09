import { NextRequest, NextResponse } from "next/server";
import { backendFetch, BackendApiError } from "@/lib/server-api";

export async function GET(request: NextRequest) {
  try {
    const accessToken = request.cookies.get("access_token")?.value;
    if (!accessToken) {
      return NextResponse.json({ detail: "Not authenticated" }, { status: 401 });
    }
    const { searchParams } = new URL(request.url);
    const skip = searchParams.get("skip") ?? "0";
    const limit = searchParams.get("limit") ?? "20";

    const data = await backendFetch(
      `/api/v1/members/me/events?skip=${skip}&limit=${limit}`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    return NextResponse.json(data);
  } catch (error) {
    if (error instanceof BackendApiError) {
      return NextResponse.json({ detail: error.message }, { status: error.status });
    }
    return NextResponse.json({ detail: "Internal server error" }, { status: 500 });
  }
}
