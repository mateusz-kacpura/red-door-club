"use client";

import { useEffect, useState } from "react";
import { CalendarDays, Users, TrendingUp, Loader2 } from "lucide-react";
import { useTranslate } from "@tolgee/react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { apiClient, ApiError } from "@/lib/api-client";
import type { ClubEvent } from "@/types";

const EVENT_TYPE_KEYS: Record<string, string> = {
  mixer: "events.mixer",
  dinner: "events.dinner",
  workshop: "events.workshop",
  private_party: "events.privateParty",
  podcast: "events.podcast",
  corporate: "events.corporate",
};

export default function EventsPage() {
  const { t } = useTranslate();
  const [events, setEvents] = useState<ClubEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [rsvpLoading, setRsvpLoading] = useState<string | null>(null);

  const fetchEvents = async () => {
    try {
      const data = await apiClient.get<ClubEvent[]>("/members/events");
      setEvents(data);
    } catch {
      // silently fail, show empty state
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchEvents();
  }, []);

  const handleRsvp = async (event: ClubEvent) => {
    setRsvpLoading(event.id);
    try {
      if (event.is_rsvped) {
        await apiClient.delete(`/events/${event.id}/rsvp`);
      } else {
        await apiClient.post(`/events/${event.id}/rsvp`);
      }
      await fetchEvents();
    } catch (err) {
      if (err instanceof ApiError) alert(err.message);
    } finally {
      setRsvpLoading(null);
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("en-GB", {
      weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-light tracking-wide">{t("events.title")}</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {t("events.subtitle")}
        </p>
      </div>

      {isLoading && (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      )}

      {!isLoading && events.length === 0 && (
        <div className="text-center py-16 text-muted-foreground">
          <CalendarDays className="h-12 w-12 mx-auto mb-4 opacity-30" />
          <p>{t("events.noUpcoming")}</p>
          <p className="text-sm mt-1">{t("events.checkBack")}</p>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {events.map((event) => (
          <Card key={event.id} className="rounded-xl flex flex-col">
            <CardHeader className="pb-2">
              <div className="flex items-start justify-between gap-2">
                <CardTitle className="text-base font-medium leading-snug">
                  {event.title}
                </CardTitle>
                <Badge variant="outline" className="shrink-0 text-xs">
                  {EVENT_TYPE_KEYS[event.event_type] ? t(EVENT_TYPE_KEYS[event.event_type]) : event.event_type}
                </Badge>
              </div>
              {event.description && (
                <CardDescription className="text-xs line-clamp-2">
                  {event.description}
                </CardDescription>
              )}
            </CardHeader>

            <CardContent className="flex-1 space-y-3">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <CalendarDays className="h-3.5 w-3.5" />
                {formatDate(event.starts_at)}
              </div>

              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <div className="flex items-center gap-1">
                  <Users className="h-3.5 w-3.5" />
                  {t("events.attending", { rsvpCount: event.rsvp_count ?? 0, capacity: event.capacity })}
                </div>
                {event.ticket_price !== "0.00" && (
                  <span>฿{Number(event.ticket_price).toLocaleString()}</span>
                )}
              </div>

              {/* Match score bar */}
              {event.match_score !== null && (
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <TrendingUp className="h-3 w-3" /> {t("events.match")}
                    </span>
                    <span className="text-xs font-medium text-primary">
                      {Math.round((event.match_score ?? 0) * 100)}%
                    </span>
                  </div>
                  <div className="h-1 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-1 bg-primary rounded-full"
                      style={{ width: `${(event.match_score ?? 0) * 100}%` }}
                    />
                  </div>
                </div>
              )}

              {event.target_segments.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {event.target_segments.slice(0, 2).map((seg) => (
                    <span key={seg} className="text-xs bg-muted px-2 py-0.5 rounded-full">
                      {seg}
                    </span>
                  ))}
                </div>
              )}

              <Button
                size="sm"
                variant={event.is_rsvped ? "outline" : "default"}
                className="w-full mt-auto"
                disabled={rsvpLoading === event.id}
                onClick={() => handleRsvp(event)}
              >
                {rsvpLoading === event.id ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : event.is_rsvped ? (
                  t("events.cancelRsvp")
                ) : (
                  t("events.rsvp")
                )}
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
