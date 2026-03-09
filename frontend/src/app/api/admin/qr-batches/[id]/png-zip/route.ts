import { NextRequest, NextResponse } from "next/server";
import { BackendApiError } from "@/lib/server-api";

const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:8000";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const accessToken = request.cookies.get("access_token")?.value;
    if (!accessToken) {
      return NextResponse.json({ detail: "Not authenticated" }, { status: 401 });
    }
    const { id } = await params;
    const response = await fetch(`${BACKEND_URL}/api/v1/admin/qr-batches/${id}/png-zip`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!response.ok) {
      let errorData;
      try { errorData = await response.json(); } catch { errorData = null; }
      throw new BackendApiError(response.status, response.statusText, errorData);
    }
    const buffer = await response.arrayBuffer();
    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="qr-batch-${id}-png.zip"`,
      },
    });
  } catch (error) {
    if (error instanceof BackendApiError) {
      return NextResponse.json({ detail: error.message }, { status: error.status });
    }
    return NextResponse.json({ detail: "Internal server error" }, { status: 500 });
  }
}
