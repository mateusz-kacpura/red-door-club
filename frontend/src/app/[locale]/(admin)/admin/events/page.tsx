"use client";

import { useEffect, useState } from "react";
import { Loader2, Plus, CalendarDays } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiClient, ApiError } from "@/lib/api-client";
import type { ClubEvent } from "@/types";
import { useTranslate } from "@tolgee/react";

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  published: "bg-green-100 text-green-700",
  sold_out: "bg-orange-100 text-orange-700",
  completed: "bg-blue-100 text-blue-700",
  cancelled: "bg-red-100 text-red-700",
};

const STATUS_TRANSITIONS: Record<string, { label: string; next: string; variant: "default" | "outline" | "destructive" }[]> = {
  draft: [{ label: "Publish", next: "published", variant: "default" }],
  published: [
    { label: "Complete", next: "completed", variant: "outline" },
    { label: "Cancel", next: "cancelled", variant: "destructive" },
  ],
  completed: [{ label: "Reopen", next: "published", variant: "outline" }],
  cancelled: [{ label: "Reopen", next: "draft", variant: "outline" }],
  sold_out: [{ label: "Complete", next: "completed", variant: "outline" }],
};

const EVENT_TYPES = ["mixer", "dinner", "workshop", "private_party", "podcast", "corporate"];
const SEGMENT_OPTIONS = [
  "Finance & Investors", "Tech & Founders", "Real Estate",
  "Corporate Executives", "Lifestyle & Leisure", "Legal & Advisory", "International Network",
];

export default function AdminEventsPage() {
  const { t } = useTranslate();
  const [events, setEvents] = useState<ClubEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [statusLoading, setStatusLoading] = useState<string | null>(null);
  const [error, setError] = useState("");

  const [form, setForm] = useState({
    title: "",
    description: "",
    event_type: "mixer",
    target_segments: [] as string[],
    capacity: 50,
    ticket_price: "0.00",
    starts_at: "",
    status: "draft",
    min_tier: "",
  });

  const fetchEvents = async () => {
    try {
      const data = await apiClient.get<ClubEvent[]>("/admin/events");
      setEvents(data);
    } catch {
      // silent
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { fetchEvents(); }, []);

  const toggleSegment = (seg: string) => {
    setForm((prev) => ({
      ...prev,
      target_segments: prev.target_segments.includes(seg)
        ? prev.target_segments.filter((s) => s !== seg)
        : [...prev.target_segments, seg],
    }));
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    setError("");
    try {
      await apiClient.post("/admin/events", {
        ...form,
        ticket_price: parseFloat(form.ticket_price) || 0,
        min_tier: form.min_tier || null,
        starts_at: new Date(form.starts_at).toISOString(),
      });
      setShowForm(false);
      await fetchEvents();
    } catch (err) {
      if (err instanceof ApiError) setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleStatusChange = async (eventId: string, newStatus: string) => {
    setStatusLoading(eventId + newStatus);
    try {
      await apiClient.patch(`/admin/events/${eventId}`, { status: newStatus });
      await fetchEvents();
    } catch (err) {
      if (err instanceof ApiError) alert(err.message);
    } finally {
      setStatusLoading(null);
    }
  };

  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString("en-GB", {
      weekday: "short", day: "numeric", month: "short", year: "numeric",
    });

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-light tracking-wide">{t("events.title")}</h1>
          <p className="text-sm text-muted-foreground mt-1">{t("adminEvents.totalEvents", { count: events.length })}</p>
        </div>
        <Button onClick={() => setShowForm(!showForm)} size="sm">
          <Plus className="h-4 w-4 mr-1" /> {t("adminEvents.createEvent")}
        </Button>
      </div>

      {/* Create form */}
      {showForm && (
        <Card className="rounded-xl border-primary/20">
          <CardContent className="p-6 space-y-4">
            <h2 className="font-medium">{t("adminEvents.newEvent")}</h2>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2 space-y-1">
                <Label>{t("adminEvents.titleLabel")}</Label>
                <Input value={form.title} onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))} placeholder={t("adminEvents.titlePlaceholder")} />
              </div>
              <div className="space-y-1">
                <Label>{t("adminEvents.typeLabel")}</Label>
                <select className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                  value={form.event_type} onChange={(e) => setForm((p) => ({ ...p, event_type: e.target.value }))}>
                  {EVENT_TYPES.map((t) => <option key={t} value={t} className="capitalize">{t.replace("_", " ")}</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <Label>{t("adminEvents.statusLabel")}</Label>
                <select className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                  value={form.status} onChange={(e) => setForm((p) => ({ ...p, status: e.target.value }))}>
                  {["draft", "published"].map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <Label>{t("adminEvents.dateLabel")}</Label>
                <Input type="datetime-local" value={form.starts_at} onChange={(e) => setForm((p) => ({ ...p, starts_at: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label>{t("adminEvents.capacityLabel")}</Label>
                <Input type="number" min={1} value={form.capacity} onChange={(e) => setForm((p) => ({ ...p, capacity: parseInt(e.target.value) || 50 }))} />
              </div>
              <div className="space-y-1">
                <Label>{t("adminEvents.priceLabel")}</Label>
                <Input type="number" min={0} value={form.ticket_price} onChange={(e) => setForm((p) => ({ ...p, ticket_price: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label>{t("adminEvents.minTierLabel")}</Label>
                <select className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                  value={form.min_tier} onChange={(e) => setForm((p) => ({ ...p, min_tier: e.target.value }))}>
                  <option value="">{t("adminEvents.noRestriction")}</option>
                  {["silver", "gold", "obsidian"].map((t) => <option key={t} value={t} className="capitalize">{t}</option>)}
                </select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>{t("adminEvents.targetSegments")}</Label>
              <div className="flex flex-wrap gap-2">
                {SEGMENT_OPTIONS.map((seg) => (
                  <button key={seg} type="button" onClick={() => toggleSegment(seg)}
                    className={`text-xs px-3 py-1.5 rounded-full border transition-colors
                      ${form.target_segments.includes(seg) ? "border-primary bg-primary/10 text-primary" : "border-border hover:border-primary/40"}`}>
                    {seg}
                  </button>
                ))}
              </div>
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}

            <div className="flex gap-2 justify-end">
              <Button variant="outline" size="sm" onClick={() => setShowForm(false)}>{t("common.cancel")}</Button>
              <Button size="sm" onClick={handleSubmit} disabled={submitting || !form.title || !form.starts_at}>
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : t("adminEvents.createEvent")}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {isLoading && (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      )}

      {!isLoading && events.length === 0 && !showForm && (
        <div className="text-center py-16 text-muted-foreground">
          <CalendarDays className="h-12 w-12 mx-auto mb-4 opacity-30" />
          <p>{t("adminEvents.noEvents")}</p>
        </div>
      )}

      <div className="space-y-3">
        {events.map((event) => (
          <Card key={event.id} className="rounded-xl">
            <CardContent className="p-4 flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-medium">{event.title}</p>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${STATUS_COLORS[event.status] ?? ""}`}>
                    {event.status}
                  </span>
                </div>
                <div className="flex items-center gap-4 mt-1 text-xs text-muted-foreground flex-wrap">
                  <span className="flex items-center gap-1">
                    <CalendarDays className="h-3 w-3" />
                    {formatDate(event.starts_at)}
                  </span>
                  <span>{event.rsvp_count ?? 0}/{event.capacity} attending</span>
                  {event.ticket_price !== "0.00" && <span>฿{Number(event.ticket_price).toLocaleString()}</span>}
                </div>
                {event.target_segments.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {event.target_segments.map((seg) => (
                      <span key={seg} className="text-xs bg-muted px-2 py-0.5 rounded-full">{seg}</span>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {(STATUS_TRANSITIONS[event.status] ?? []).map(({ label, next, variant }) => (
                  <Button
                    key={next}
                    size="sm"
                    variant={variant}
                    disabled={statusLoading === event.id + next}
                    onClick={() => handleStatusChange(event.id, next)}
                    className="h-7 text-xs px-3"
                  >
                    {statusLoading === event.id + next
                      ? <Loader2 className="h-3 w-3 animate-spin" />
                      : label}
                  </Button>
                ))}
                <Badge variant="outline" className="capitalize text-xs">
                  {event.event_type.replace("_", " ")}
                </Badge>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
