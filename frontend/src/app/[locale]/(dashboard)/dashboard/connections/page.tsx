"use client";

import { useEffect, useState } from "react";
import { Users, Building2, Briefcase, Loader2, Network, AlertCircle, ArrowRight } from "lucide-react";
import { useTranslate } from "@tolgee/react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { apiClient } from "@/lib/api-client";
import type { Connection } from "@/types";

const CONNECTION_TYPE_KEYS: Record<string, string> = {
  tap: "connections.typeNfcTap",
  staff_intro: "connections.typeIntroduction",
  event_match: "connections.typeEventMatch",
  manual: "connections.typeManual",
};

interface SuggestedConnection {
  member_id: string;
  full_name: string | null;
  tier: string | null;
  company_name: string | null;
  industry: string | null;
  shared_segments: string[];
  score: number;
  reason_text?: string;
  is_in_venue?: boolean;
}

interface ConnectionGap {
  user_segments: string[];
  connected_segments: Record<string, number>;
  missing_or_weak_segments: string[];
  priority_suggestions: SuggestedConnection[];
}

export default function ConnectionsPage() {
  const { t } = useTranslate();
  const [connections, setConnections] = useState<Connection[]>([]);
  const [suggestions, setSuggestions] = useState<SuggestedConnection[]>([]);
  const [gaps, setGaps] = useState<ConnectionGap | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      apiClient.get<Connection[]>("/members/connections"),
      apiClient.get<SuggestedConnection[]>("/members/suggestions?limit=3"),
      apiClient.get<ConnectionGap>("/members/connection-gaps").catch(() => null),
    ])
      .then(([conns, sugg, gapData]) => {
        setConnections(conns);
        setSuggestions(sugg);
        setGaps(gapData);
      })
      .catch(() => {})
      .finally(() => setIsLoading(false));
  }, []);

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("en-GB", {
      day: "numeric", month: "short", year: "numeric",
    });
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-light tracking-wide">{t("connections.title")}</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {t("connections.subtitle")}
        </p>
      </div>

      {isLoading && (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      )}

      {/* Suggested for You */}
      {!isLoading && suggestions.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Network className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
              {t("connections.suggestedForYou")}
            </h2>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {suggestions.map((s) => (
              <Card key={s.member_id} className="rounded-xl border-primary/20">
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{s.full_name ?? t("common.member")}</p>
                      {s.company_name && (
                        <p className="text-xs text-muted-foreground truncate flex items-center gap-1 mt-0.5">
                          <Building2 className="h-3 w-3 shrink-0" />
                          {s.company_name}
                        </p>
                      )}
                    </div>
                    {s.tier && (
                      <Badge variant="outline" className="text-xs shrink-0 capitalize">
                        {s.tier}
                      </Badge>
                    )}
                  </div>
                  {s.shared_segments.length > 0 && (
                    <p className="text-xs text-primary">
                      {s.shared_segments.length} {t(s.shared_segments.length !== 1 ? "connections.sharedInterests" : "connections.sharedInterest")}
                      {" "}· {s.shared_segments.slice(0, 2).join(", ")}
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    {t("connections.tapToConnect")}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Existing connections */}
      {!isLoading && (
        <div className="space-y-3">
          {connections.length > 0 && (
            <h2 className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
              {t("connections.yourNetwork")}
            </h2>
          )}

          {connections.length === 0 && suggestions.length === 0 && (
            <div className="text-center py-16 text-muted-foreground">
              <Users className="h-12 w-12 mx-auto mb-4 opacity-30" />
              <p>{t("connections.noConnections")}</p>
              <p className="text-sm mt-1">
                {t("connections.tapWithOthers")}
              </p>
            </div>
          )}

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {connections.map((conn) => {
              const other = conn.other_member;
              return (
                <Card key={conn.id} className="rounded-xl">
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">
                          {other?.full_name ?? t("connections.anonymousMember")}
                        </p>
                        {other?.company_name && (
                          <p className="text-xs text-muted-foreground truncate flex items-center gap-1 mt-0.5">
                            <Building2 className="h-3 w-3 shrink-0" />
                            {other.company_name}
                          </p>
                        )}
                      </div>
                      {other?.tier && (
                        <Badge variant="outline" className="text-xs shrink-0 capitalize">
                          {other.tier}
                        </Badge>
                      )}
                    </div>

                    {other?.industry && (
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Briefcase className="h-3 w-3" />
                        {other.industry}
                      </div>
                    )}

                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span className="bg-muted px-2 py-0.5 rounded-full">
                        {CONNECTION_TYPE_KEYS[conn.connection_type] ? t(CONNECTION_TYPE_KEYS[conn.connection_type]) : conn.connection_type}
                      </span>
                      <span>{formatDate(conn.created_at)}</span>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* Network Gaps */}
      {gaps && gaps.missing_or_weak_segments.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-primary" />
              <h2 className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
                {t("connections.networkGaps")}
              </h2>
            </div>
            <Link
              href="/dashboard/networking-report"
              className="text-xs text-primary flex items-center gap-1 hover:underline"
            >
              {t("connections.seeAllSuggestions")} <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          <div className="flex flex-wrap gap-2">
            {gaps.missing_or_weak_segments.map((seg) => (
              <span
                key={seg}
                className="text-xs px-3 py-1 rounded-full border border-primary/40 text-primary bg-primary/5"
              >
                {seg}
              </span>
            ))}
          </div>
          {gaps.priority_suggestions.length > 0 && (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {gaps.priority_suggestions.slice(0, 3).map((s) => (
                <Card key={s.member_id} className="rounded-xl">
                  <CardContent className="p-4 space-y-1">
                    <p className="font-medium text-sm">{s.full_name ?? t("common.member")}</p>
                    {s.company_name && (
                      <p className="text-xs text-muted-foreground">{s.company_name}</p>
                    )}
                    {s.reason_text && (
                      <p className="text-xs text-primary">{s.reason_text}</p>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
