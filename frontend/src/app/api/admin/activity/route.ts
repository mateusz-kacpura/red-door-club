import { NextRequest, NextResponse } from "next/server";
import { backendFetch, BackendApiError } from "@/lib/server-api";

export async function GET(request: NextRequest) {
  try {
    const accessToken = request.cookies.get("access_token")?.value;
    if (!accessToken) {
      return NextResponse.json({ detail: "Not authenticated" }, { status: 401 });
    }
    const { searchParams } = new URL(request.url);
    const params = new URLSearchParams();
    if (searchParams.get("tap_type")) params.set("tap_type", searchParams.get("tap_type")!);
    if (searchParams.get("skip")) params.set("skip", searchParams.get("skip")!);
    if (searchParams.get("limit")) params.set("limit", searchParams.get("limit")!);

    const qs = params.toString();
    const data = await backendFetch(`/api/v1/admin/activity${qs ? `?${qs}` : ""}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    return NextResponse.json(data);
  } catch (error) {
    if (error instanceof BackendApiError) {
      return NextResponse.json({ detail: error.message }, { status: error.status });
    }
    return NextResponse.json({ detail: "Internal server error" }, { status: 500 });
  }
}
