"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, Loader2, Users, TrendingDown, Heart, ShieldAlert } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { apiClient } from "@/lib/api-client";
import Link from "next/link";
import { useTranslate } from "@tolgee/react";

const TIER_COLORS: Record<string, string> = {
  platinum: "text-zinc-200 border-zinc-400",
  gold: "text-[#C9A96E] border-[#C9A96E]",
  silver: "text-zinc-400 border-zinc-500",
  bronze: "text-orange-400 border-orange-600",
};

const RISK_CONFIG: Record<string, { labelKey: string; color: string; bg: string }> = {
  healthy: { labelKey: "churn.healthy", color: "text-emerald-400", bg: "bg-emerald-400/10" },
  low: { labelKey: "churn.riskLow", color: "text-sky-400", bg: "bg-sky-400/10" },
  medium: { labelKey: "churn.riskMedium", color: "text-yellow-400", bg: "bg-yellow-400/10" },
  high: { labelKey: "churn.riskHigh", color: "text-orange-400", bg: "bg-orange-400/10" },
  critical: { labelKey: "churn.critical", color: "text-red-400", bg: "bg-red-400/10" },
};

interface ChurnMember {
  member_id: string;
  full_name: string | null;
  tier: string | null;
  company_name: string | null;
  churn_score: number;
  risk_level: string;
  last_seen_at: string | null;
  primary_risk_factor: string;
}

interface ChurnOverview {
  retention_rate_30d: number;
  avg_churn_score: number;
  total_members: number;
  active_30d: number;
  risk_distribution: Record<string, number>;
  at_risk_members: ChurnMember[];
}

function ScoreBar({ score }: { score: number }) {
  const color =
    score >= 80 ? "bg-red-500"
    : score >= 60 ? "bg-orange-500"
    : score >= 40 ? "bg-yellow-500"
    : "bg-emerald-500";
  return (
    <div className="w-24 h-2 bg-zinc-800 rounded-full overflow-hidden">
      <div className={`h-full rounded-full ${color}`} style={{ width: `${score}%` }} />
    </div>
  );
}

export default function AdminChurnPage() {
  const { t } = useTranslate();
  const [overview, setOverview] = useState<ChurnOverview | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    apiClient.get<ChurnOverview>("/admin/analytics/churn")
      .then(setOverview)
      .catch(() => {})
      .finally(() => setIsLoading(false));
  }, []);

  if (isLoading) {
    return (
      <div className="p-6 flex items-center gap-2 text-zinc-400">
        <Loader2 className="w-4 h-4 animate-spin" /> {t("churn.loading")}
      </div>
    );
  }

  if (!overview) {
    return <div className="p-6 text-zinc-500">{t("churn.error")}</div>;
  }

  const dist = overview.risk_distribution;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3">
        <AlertTriangle className="w-7 h-7 text-[#C9A96E]" />
        <div>
          <h1 className="text-2xl font-bold text-white">{t("churn.title")}</h1>
          <p className="text-zinc-400 text-sm">{t("churn.dashboardSubtitle")}</p>
        </div>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-zinc-900 border-zinc-800">
          <CardContent className="p-4 space-y-1">
            <div className="flex items-center gap-2 text-zinc-400 text-xs">
              <Heart className="w-3 h-3" /> {t("churn.retentionRate")}
            </div>
            <p className="text-2xl font-bold text-emerald-400">{overview.retention_rate_30d}%</p>
            <p className="text-xs text-zinc-500">{t("churn.membersOfTotal", { active: overview.active_30d, total: overview.total_members })}</p>
          </CardContent>
        </Card>
        <Card className="bg-zinc-900 border-zinc-800">
          <CardContent className="p-4 space-y-1">
            <div className="flex items-center gap-2 text-zinc-400 text-xs">
              <TrendingDown className="w-3 h-3" /> {t("churn.avgChurnScore")}
            </div>
            <p className="text-2xl font-bold text-white">{overview.avg_churn_score}</p>
            <p className="text-xs text-zinc-500">{t("churn.outOf100")}</p>
          </CardContent>
        </Card>
        <Card className="bg-red-900/20 border-red-800/30">
          <CardContent className="p-4 space-y-1">
            <div className="flex items-center gap-2 text-red-400 text-xs">
              <ShieldAlert className="w-3 h-3" /> {t("churn.critical")}
            </div>
            <p className="text-2xl font-bold text-red-400">{dist.critical ?? 0}</p>
            <p className="text-xs text-zinc-500">{t("churn.members")}</p>
          </CardContent>
        </Card>
        <Card className="bg-emerald-900/10 border-emerald-800/20">
          <CardContent className="p-4 space-y-1">
            <div className="flex items-center gap-2 text-emerald-400 text-xs">
              <Users className="w-3 h-3" /> {t("churn.healthy")}
            </div>
            <p className="text-2xl font-bold text-emerald-400">{dist.healthy ?? 0}</p>
            <p className="text-xs text-zinc-500">{t("churn.members")}</p>
          </CardContent>
        </Card>
      </div>

      {/* At-risk table */}
      <Card className="bg-zinc-900 border-zinc-800">
        <CardHeader className="pb-3">
          <CardTitle className="text-base text-zinc-200">{t("churn.atRiskMembers")}</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {overview.at_risk_members.length === 0 ? (
            <p className="px-6 py-8 text-center text-zinc-500">
              {t("churn.noAtRisk")}
              <span className="block mt-1 text-sm">{t("churn.allHealthy")}</span>
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-800 text-zinc-500 text-xs uppercase">
                    <th className="px-4 py-3 text-left">{t("churn.colHash")}</th>
                    <th className="px-4 py-3 text-left">{t("churn.colMember")}</th>
                    <th className="px-4 py-3 text-left">{t("churn.colTier")}</th>
                    <th className="px-4 py-3 text-left">{t("churn.colLastSeen")}</th>
                    <th className="px-4 py-3 text-left">{t("churn.colRisk")}</th>
                    <th className="px-4 py-3 text-left">{t("churn.colScore")}</th>
                    <th className="px-4 py-3 text-left">{t("churn.colPrimaryFactor")}</th>
                  </tr>
                </thead>
                <tbody>
                  {overview.at_risk_members.map((m, idx) => {
                    const risk = RISK_CONFIG[m.risk_level] ?? RISK_CONFIG.medium;
                    const tierColor = TIER_COLORS[m.tier?.toLowerCase() ?? ""] ?? "text-zinc-400 border-zinc-600";
                    const lastSeen = m.last_seen_at
                      ? new Date(m.last_seen_at).toLocaleDateString()
                      : t("churn.never");
                    return (
                      <tr key={m.member_id} className="border-b border-zinc-800/50 hover:bg-zinc-800/30">
                        <td className="px-4 py-3 text-zinc-500">{idx + 1}</td>
                        <td className="px-4 py-3">
                          <Link href={`/admin/members/${m.member_id}`} className="text-white hover:text-[#C9A96E]">
                            {m.full_name ?? "—"}
                          </Link>
                          {m.company_name && (
                            <p className="text-xs text-zinc-500">{m.company_name}</p>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {m.tier && (
                            <Badge variant="outline" className={`text-xs capitalize ${tierColor}`}>
                              {m.tier}
                            </Badge>
                          )}
                        </td>
                        <td className="px-4 py-3 text-zinc-400">{lastSeen}</td>
                        <td className="px-4 py-3">
                          <span className={`text-xs font-semibold px-2 py-0.5 rounded ${risk.color} ${risk.bg}`}>
                            {t(risk.labelKey)}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <ScoreBar score={m.churn_score} />
                            <span className="text-zinc-400 text-xs">{m.churn_score}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-zinc-400 text-xs max-w-[200px] truncate">
                          {m.primary_risk_factor}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
