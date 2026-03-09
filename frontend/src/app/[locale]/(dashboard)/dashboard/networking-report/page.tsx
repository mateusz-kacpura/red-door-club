"use client";

import { useEffect, useState } from "react";
import { Loader2, Network, Users, CalendarDays, Receipt, TrendingUp, MapPin, Sparkles } from "lucide-react";
import { useTranslate } from "@tolgee/react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { apiClient } from "@/lib/api-client";

interface NetworkingReport {
  connections_count: number;
  events_attended: number;
  total_spent: number;
  match_score_count: number;
  top_segments: string[];
  suggested_next_steps: string[];
}

interface EnhancedSuggestion {
  member_id: string;
  full_name: string | null;
  tier: string | null;
  company_name: string | null;
  industry: string | null;
  shared_segments: string[];
  shared_events_count: number;
  score: number;
  reason_text: string;
  is_in_venue: boolean;
}

interface WeeklyDigest {
  top_suggestions: EnhancedSuggestion[];
  next_steps: string[];
  generated_at: string;
}

export default function NetworkingReportPage() {
  const { t } = useTranslate();
  const [report, setReport] = useState<NetworkingReport | null>(null);
  const [digest, setDigest] = useState<WeeklyDigest | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      apiClient.get<NetworkingReport>("/members/networking-report"),
      apiClient.get<WeeklyDigest>("/members/digest").catch(() => null),
    ]).then(([rep, dig]) => {
      setReport(rep);
      setDigest(dig);
    }).catch(() => {}).finally(() => setIsLoading(false));
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-light tracking-wide">{t("networking.title")}</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {t("networking.subtitle")}
        </p>
      </div>

      {isLoading && (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      )}

      {!isLoading && report && (
        <div className="space-y-6">
          {/* Stats */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card className="rounded-xl">
              <CardContent className="p-5 flex items-center gap-4">
                <div className="rounded-lg bg-primary/10 p-2.5">
                  <Users className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">{t("networking.connectionsCount")}</p>
                  <p className="text-2xl font-light">{report.connections_count}</p>
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-xl">
              <CardContent className="p-5 flex items-center gap-4">
                <div className="rounded-lg bg-primary/10 p-2.5">
                  <CalendarDays className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">{t("networking.eventsAttended")}</p>
                  <p className="text-2xl font-light">{report.events_attended}</p>
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-xl">
              <CardContent className="p-5 flex items-center gap-4">
                <div className="rounded-lg bg-primary/10 p-2.5">
                  <Receipt className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">{t("networking.totalSpent")}</p>
                  <p className="text-2xl font-light">฿{report.total_spent.toLocaleString()}</p>
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-xl">
              <CardContent className="p-5 flex items-center gap-4">
                <div className="rounded-lg bg-primary/10 p-2.5">
                  <TrendingUp className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">{t("networking.matchScoreCount")}</p>
                  <p className="text-2xl font-light">{report.match_score_count}</p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Weekly Digest — This Week's Top Picks */}
          {digest && (digest.top_suggestions?.length ?? 0) > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" />
                <h2 className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
                  {t("dashboard.thisWeekTopPicks")}
                </h2>
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                {digest.top_suggestions.map((s) => (
                  <Card key={s.member_id} className="rounded-xl relative overflow-hidden">
                    {s.is_in_venue && (
                      <div className="absolute top-2 right-2 flex items-center gap-1 text-xs text-emerald-400">
                        <MapPin className="w-3 h-3" />
                        {t("dashboard.inVenueNow")}
                      </div>
                    )}
                    <CardContent className="p-4 space-y-2">
                      <p className="font-medium text-sm">{s.full_name ?? "Member"}</p>
                      {s.company_name && (
                        <p className="text-xs text-muted-foreground">{s.company_name}</p>
                      )}
                      <p className="text-xs text-primary">{s.reason_text}</p>
                      {s.shared_segments.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {s.shared_segments.slice(0, 2).map((seg) => (
                            <Badge key={seg} variant="outline" className="text-xs">{seg}</Badge>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}

          <div className="grid gap-6 md:grid-cols-2">
            {/* Your Profile Segments */}
            <Card className="rounded-xl">
              <CardContent className="p-5 space-y-4">
                <div className="flex items-center gap-2">
                  <Network className="h-4 w-4 text-primary" />
                  <h2 className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
                    Your Profile
                  </h2>
                </div>
                {report.top_segments.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {report.top_segments.map((seg) => (
                      <Badge key={seg} variant="secondary" className="text-xs">
                        {seg}
                      </Badge>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Add interests to your profile to unlock segment matching.
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Suggested Next Steps */}
            <Card className="rounded-xl">
              <CardContent className="p-5 space-y-4">
                <h2 className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
                  {t("networking.suggestedNextSteps")}
                </h2>
                <div className="space-y-3">
                  {report.suggested_next_steps.map((step, i) => (
                    <div key={i} className="flex items-start gap-3">
                      <div className="h-1.5 w-1.5 rounded-full bg-primary mt-1.5 shrink-0" />
                      <p className="text-sm text-muted-foreground">{step}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
