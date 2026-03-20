"use client";

import { useEffect, useState } from "react";
import { Users, TrendingUp, DollarSign, Trophy, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { apiClient } from "@/lib/api-client";
import { useTranslate } from "@tolgee/react";

interface StaffMember {
  rank: number;
  staff_id: string;
  full_name: string;
  today_checkins: number;
  month_checkins: number;
  month_revenue: number;
  total_checkins: number;
  total_revenue: number;
  events_worked: number;
  avg_per_event: number;
}

interface StaffPerformance {
  summary: {
    total_staff: number;
    month_checkins: number;
    month_revenue: number;
    top_performer: string | null;
  };
  staff: StaffMember[];
}

function formatAmount(amount: number) {
  return `฿${Number(amount).toLocaleString("en-US", { minimumFractionDigits: 0 })}`;
}

export default function AdminStaffPage() {
  const { t } = useTranslate();
  const [data, setData] = useState<StaffPerformance | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    apiClient
      .get<StaffPerformance>("/admin/analytics/staff")
      .then(setData)
      .catch(() => {})
      .finally(() => setIsLoading(false));
  }, []);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-light tracking-wide">{t("staffAnalytics.title")}</h1>
        <p className="text-sm text-muted-foreground mt-1">{t("staffAnalytics.subtitle")}</p>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : data ? (
        <>
          {/* KPI Cards */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card className="rounded-xl">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {t("staffAnalytics.activeStaff")}
                </CardTitle>
                <Users className="h-4 w-4 text-primary" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-light">{data.summary.total_staff}</div>
                <p className="text-xs text-muted-foreground mt-1">{t("staffAnalytics.activeStaffDesc")}</p>
              </CardContent>
            </Card>

            <Card className="rounded-xl">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {t("staffAnalytics.monthCheckins")}
                </CardTitle>
                <TrendingUp className="h-4 w-4 text-primary" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-light">{data.summary.month_checkins}</div>
                <p className="text-xs text-muted-foreground mt-1">{t("staffAnalytics.monthCheckinsDesc")}</p>
              </CardContent>
            </Card>

            <Card className="rounded-xl">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {t("staffAnalytics.monthRevenue")}
                </CardTitle>
                <DollarSign className="h-4 w-4 text-primary" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-light">{formatAmount(data.summary.month_revenue)}</div>
                <p className="text-xs text-muted-foreground mt-1">{t("staffAnalytics.monthRevenueDesc")}</p>
              </CardContent>
            </Card>

            <Card className="rounded-xl">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {t("staffAnalytics.topPerformer")}
                </CardTitle>
                <Trophy className="h-4 w-4 text-primary" />
              </CardHeader>
              <CardContent>
                <div className="text-xl font-light truncate">{data.summary.top_performer || "-"}</div>
                <p className="text-xs text-muted-foreground mt-1">{t("staffAnalytics.topPerformerDesc")}</p>
              </CardContent>
            </Card>
          </div>

          {/* Staff Leaderboard Table */}
          <Card className="rounded-xl">
            <CardHeader>
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Trophy className="h-4 w-4 text-primary" />
                {t("staffAnalytics.leaderboard")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {data.staff.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  {t("staffAnalytics.noData")}
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border text-muted-foreground">
                        <th className="text-left py-2 px-2 font-medium">#</th>
                        <th className="text-left py-2 px-2 font-medium">{t("staffAnalytics.colName")}</th>
                        <th className="text-right py-2 px-2 font-medium">{t("staffAnalytics.colToday")}</th>
                        <th className="text-right py-2 px-2 font-medium">{t("staffAnalytics.colMonth")}</th>
                        <th className="text-right py-2 px-2 font-medium">{t("staffAnalytics.colRevenue")}</th>
                        <th className="text-right py-2 px-2 font-medium">{t("staffAnalytics.colAvgEvent")}</th>
                        <th className="text-right py-2 px-2 font-medium">{t("staffAnalytics.colAllTime")}</th>
                        <th className="text-right py-2 px-2 font-medium">{t("staffAnalytics.colEvents")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.staff.map((s) => (
                        <tr key={s.staff_id} className="border-b border-border/50 hover:bg-muted/50 transition-colors">
                          <td className="py-2.5 px-2 text-muted-foreground">{s.rank}</td>
                          <td className="py-2.5 px-2 font-medium">{s.full_name}</td>
                          <td className="py-2.5 px-2 text-right">{s.today_checkins}</td>
                          <td className="py-2.5 px-2 text-right text-primary font-medium">{s.month_checkins}</td>
                          <td className="py-2.5 px-2 text-right">{formatAmount(s.month_revenue)}</td>
                          <td className="py-2.5 px-2 text-right">{s.avg_per_event}</td>
                          <td className="py-2.5 px-2 text-right text-muted-foreground">{s.total_checkins}</td>
                          <td className="py-2.5 px-2 text-right text-muted-foreground">{s.events_worked}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      ) : (
        <p className="text-sm text-muted-foreground">{t("staffAnalytics.noData")}</p>
      )}
    </div>
  );
}
