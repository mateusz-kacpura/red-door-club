import { NextRequest, NextResponse } from "next/server";
import { backendFetch, BackendApiError } from "@/lib/server-api";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const cid = searchParams.get("cid");
    const readerId = searchParams.get("reader_id");
    const location = searchParams.get("location");

    if (!cid) {
      return NextResponse.json({ detail: "Missing card ID" }, { status: 400 });
    }

    const params = new URLSearchParams({ cid });
    if (readerId) params.set("reader_id", readerId);
    if (location) params.set("location", location);

    const accessToken = request.cookies.get("access_token")?.value;
    const headers: Record<string, string> = {};
    if (accessToken) headers.Authorization = `Bearer ${accessToken}`;

    const data = await backendFetch(`/api/v1/nfc/tap?${params}`, { headers });
    return NextResponse.json(data);
  } catch (error) {
    if (error instanceof BackendApiError) {
      return NextResponse.json({ detail: error.message }, { status: error.status });
    }
    return NextResponse.json({ detail: "Internal server error" }, { status: 500 });
  }
}
