"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, AlertCircle, Camera } from "lucide-react";
import { ROUTES } from "@/lib/constants";
import { useTranslate } from "@tolgee/react";

type ScannerStatus = "initializing" | "scanning" | "permission_denied" | "invalid_qr";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function parseMemberId(raw: string): string | null {
  const trimmed = raw.trim();

  // Full URL: https://…/staff/checkin?member=<uuid>
  try {
    const url = new URL(trimmed);
    const member = url.searchParams.get("member");
    if (member && UUID_RE.test(member)) return member;
  } catch {
    // not a full URL
  }

  // Path: /staff/checkin?member=<uuid>
  if (trimmed.startsWith("/")) {
    try {
      const url = new URL(trimmed, "https://placeholder.local");
      const member = url.searchParams.get("member");
      if (member && UUID_RE.test(member)) return member;
    } catch {
      // ignore
    }
  }

  // Short URL: /m/<uuid> or https://…/m/<uuid>
  const mMatch = trimmed.match(/\/m\/([0-9a-f-]{36})/i);
  if (mMatch && UUID_RE.test(mMatch[1])) return mMatch[1];

  // Raw UUID
  if (UUID_RE.test(trimmed)) return trimmed;

  return null;
}

export default function StaffScannerPage() {
  const router = useRouter();
  const { t } = useTranslate();

  const scannerRef = useRef<import("html5-qrcode").Html5Qrcode | null>(null);
  const hasNavigatedRef = useRef(false);

  const [status, setStatus] = useState<ScannerStatus>("initializing");

  useEffect(() => {
    let cancelled = false;

    import("html5-qrcode").then(({ Html5Qrcode }) => {
      if (cancelled) return;

      const scanner = new Html5Qrcode("qr-reader");
      scannerRef.current = scanner;

      scanner
        .start(
          { facingMode: "environment" },
          { fps: 10, qrbox: { width: 250, height: 250 } },
          (decodedText) => {
            if (hasNavigatedRef.current) return;

            const memberId = parseMemberId(decodedText);
            if (memberId) {
              hasNavigatedRef.current = true;
              try { navigator.vibrate(100); } catch { /* noop */ }
              scanner.stop().catch(() => {});
              router.push(`${ROUTES.STAFF_CHECKIN}?member=${memberId}`);
            } else {
              setStatus("invalid_qr");
              setTimeout(() => {
                if (!hasNavigatedRef.current) setStatus("scanning");
              }, 1500);
            }
          },
          () => {
            // qr code not detected in frame — ignore
          },
        )
        .then(() => {
          if (!cancelled) setStatus("scanning");
        })
        .catch(() => {
          if (!cancelled) setStatus("permission_denied");
        });
    });

    return () => {
      cancelled = true;
      const s = scannerRef.current;
      if (s) {
        try {
          const state = s.getState();
          if (state === 2 /* SCANNING */ || state === 3 /* PAUSED */) {
            s.stop()
              .then(() => s.clear())
              .catch(() => {});
          }
        } catch {
          // scanner not initialized yet
        }
      }
    };
  }, [router]);

  return (
    <div className="space-y-4">
      <div className="text-center">
        <h1 className="text-lg font-semibold">{t("staff.scanQr")}</h1>
      </div>

      {/* Scanner container */}
      <div
        id="qr-reader"
        className="w-full rounded-xl overflow-hidden bg-black min-h-[300px]"
      />

      {/* Status overlays */}
      {status === "initializing" && (
        <div className="flex flex-col items-center gap-2 py-4">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">{t("common.loading")}</p>
        </div>
      )}

      {status === "permission_denied" && (
        <div className="flex flex-col items-center gap-3 py-6">
          <Camera className="h-10 w-10 text-muted-foreground/50" />
          <p className="text-sm text-muted-foreground text-center px-4">
            {t("staff.cameraPermission")}
          </p>
        </div>
      )}

      {status === "invalid_qr" && (
        <div className="flex items-center justify-center gap-2 py-3">
          <AlertCircle className="h-4 w-4 text-amber-500" />
          <p className="text-sm text-amber-600">{t("staff.invalidQr")}</p>
        </div>
      )}
    </div>
  );
}
