"use client";

import { useEffect, useState, useCallback } from "react";
import { Loader2, Zap, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { apiClient } from "@/lib/api-client";
import { useWebSocket } from "@/hooks/useWebSocket";
import type { TapEventAdminRead } from "@/types";
import { useTranslate } from "@tolgee/react";

const TAP_TYPE_COLORS: Record<string, string> = {
  venue_entry: "bg-green-100 text-green-700",
  payment_tap: "bg-primary/10 text-primary",
  connection_tap: "bg-blue-100 text-blue-700",
  locker_access: "bg-purple-100 text-purple-700",
  profile_created: "bg-orange-100 text-orange-700",
};

const ALL_TYPES = ["venue_entry", "payment_tap", "connection_tap", "locker_access"];

const TAP_TYPE_KEYS: Record<string, string> = {
  venue_entry: "activity.tapVenueEntry",
  payment_tap: "activity.tapPaymentTap",
  connection_tap: "activity.tapConnectionTap",
  locker_access: "activity.tapLockerAccess",
  profile_created: "activity.tapProfileCreated",
};
const PAGE_SIZE = 25;

interface LiveTapMessage {
  tap_type: string;
  action: string;
  member_name: string | null;
  member_id: string | null;
  location: string | null;
  tapped_at: string;
}

export default function AdminActivityPage() {
  const { t } = useTranslate();
  const [events, setEvents] = useState<TapEventAdminRead[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<string | null>(null);
  const [skip, setSkip] = useState(0);
  const [liveCount, setLiveCount] = useState(0);

  const fetchEvents = useCallback(async (tapType: string | null, offset: number) => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({ skip: String(offset), limit: String(PAGE_SIZE) });
      if (tapType) params.set("tap_type", tapType);
      const data = await apiClient.get<TapEventAdminRead[]>(`/admin/activity?${params}`);
      setEvents(data);
    } catch {
      // silent
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchEvents(filter, skip);
  }, [filter, skip, fetchEvents]);

  // Live feed: prepend new events from WebSocket (only when on page 1, no filter active)
  useWebSocket("/api/v1/ws/admin/live", (data) => {
    const msg = data as LiveTapMessage;
    setLiveCount((n) => n + 1);

    // Only update the visible list if we're on the first page with no filter
    if (skip === 0 && (filter === null || filter === msg.tap_type)) {
      const liveEvent: TapEventAdminRead = {
        id: `live-${Date.now()}`,
        member_id: msg.member_id ?? null,
        member_name: msg.member_name,
        card_id: "—",
        tap_type: msg.tap_type,
        reader_id: null,
        location: msg.location,
        tapped_at: msg.tapped_at,
        metadata: null,
      };
      setEvents((prev) => [liveEvent, ...prev.slice(0, PAGE_SIZE - 1)]);
    }
  });

  const handleFilter = (tapType: string | null) => {
    setFilter(tapType);
    setSkip(0);
    setLiveCount(0);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-light tracking-wide">{t("activity.title")}</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {t("activity.subtitle")}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />
          <span className="text-xs text-green-600 font-medium tracking-wider">{t("activity.live")}</span>
          {liveCount > 0 && (
            <span className="text-xs text-muted-foreground">
              (+{liveCount} new)
            </span>
          )}
        </div>
      </div>

      {/* Filter buttons */}
      <div className="flex gap-2 flex-wrap">
        <button
          onClick={() => handleFilter(null)}
          className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors
            ${filter === null
              ? "bg-primary text-primary-foreground"
              : "bg-muted text-muted-foreground hover:bg-muted/80"
            }`}
        >
          {t("activity.filterAll")}
        </button>
        {ALL_TYPES.map((type) => (
          <button
            key={type}
            onClick={() => handleFilter(type)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors capitalize
              ${filter === type
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-muted/80"
              }`}
          >
            {TAP_TYPE_KEYS[type] ? t(TAP_TYPE_KEYS[type]) : type.replace(/_/g, " ")}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : events.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center gap-4">
          <Zap className="h-12 w-12 text-primary/30" />
          <p className="text-muted-foreground">{t("activity.noActivity")}</p>
        </div>
      ) : (
        <Card className="rounded-xl overflow-hidden">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">{t("activity.colMember")}</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">{t("activity.colType")}</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground hidden md:table-cell">{t("activity.colCardId")}</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground hidden lg:table-cell">{t("activity.colLocation")}</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">{t("activity.colTimestamp")}</th>
                  </tr>
                </thead>
                <tbody>
                  {events.map((event) => (
                    <tr
                      key={event.id}
                      className={`border-b last:border-0 hover:bg-muted/20 transition-colors ${
                        String(event.id).startsWith("live-") ? "bg-primary/5" : ""
                      }`}
                    >
                      <td className="px-4 py-3">
                        <span className="font-medium">{event.member_name ?? <span className="text-muted-foreground">—</span>}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-xs px-2 py-0.5 rounded-full capitalize ${TAP_TYPE_COLORS[event.tap_type] ?? "bg-muted text-muted-foreground"}`}>
                          {TAP_TYPE_KEYS[event.tap_type] ? t(TAP_TYPE_KEYS[event.tap_type]) : event.tap_type.replace(/_/g, " ")}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground font-mono text-xs hidden md:table-cell">
                        {event.card_id}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground hidden lg:table-cell">
                        {event.location ?? "—"}
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        {new Date(event.tapped_at).toLocaleString("en-GB", {
                          day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
                        })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Pagination */}
      <div className="flex items-center justify-between">
        <Button
          variant="outline"
          size="sm"
          disabled={skip === 0 || isLoading}
          onClick={() => setSkip((s) => Math.max(0, s - PAGE_SIZE))}
        >
          <ChevronLeft className="h-4 w-4 mr-1" />
          {t("activity.prevPage")}
        </Button>
        <span className="text-sm text-muted-foreground">
          {t("activity.showing", { from: skip + 1, to: skip + events.length })}
        </span>
        <Button
          variant="outline"
          size="sm"
          disabled={events.length < PAGE_SIZE || isLoading}
          onClick={() => setSkip((s) => s + PAGE_SIZE)}
        >
          {t("activity.nextPage")}
          <ChevronRight className="h-4 w-4 ml-1" />
        </Button>
      </div>
    </div>
  );
}
