"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { TrendingUp, Users, DollarSign, Loader2, ArrowRight, Wallet } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { apiClient } from "@/lib/api-client";
import { ROUTES } from "@/lib/constants";
import { useTranslate } from "@tolgee/react";

interface PromoterStats {
  total_codes: number;
  total_uses: number;
  total_revenue: number;
  commission_earned: number;
  pending_payout: number;
}

export default function PromoterDashboardPage() {
  const { t } = useTranslate();
  const [stats, setStats] = useState<PromoterStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    apiClient.get<PromoterStats>("/promoters/dashboard")
      .then(setStats)
      .catch(() => {})
      .finally(() => setIsLoading(false));
  }, []);

  const fmt = (n: number) =>
    `฿${Number(n).toLocaleString("en-US", { minimumFractionDigits: 0 })}`;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[300px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-3xl">
      <div>
        <h1 className="text-2xl font-light tracking-wide">{t("promoterDashboard.title")}</h1>
        <p className="text-sm text-muted-foreground mt-1">{t("promoterDashboard.subtitle")}</p>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[
          { label: t("promoterDashboard.totalConversions"), value: stats?.total_uses ?? 0, icon: TrendingUp, format: (v: number) => v.toString() },
          { label: t("promoterDashboard.revenueAttributed"), value: stats?.total_revenue ?? 0, icon: DollarSign, format: fmt },
          { label: t("promoterDashboard.commissionEarned"), value: stats?.commission_earned ?? 0, icon: DollarSign, format: fmt },
          { label: t("promoterDashboard.pendingPayout"), value: stats?.pending_payout ?? 0, icon: Wallet, format: fmt },
        ].map(({ label, value, icon: Icon, format }) => (
          <Card key={label} className="rounded-xl">
            <CardContent className="p-5 flex items-center gap-4">
              <div className="rounded-lg bg-primary/10 p-2.5 shrink-0">
                <Icon className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide">{label}</p>
                <p className="text-2xl font-light">{format(value)}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Quick links */}
      <div className="flex flex-col sm:flex-row gap-3">
        <Link href={ROUTES.PROMOTER_CODES} className="flex-1">
          <Button variant="outline" className="w-full justify-between">
            {t("promoterDashboard.manageCodes")} <ArrowRight className="h-4 w-4" />
          </Button>
        </Link>
        <Link href={ROUTES.PROMOTER_PAYOUTS} className="flex-1">
          <Button variant="outline" className="w-full justify-between">
            {t("promoterDashboard.payoutRequests")} <ArrowRight className="h-4 w-4" />
          </Button>
        </Link>
      </div>
    </div>
  );
}
