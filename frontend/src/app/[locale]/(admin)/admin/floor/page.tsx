"use client";

import { useEffect, useState, useCallback } from "react";
import { Loader2, RefreshCw, MapPin, Building2 } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { apiClient } from "@/lib/api-client";
import { useWebSocket } from "@/hooks/useWebSocket";
import type { FloorEntry } from "@/types";
import { useTranslate } from "@tolgee/react";

const TIER_COLORS: Record<string, string> = {
  silver: "text-slate-500",
  gold: "text-yellow-600",
  obsidian: "text-zinc-800",
};

interface TapEventMessage {
  tap_type: string;
  action: string;
  member_name: string | null;
  member_id: string | null;
  location: string | null;
  tapped_at: string;
}

export default function AdminFloorPage() {
  const { t } = useTranslate();
  const [entries, setEntries] = useState<FloorEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [flashedIds, setFlashedIds] = useState<Set<string>>(new Set());

  const fetchFloor = useCallback(async () => {
    try {
      const data = await apiClient.get<FloorEntry[]>("/admin/floor");
      setEntries(data);
      setLastUpdated(new Date());
    } catch {
      // silent
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchFloor();
    const interval = setInterval(fetchFloor, 30000);
    return () => clearInterval(interval);
  }, [fetchFloor]);

  // Real-time WebSocket: receive tap events and show toast + flash card
  useWebSocket("/api/v1/ws/admin/live", (data) => {
    const event = data as TapEventMessage;
    const name = event.member_name ?? t("common.unknown");
    const location = event.location ?? t("floor.defaultVenue");
    const typeLabel = event.tap_type.replace(/_/g, " ");

    toast(`${name} — ${typeLabel}`, {
      description: location,
      duration: 4000,
    });

    // On venue entry: flash the card and refresh the list
    if (event.tap_type === "venue_entry" && event.member_id) {
      setFlashedIds((prev) => new Set(prev).add(event.member_id!));
      setTimeout(() => {
        setFlashedIds((prev) => {
          const next = new Set(prev);
          next.delete(event.member_id!);
          return next;
        });
      }, 2000);
      fetchFloor();
    }
  });

  const formatTime = (dateStr: string | null) => {
    if (!dateStr) return "—";
    return new Date(dateStr).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-light tracking-wide">{t("floor.title")}</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {t("floor.subtitle")}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {lastUpdated && (
            <span className="text-xs text-muted-foreground">
              {t("floor.updated", { time: lastUpdated.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }) })}
            </span>
          )}
          <Button variant="outline" size="sm" onClick={fetchFloor} disabled={isLoading}>
            <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
          <span className="text-sm font-medium">{entries.length} {t("floor.inVenue")}</span>
        </div>
        <span className="text-muted-foreground">·</span>
        <div className="flex items-center gap-1.5">
          <div className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
          <span className="text-xs text-primary font-medium tracking-wider">{t("floor.live")}</span>
        </div>
      </div>

      {isLoading && entries.length === 0 && (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      )}

      {!isLoading && entries.length === 0 && (
        <div className="text-center py-16 text-muted-foreground">
          <MapPin className="h-12 w-12 mx-auto mb-4 opacity-30" />
          <p>{t("floor.noMembers")}</p>
          <p className="text-sm mt-1">{t("floor.nfcHint")}</p>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {entries.map((entry) => (
          <Card
            key={entry.member_id}
            className={`rounded-xl transition-all duration-500 ${
              flashedIds.has(entry.member_id)
                ? "ring-2 ring-primary ring-offset-1 shadow-lg"
                : ""
            }`}
          >
            <CardContent className="p-4 space-y-2">
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">
                    {entry.full_name ?? t("common.unknown")}
                  </p>
                  {entry.company_name && (
                    <p className="text-xs text-muted-foreground truncate flex items-center gap-1 mt-0.5">
                      <Building2 className="h-3 w-3 shrink-0" />
                      {entry.company_name}
                    </p>
                  )}
                </div>
                {entry.tier && (
                  <span className={`text-xs font-medium capitalize shrink-0 ml-2 ${TIER_COLORS[entry.tier] ?? ""}`}>
                    {entry.tier}
                  </span>
                )}
              </div>

              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <MapPin className="h-3 w-3" />
                  {entry.location ?? t("floor.entrance")}
                </span>
                <span>{t("floor.entryPrefix")} {formatTime(entry.entry_time)}</span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
