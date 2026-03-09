"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useTranslate } from "@tolgee/react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { apiClient } from "@/lib/api-client";
import { useAuth } from "@/hooks";
import { useWebSocket } from "@/hooks/useWebSocket";
import { toast } from "sonner";
import { ROUTES } from "@/lib/constants";
import {
  Users,
  CalendarDays,
  Receipt,
  Network,
  ArrowRight,
  Building2,
  Star,
  AlertTriangle,
} from "lucide-react";

interface NetworkingReport {
  connections_count: number;
  events_attended: number;
  total_spent: number;
  match_score_count: number;
  top_segments: string[];
  suggested_next_steps: string[];
}

interface SuggestedConnection {
  member_id: string;
  full_name: string | null;
  tier: string | null;
  company_name: string | null;
  industry: string | null;
  shared_segments: string[];
  score: number;
}

interface MemberNotification {
  tap_type: string;
  action: string;
  message: string;
}

export default function DashboardPage() {
  const { t } = useTranslate();
  const { user } = useAuth();
  const [report, setReport] = useState<NetworkingReport | null>(null);
  const [suggestions, setSuggestions] = useState<SuggestedConnection[]>([]);
  const [points, setPoints] = useState<number | null>(null);
  const [engagementRisk, setEngagementRisk] = useState<{ risk_level: string; tips: string[] } | null>(null);

  useEffect(() => {
    apiClient.get<NetworkingReport>("/members/networking-report")
      .then(setReport)
      .catch(() => {});
    apiClient.get<SuggestedConnection[]>("/members/suggestions?limit=3")
      .then(setSuggestions)
      .catch(() => {});
    apiClient.get<{ balance: number }>("/members/points")
      .then((d) => setPoints(d.balance))
      .catch(() => {});
    apiClient.get<{ risk_level: string; tips: string[] }>("/members/engagement-health")
      .then(setEngagementRisk)
      .catch(() => {});
  }, []);

  // Member WebSocket: show toasts for personal events (payments, locker)
  useWebSocket("/api/v1/ws/member/live", (data) => {
    const msg = data as MemberNotification;
    if (msg.tap_type === "payment_tap") {
      toast.success("Payment added to tab", { description: msg.message, duration: 5000 });
    } else if (msg.tap_type === "locker_access") {
      toast.info("Locker update", { description: msg.message, duration: 5000 });
    } else if (msg.action === "points_earned") {
      toast.success("RD Points earned", { description: msg.message, duration: 5000 });
      apiClient.get<{ balance: number }>("/members/points").then((d) => setPoints(d.balance)).catch(() => {});
    }
  });

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return t("dashboard.greetingMorning");
    if (h < 18) return t("dashboard.greetingAfternoon");
    return t("dashboard.greetingEvening");
  };

  const firstName = (user as { name?: string } | null)?.name?.split(" ")[0] ?? "Member";

  return (
    <div className="space-y-8">
      {/* Welcome */}
      <div>
        <h1 className="text-2xl font-light tracking-wide">
          {greeting()}, <span className="text-primary">{firstName}</span>
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          {t("dashboard.welcomeBack")}
        </p>
      </div>

      {/* Engagement Health Banner (only for high/critical risk) */}
      {engagementRisk && (engagementRisk.risk_level === "high" || engagementRisk.risk_level === "critical") && (
        <div className="rounded-xl border border-orange-800/50 bg-orange-900/10 p-4 space-y-2">
          <div className="flex items-center gap-2 text-orange-400">
            <AlertTriangle className="w-4 h-4" />
            <span className="text-sm font-medium">{t("dashboard.missYou")}</span>
          </div>
          <ul className="space-y-1">
            {engagementRisk.tips.map((tip, i) => (
              <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                <span className="text-orange-400 mt-0.5">•</span>
                {tip}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Stat cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="rounded-xl">
          <CardContent className="p-5 flex items-center gap-4">
            <div className="rounded-lg bg-primary/10 p-2.5">
              <Users className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide">{t("dashboard.connections")}</p>
              <p className="text-2xl font-light">{report?.connections_count ?? "—"}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-xl">
          <CardContent className="p-5 flex items-center gap-4">
            <div className="rounded-lg bg-primary/10 p-2.5">
              <CalendarDays className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide">{t("dashboard.eventsAttended")}</p>
              <p className="text-2xl font-light">{report?.events_attended ?? "—"}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-xl">
          <CardContent className="p-5 flex items-center gap-4">
            <div className="rounded-lg bg-primary/10 p-2.5">
              <Receipt className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide">{t("dashboard.totalSpent")}</p>
              <p className="text-2xl font-light">
                {report ? `฿${report.total_spent.toLocaleString()}` : "—"}
              </p>
            </div>
          </CardContent>
        </Card>

        <Link href={ROUTES.LOYALTY}>
          <Card className="rounded-xl hover:bg-muted/20 transition-colors cursor-pointer">
            <CardContent className="p-5 flex items-center gap-4">
              <div className="rounded-lg bg-primary/10 p-2.5">
                <Star className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide">{t("dashboard.rdPoints")}</p>
                <p className="text-2xl font-light">{points ?? "—"}</p>
              </div>
            </CardContent>
          </Card>
        </Link>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Suggested connections */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
              {t("dashboard.yourMatches")}
            </h2>
            <Link
              href={ROUTES.CONNECTIONS}
              className="flex items-center gap-1 text-xs text-primary hover:underline"
            >
              {t("dashboard.seeAll")} <ArrowRight className="h-3 w-3" />
            </Link>
          </div>

          {suggestions.length === 0 ? (
            <Card className="rounded-xl">
              <CardContent className="p-5 text-center text-sm text-muted-foreground">
                <Network className="h-8 w-8 mx-auto mb-2 opacity-30" />
                <p>{t("dashboard.completeProfile")}</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {suggestions.map((s) => (
                <Card key={s.member_id} className="rounded-xl">
                  <CardContent className="p-4 flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{s.full_name ?? "Member"}</p>
                      {s.company_name && (
                        <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                          <Building2 className="h-3 w-3 shrink-0" />
                          {s.company_name}
                        </p>
                      )}
                      {s.shared_segments.length > 0 && (
                        <p className="text-xs text-primary mt-1">
                          {s.shared_segments.length} shared interest{s.shared_segments.length !== 1 ? "s" : ""}
                        </p>
                      )}
                    </div>
                    {s.tier && (
                      <Badge variant="outline" className="text-xs shrink-0 capitalize">
                        {s.tier}
                      </Badge>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>

        {/* Networking next steps */}
        <div className="space-y-3">
          <h2 className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
            {t("dashboard.nextSteps")}
          </h2>
          <Card className="rounded-xl">
            <CardContent className="p-5 space-y-3">
              {report?.suggested_next_steps && report.suggested_next_steps.length > 0 ? (
                report.suggested_next_steps.map((step, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <div className="h-1.5 w-1.5 rounded-full bg-primary mt-1.5 shrink-0" />
                    <p className="text-sm text-muted-foreground">{step}</p>
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">{t("dashboard.loadingRecommendations")}</p>
              )}
            </CardContent>
          </Card>

          {/* Networking report link */}
          <Link
            href={ROUTES.NETWORKING_REPORT}
            className="flex items-center justify-between rounded-xl border p-4 hover:bg-muted/30 transition-colors"
          >
            <div className="flex items-center gap-3">
              <Network className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium">{t("dashboard.fullNetworkingReport")}</span>
            </div>
            <ArrowRight className="h-4 w-4 text-muted-foreground" />
          </Link>
        </div>
      </div>
    </div>
  );
}
