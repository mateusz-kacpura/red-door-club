"use client";

import { useEffect, useState } from "react";
import { Users, TrendingUp, CalendarDays, Eye, Loader2, DollarSign, Trophy, Star, QrCode, Building2, BarChart3, Clock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { apiClient } from "@/lib/api-client";
import type { AnalyticsOverview, RevenueAnalytics } from "@/types";
import { useTranslate } from "@tolgee/react";

function formatAmount(amount: number) {
  return `฿${Number(amount).toLocaleString("en-US", { minimumFractionDigits: 0 })}`;
}

interface LoyaltyAnalytics {
  points_earned_total: number;
  points_redeemed_total: number;
  avg_balance: number;
  tier_distribution: Record<string, number>;
}

interface PromoterAnalytics {
  active_codes: number;
  total_conversions: number;
  total_attributed_revenue: number;
  top_promoter: string | null;
  top_promoter_uses: number;
}

interface CorporateAnalytics {
  active_accounts: number;
  total_seats: number;
  utilized_seats: number;
  seat_utilization_pct: number;
  total_annual_revenue: number;
  monthly_revenue: number;
}

interface EventOption {
  id: string;
  title: string;
}

interface EventForecast {
  event_id: string;
  event_title: string;
  predicted_attendees: number;
  actual_capacity: number;
  capacity_utilization_pct: number;
  confidence: string;
  similar_events_count: number;
  recommendation: string;
}

interface PeakHours {
  heatmap: number[][];
  busiest_slot: { weekday_name: string; hour: number; count: number };
  quietest_slot: { weekday_name: string; hour: number; count: number };
}

export default function AdminAnalyticsPage() {
  const { t } = useTranslate();
  const [data, setData] = useState<AnalyticsOverview | null>(null);
  const [revenue, setRevenue] = useState<RevenueAnalytics | null>(null);
  const [loyalty, setLoyalty] = useState<LoyaltyAnalytics | null>(null);
  const [promoters, setPromoters] = useState<PromoterAnalytics | null>(null);
  const [corporate, setCorporate] = useState<CorporateAnalytics | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRevLoading, setIsRevLoading] = useState(true);
  const [events, setEvents] = useState<EventOption[]>([]);
  const [selectedEventId, setSelectedEventId] = useState<string>("");
  const [forecast, setForecast] = useState<EventForecast | null>(null);
  const [forecastLoading, setForecastLoading] = useState(false);
  const [peakHours, setPeakHours] = useState<PeakHours | null>(null);

  useEffect(() => {
    apiClient.get<AnalyticsOverview>("/admin/analytics")
      .then(setData)
      .catch(() => {})
      .finally(() => setIsLoading(false));

    apiClient.get<RevenueAnalytics>("/admin/analytics/revenue")
      .then(setRevenue)
      .catch(() => {})
      .finally(() => setIsRevLoading(false));

    apiClient.get<LoyaltyAnalytics>("/admin/analytics/loyalty").then(setLoyalty).catch(() => {});
    apiClient.get<PromoterAnalytics>("/admin/analytics/promoters").then(setPromoters).catch(() => {});
    apiClient.get<CorporateAnalytics>("/admin/analytics/corporate").then(setCorporate).catch(() => {});
    apiClient.get<{ items: EventOption[] }>("/admin/events").then((res) => {
      setEvents(Array.isArray(res) ? res : (res as { items?: EventOption[] }).items ?? []);
    }).catch(() => {});
    apiClient.get<PeakHours>("/admin/analytics/peak-hours").then(setPeakHours).catch(() => {});
  }, []);

  const loadForecast = async (eventId: string) => {
    if (!eventId) return;
    setForecastLoading(true);
    setForecast(null);
    apiClient.get<EventForecast>(`/admin/analytics/forecast/${eventId}`)
      .then(setForecast)
      .catch(() => {})
      .finally(() => setForecastLoading(false));
  };

  const stats = data
    ? [
        { label: t("analytics.totalMembers"), value: data.total_members, icon: Users, description: t("analytics.totalMembersDesc") },
        { label: t("analytics.totalProspects"), value: data.total_prospects, icon: Eye, description: t("analytics.totalProspectsDesc") },
        { label: t("analytics.activeToday"), value: data.active_today, icon: TrendingUp, description: t("analytics.activeTodayDesc") },
        { label: t("analytics.eventsThisWeek"), value: data.events_this_week, icon: CalendarDays, description: t("analytics.eventsThisWeekDesc") },
      ]
    : [];

  const DAY_KEYS = [
    t("analytics.mon"),
    t("analytics.tue"),
    t("analytics.wed"),
    t("analytics.thu"),
    t("analytics.fri"),
    t("analytics.sat"),
    t("analytics.sun"),
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-light tracking-wide">{t("analytics.title")}</h1>
        <p className="text-sm text-muted-foreground mt-1">{t("analytics.subtitle")}</p>
      </div>

      {/* KPI Cards */}
      {isLoading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {stats.map(({ label, value, icon: Icon, description }) => (
            <Card key={label} className="rounded-xl">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
                <Icon className="h-4 w-4 text-primary" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-light">{value.toLocaleString()}</div>
                <p className="text-xs text-muted-foreground mt-1">{description}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Revenue Section */}
      <div>
        <h2 className="text-lg font-light tracking-wide mb-4 flex items-center gap-2">
          <DollarSign className="h-5 w-5 text-primary" />
          {t("analytics.revenueOverview")}
        </h2>

        {isRevLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : revenue ? (
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-3">
              {[
                { label: t("analytics.today"), value: revenue.today },
                { label: t("analytics.thisWeek"), value: revenue.this_week },
                { label: t("analytics.thisMonth"), value: revenue.this_month },
              ].map(({ label, value }) => (
                <Card key={label} className="rounded-xl">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-light text-primary">{formatAmount(Number(value))}</div>
                    <p className="text-xs text-muted-foreground mt-1">{t("analytics.fromClosedTabs")}</p>
                  </CardContent>
                </Card>
              ))}
            </div>

            {revenue.top_spenders.length > 0 && (
              <Card className="rounded-xl">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <Trophy className="h-4 w-4 text-primary" />
                    {t("analytics.topSpenders")}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="divide-y divide-border">
                    {revenue.top_spenders.map((spender, idx) => (
                      <div key={spender.member_id} className="flex items-center justify-between py-2 text-sm">
                        <div className="flex items-center gap-3">
                          <span className="text-muted-foreground w-5 text-center">{idx + 1}</span>
                          <span>{spender.full_name ?? "Unknown"}</span>
                        </div>
                        <span className="font-medium">{formatAmount(Number(spender.total_spent))}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">{t("analytics.noRevenueData")}</p>
        )}
      </div>

      {/* Loyalty Section */}
      <div>
        <h2 className="text-lg font-light tracking-wide mb-4 flex items-center gap-2">
          <Star className="h-5 w-5 text-primary" />
          {t("analytics.loyaltyPoints")}
        </h2>
        {loyalty ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { label: t("analytics.pointsEarned"), value: loyalty.points_earned_total.toLocaleString(), sub: t("analytics.allTime") },
              { label: t("analytics.pointsRedeemed"), value: loyalty.points_redeemed_total.toLocaleString(), sub: t("analytics.allTime") },
              { label: t("analytics.avgBalance"), value: loyalty.avg_balance.toLocaleString(), sub: t("analytics.perActiveMember") },
              { label: t("analytics.tierDistribution"), value: Object.keys(loyalty.tier_distribution).length.toString(), sub: t("analytics.tiersActive") },
            ].map(({ label, value, sub }) => (
              <Card key={label} className="rounded-xl">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-light text-primary">{value}</div>
                  <p className="text-xs text-muted-foreground mt-1">{sub}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <div className="flex items-center justify-center py-6">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
          </div>
        )}
      </div>

      {/* Promoters Section */}
      <div>
        <h2 className="text-lg font-light tracking-wide mb-4 flex items-center gap-2">
          <QrCode className="h-5 w-5 text-primary" />
          {t("analytics.promoterNetwork")}
        </h2>
        {promoters ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[
              { label: t("analytics.activeCodes"), value: promoters.active_codes.toString(), sub: t("analytics.activeCodesDesc") },
              { label: t("analytics.totalConversions"), value: promoters.total_conversions.toString(), sub: t("analytics.totalConversionsDesc") },
              { label: t("analytics.attributedRevenue"), value: formatAmount(promoters.total_attributed_revenue), sub: t("analytics.attributedRevenueDesc") },
            ].map(({ label, value, sub }) => (
              <Card key={label} className="rounded-xl">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-light text-primary">{value}</div>
                  <p className="text-xs text-muted-foreground mt-1">{sub}</p>
                </CardContent>
              </Card>
            ))}
            {promoters.top_promoter && (
              <Card className="rounded-xl sm:col-span-2 lg:col-span-3">
                <CardContent className="p-4 flex items-center gap-3">
                  <Trophy className="h-4 w-4 text-yellow-400 shrink-0" />
                  <p className="text-sm">
                    {t("analytics.topPromoter")}: <span className="font-medium">{promoters.top_promoter}</span>
                    <span className="text-muted-foreground ml-2">({promoters.top_promoter_uses} {t("analytics.conversions")})</span>
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        ) : (
          <div className="flex items-center justify-center py-6">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
          </div>
        )}
      </div>

      {/* Forecasting Section */}
      <div>
        <h2 className="text-lg font-light tracking-wide mb-4 flex items-center gap-2">
          <BarChart3 className="h-5 w-5 text-primary" />
          {t("analytics.forecasting")}
        </h2>
        <div className="grid gap-6 md:grid-cols-2">
          {/* Event Forecast */}
          <Card className="rounded-xl">
            <CardContent className="p-5 space-y-4">
              <p className="text-sm text-muted-foreground">{t("analytics.selectEvent")}</p>
              <div className="flex gap-2">
                <select
                  className="flex-1 rounded-md border border-zinc-700 bg-zinc-900 text-white text-sm px-3 py-2"
                  value={selectedEventId}
                  onChange={(e) => {
                    setSelectedEventId(e.target.value);
                    loadForecast(e.target.value);
                  }}
                >
                  <option value="">{t("analytics.chooseEvent")}</option>
                  {events.map((ev) => (
                    <option key={ev.id} value={ev.id}>{ev.title}</option>
                  ))}
                </select>
              </div>
              {forecastLoading && (
                <div className="flex items-center gap-2 text-muted-foreground text-sm">
                  <Loader2 className="w-4 h-4 animate-spin" /> {t("analytics.predicting")}
                </div>
              )}
              {forecast && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">{t("analytics.predictedAttendees")}</span>
                    <span className="text-xl font-light text-primary">
                      {forecast.predicted_attendees} / {forecast.actual_capacity}
                    </span>
                  </div>
                  <div className="w-full h-2 bg-zinc-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary rounded-full"
                      style={{ width: `${Math.min(forecast.capacity_utilization_pct, 100)}%` }}
                    />
                  </div>
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>{forecast.capacity_utilization_pct}% {t("analytics.fillRate")}</span>
                    <span className={`px-2 py-0.5 rounded text-xs font-semibold
                      ${forecast.confidence === "high" ? "bg-emerald-500/10 text-emerald-400"
                      : forecast.confidence === "medium" ? "bg-yellow-500/10 text-yellow-400"
                      : "bg-zinc-700 text-zinc-400"}`}>
                      {forecast.confidence === "high" ? t("analytics.highConfidence") : forecast.confidence === "medium" ? t("analytics.mediumConfidence") : forecast.confidence}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground border-t border-zinc-800 pt-2">
                    {forecast.recommendation}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Peak Hours */}
          {peakHours && (
            <Card className="rounded-xl">
              <CardContent className="p-5 space-y-3">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-primary" />
                  <p className="text-sm font-medium">{t("analytics.peakHours")}</p>
                </div>
                <div className="text-xs text-muted-foreground">
                  {t("analytics.busiest")} <span className="text-white">{peakHours.busiest_slot.weekday_name} at {peakHours.busiest_slot.hour}:00</span>
                  {" · "}
                  {t("analytics.quietest")} <span className="text-white">{peakHours.quietest_slot.weekday_name} at {peakHours.quietest_slot.hour}:00</span>
                </div>
                {/* Mini heatmap: show day labels + 4 sample hours */}
                <div className="space-y-1">
                  {DAY_KEYS.map((day, d) => {
                    const dayMax = Math.max(...peakHours.heatmap[d], 1);
                    return (
                      <div key={day} className="flex items-center gap-1.5">
                        <span className="text-xs text-zinc-500 w-7">{day}</span>
                        <div className="flex gap-0.5 flex-1">
                          {peakHours.heatmap[d].filter((_, h) => h % 3 === 0).map((val, h) => {
                            const intensity = Math.round((val / dayMax) * 4);
                            const bg = ["bg-zinc-900","bg-zinc-700","bg-yellow-900","bg-yellow-600","bg-[#C9A96E]"][intensity] ?? "bg-zinc-900";
                            return <div key={h} className={`h-3 flex-1 rounded-sm ${bg}`} title={`Hour ${h*3}: ${val} taps`} />;
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Corporate Section */}
      <div>
        <h2 className="text-lg font-light tracking-wide mb-4 flex items-center gap-2">
          <Building2 className="h-5 w-5 text-primary" />
          {t("analytics.corporateAccounts")}
        </h2>
        {corporate ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[
              { label: t("analytics.activeAccounts"), value: corporate.active_accounts.toString(), sub: t("analytics.activeAccountsDesc") },
              { label: t("analytics.seatUtilization"), value: `${corporate.seat_utilization_pct}%`, sub: `${corporate.utilized_seats}/${corporate.total_seats} ${t("analytics.seats")}` },
              { label: t("analytics.mrr"), value: formatAmount(corporate.monthly_revenue), sub: `฿${corporate.total_annual_revenue.toLocaleString()} ${t("analytics.annualised")}` },
            ].map(({ label, value, sub }) => (
              <Card key={label} className="rounded-xl">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-light text-primary">{value}</div>
                  <p className="text-xs text-muted-foreground mt-1">{sub}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <div className="flex items-center justify-center py-6">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
          </div>
        )}
      </div>
    </div>
  );
}
