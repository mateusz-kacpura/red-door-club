"use client";

import { useEffect, useState } from "react";
import { Users, Loader2, DollarSign, TrendingUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { apiClient } from "@/lib/api-client";
import { toast } from "sonner";
import { useTranslate } from "@tolgee/react";

interface PromoterRow {
  promoter_id: string;
  full_name: string | null;
  email: string;
  company_name: string | null;
  total_codes: number;
  total_uses: number;
  total_revenue: number;
  commission_earned: number;
  pending_payout: number;
}

export default function AdminPromotersPage() {
  const { t } = useTranslate();
  const [promoters, setPromoters] = useState<PromoterRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    apiClient.get<PromoterRow[]>("/admin/promoters")
      .then(setPromoters)
      .catch(() => {})
      .finally(() => setIsLoading(false));
  }, []);

  const fmt = (n: number) => `฿${Number(n).toLocaleString("en-US", { minimumFractionDigits: 0 })}`;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-light tracking-wide">{t("promoters.title")}</h1>
        <p className="text-sm text-muted-foreground mt-1">{t("promoters.managementSubtitle")}</p>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : promoters.length === 0 ? (
        <Card className="rounded-xl border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center gap-2">
            <Users className="h-8 w-8 text-muted-foreground/30" />
            <p className="text-sm text-muted-foreground">{t("promoters.noPromoters")}</p>
            <p className="text-xs text-muted-foreground">
              {t("promoters.grantHint")}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {promoters.map((p) => (
            <Card key={p.promoter_id} className="rounded-xl">
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{p.full_name ?? "Unknown"}</p>
                    <p className="text-xs text-muted-foreground">{p.email}</p>
                    {p.company_name && (
                      <p className="text-xs text-muted-foreground truncate">{p.company_name}</p>
                    )}
                  </div>

                  <div className="grid grid-cols-3 gap-4 text-center shrink-0">
                    <div>
                      <p className="text-xs text-muted-foreground">{t("promoters.colUses")}</p>
                      <p className="text-sm font-medium">{p.total_uses}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">{t("promoters.colRevenue")}</p>
                      <p className="text-sm font-medium text-primary">{fmt(p.total_revenue)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">{t("promoters.colCommission")}</p>
                      <p className="text-sm font-medium">{fmt(p.commission_earned)}</p>
                    </div>
                  </div>
                </div>

                {p.pending_payout > 0 && (
                  <div className="mt-3 flex items-center justify-between rounded-lg bg-yellow-500/5 border border-yellow-500/20 px-3 py-2">
                    <p className="text-xs text-yellow-600">
                      {t("promoters.pendingPayout", { amount: fmt(p.pending_payout) })}
                    </p>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-6 text-xs"
                      onClick={async () => {
                        try {
                          await apiClient.get(`/admin/promoters`); // TODO: navigate to payout approval
                          toast.info("Use admin/promoters/payouts to approve.");
                        } catch { /* */ }
                      }}
                    >
                      {t("promoters.review")}
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
