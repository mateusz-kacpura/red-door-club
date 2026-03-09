"use client";

import { useEffect, useState } from "react";
import { Loader2, Headphones, CheckCircle2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { apiClient } from "@/lib/api-client";
import type { ServiceRequestAdminRead } from "@/types";
import { useTranslate } from "@tolgee/react";

const CATEGORY_ICONS: Record<string, string> = {
  bar: "🍸",
  restaurant: "🍽️",
  car: "🚗",
  driver: "🚗",
  studio: "🎙️",
  hotel: "🏨",
  jet: "✈️",
  other: "📋",
};

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800",
  acknowledged: "bg-blue-100 text-blue-800",
  in_progress: "bg-primary/10 text-primary",
  completed: "bg-green-100 text-green-700",
  cancelled: "bg-muted text-muted-foreground",
};

const STATUS_NEXT: Record<string, { labelKey: string; status: string }> = {
  pending: { labelKey: "adminServices.acknowledge", status: "acknowledged" },
  acknowledged: { labelKey: "adminServices.start", status: "in_progress" },
  in_progress: { labelKey: "adminServices.complete", status: "completed" },
};

type FilterTab = "all" | "pending" | "in_progress" | "completed";

export default function AdminServicesPage() {
  const { t } = useTranslate();
  const [requests, setRequests] = useState<ServiceRequestAdminRead[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<FilterTab>("all");
  const [updating, setUpdating] = useState<string | null>(null);

  const fetchRequests = async () => {
    try {
      const data = await apiClient.get<ServiceRequestAdminRead[]>("/admin/services");
      setRequests(data);
    } catch {
      // silent
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { fetchRequests(); }, []);

  const handleStatusUpdate = async (id: string, newStatus: string) => {
    setUpdating(id);
    try {
      await apiClient.patch(`/admin/services/${id}`, { status: newStatus });
      setRequests((prev) =>
        prev.map((r) => (r.id === id ? { ...r, status: newStatus as ServiceRequestAdminRead["status"] } : r))
      );
    } catch {
      // silent
    } finally {
      setUpdating(null);
    }
  };

  const filtered = filter === "all"
    ? requests
    : requests.filter((r) => r.status === filter);

  const pendingCount = requests.filter((r) => r.status === "pending").length;
  const inProgressCount = requests.filter((r) => r.status === "in_progress").length;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[300px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const FILTERS: { key: FilterTab; label: string }[] = [
    { key: "all", label: t("adminServices.filterAll") },
    { key: "pending", label: t("adminServices.filterPending") },
    { key: "in_progress", label: t("adminServices.filterInProgress") },
    { key: "completed", label: t("adminServices.filterCompleted") },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-light tracking-wide">{t("adminServices.title")}</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {t("adminServices.subtitle")}
        </p>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 flex-wrap">
        {FILTERS.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors
              ${filter === key
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-muted/80"
              }`}
          >
            {label}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center gap-4">
          <CheckCircle2 className="h-12 w-12 text-primary/30" />
          <p className="text-muted-foreground">{t("adminServices.noRequests")}</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((req) => {
            const next = STATUS_NEXT[req.status];
            const notes = req.details && typeof req.details === "object" && "notes" in req.details
              ? String(req.details.notes)
              : null;
            const staffNotes = req.details && typeof req.details === "object" && "staff_notes" in req.details
              ? String(req.details.staff_notes)
              : null;

            return (
              <Card key={req.id}>
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <CardTitle className="text-base flex items-center gap-2">
                        <span>{CATEGORY_ICONS[req.request_type] ?? "📋"}</span>
                        {req.member_name ?? "Unknown Member"}
                      </CardTitle>
                      <CardDescription className="text-xs mt-0.5">
                        {new Date(req.created_at).toLocaleString("en-GB", {
                          day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
                        })}
                      </CardDescription>
                    </div>
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full capitalize shrink-0 ${STATUS_COLORS[req.status] ?? ""}`}
                    >
                      {req.status.replace("_", " ")}
                    </span>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs capitalize">
                      {req.request_type}
                    </Badge>
                    {req.assigned_to_name && (
                      <span className="text-xs text-muted-foreground">→ {req.assigned_to_name}</span>
                    )}
                  </div>
                  {notes && (
                    <p className="text-sm text-muted-foreground line-clamp-2">{notes}</p>
                  )}
                  {staffNotes && (
                    <p className="text-xs italic text-muted-foreground border-l-2 border-primary/30 pl-2">
                      {staffNotes}
                    </p>
                  )}
                  {next && req.status !== "completed" && req.status !== "cancelled" && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="w-full"
                      disabled={updating === req.id}
                      onClick={() => handleStatusUpdate(req.id, next.status)}
                    >
                      {updating === req.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        t(next.labelKey)
                      )}
                    </Button>
                  )}
                  {req.status === "completed" && req.completed_at && (
                    <p className="text-xs text-green-600">
                      Completed {new Date(req.completed_at).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
                    </p>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
