"use client";

import { useEffect, useState } from "react";
import { QrCode, Loader2, CheckCircle, XCircle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { apiClient } from "@/lib/api-client";
import { useTranslate } from "@tolgee/react";
import QRCode from "react-qr-code";

interface PromoCode {
  id: string;
  code: string;
  tier_grant: string | null;
  quota: number;
  uses_count: number;
  reg_commission: number;
  checkin_commission_flat: number | null;
  checkin_commission_pct: number | null;
  is_active: boolean;
  created_at: string;
}

export default function PromoterCodesPage() {
  const { t } = useTranslate();
  const [codes, setCodes] = useState<PromoCode[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    apiClient.get<PromoCode[]>("/promoters/codes")
      .then(setCodes)
      .catch(() => {})
      .finally(() => setIsLoading(false));
  }, []);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[300px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-light tracking-wide">{t("promoterCodes.title")}</h1>
        <p className="text-sm text-muted-foreground mt-1">{t("promoterCodes.subtitle")}</p>
      </div>

      {codes.length === 0 ? (
        <Card className="rounded-xl border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center gap-2">
            <QrCode className="h-10 w-10 text-muted-foreground/30" />
            <p className="text-sm text-muted-foreground">{t("promoterCodes.noCodes")}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {codes.map((code) => (
            <Card key={code.id} className="rounded-xl">
              <CardContent className="p-4">
                <div className="flex flex-col sm:flex-row gap-4 items-start">
                  <div className="bg-white p-3 rounded-xl border border-border shrink-0">
                    <QRCode
                      value={`${typeof window !== "undefined" ? window.location.origin : ""}/qr-register?promo=${code.code}`}
                      size={120}
                    />
                  </div>
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-2">
                      <p className="font-mono font-medium tracking-wider text-lg">{code.code}</p>
                      {code.is_active ? (
                        <CheckCircle className="h-3.5 w-3.5 text-emerald-500" />
                      ) : (
                        <XCircle className="h-3.5 w-3.5 text-rose-500" />
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span>{t("promoterCodes.uses", { count: code.uses_count })}</span>
                      {code.quota > 0 && <span>{t("promoterCodes.quota", { quota: code.quota })}</span>}
                    </div>
                    <div className="text-sm text-primary font-medium">
                      ฿{Number(code.reg_commission).toLocaleString()} <span className="text-muted-foreground font-normal">{t("promoterCodes.commission")}</span>
                    </div>
                    <p className="text-xs text-muted-foreground bg-muted rounded px-2 py-1 font-mono truncate">
                      {typeof window !== "undefined" ? window.location.origin : ""}/qr-register?promo={code.code}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
