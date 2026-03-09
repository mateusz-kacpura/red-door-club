import { NextRequest, NextResponse } from "next/server";
import { backendFetch, BackendApiError } from "@/lib/server-api";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const accessToken = request.cookies.get("access_token")?.value;
    if (!accessToken) return NextResponse.json({ detail: "Not authenticated" }, { status: 401 });
    const body = await request.json().catch(() => ({}));
    const data = await backendFetch(`/api/v1/admin/promoters/payouts/${id}/approve`, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    return NextResponse.json(data);
  } catch (error) {
    if (error instanceof BackendApiError) return NextResponse.json({ detail: error.message }, { status: error.status });
    return NextResponse.json({ detail: "Internal server error" }, { status: 500 });
  }
}
