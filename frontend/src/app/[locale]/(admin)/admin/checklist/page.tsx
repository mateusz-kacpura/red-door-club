"use client";

import { useEffect, useState } from "react";
import { Loader2, CheckCircle2, Circle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { apiClient } from "@/lib/api-client";
import type { ServiceRequest } from "@/types";
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

const CATEGORY_LABELS: Record<string, string> = {
  bar: "Bar Setup",
  restaurant: "Catering",
  car: "Parking / Car",
  driver: "Driver",
  studio: "Studio Prep",
  hotel: "Hotel",
  jet: "Private Jet",
  other: "Operations",
};

export default function AdminChecklistPage() {
  const { t } = useTranslate();
  const [items, setItems] = useState<ServiceRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [completing, setCompleting] = useState<string | null>(null);

  const fetchChecklist = async () => {
    try {
      const data = await apiClient.get<ServiceRequest[]>("/admin/checklist");
      setItems(data);
    } catch {
      // silent
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { fetchChecklist(); }, []);

  const handleComplete = async (id: string) => {
    setCompleting(id);
    try {
      await apiClient.patch(`/admin/checklist/${id}`);
      setItems((prev) => prev.map((item) =>
        item.id === id ? { ...item, status: "completed" } : item
      ));
    } catch {
      // silent
    } finally {
      setCompleting(null);
    }
  };

  // Group by request_type
  const grouped = items.reduce<Record<string, ServiceRequest[]>>((acc, item) => {
    const key = item.request_type;
    if (!acc[key]) acc[key] = [];
    acc[key].push(item);
    return acc;
  }, {});

  const pendingCount = items.filter((i) => i.status !== "completed").length;
  const completedCount = items.filter((i) => i.status === "completed").length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-light tracking-wide">{t("checklist.title")}</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {t("checklist.subtitle")} · {pendingCount} {t("checklist.pending")} · {completedCount} {t("checklist.done")}
        </p>
      </div>

      {isLoading && (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      )}

      {!isLoading && items.length === 0 && (
        <div className="text-center py-16 text-muted-foreground">
          <CheckCircle2 className="h-12 w-12 mx-auto mb-4 opacity-30" />
          <p>{t("checklist.noTasks")}</p>
          <p className="text-sm mt-1">{t("checklist.tasksHint")}</p>
        </div>
      )}

      <div className="space-y-4">
        {Object.entries(grouped).map(([type, requests]) => (
          <Card key={type} className="rounded-xl">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <span>{CATEGORY_ICONS[type] ?? "📋"}</span>
                {CATEGORY_LABELS[type] ?? type}
                <span className="text-xs text-muted-foreground font-normal">
                  ({requests.filter((r) => r.status !== "completed").length} pending)
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {requests.map((req) => {
                const isDone = req.status === "completed";
                return (
                  <div
                    key={req.id}
                    className={`flex items-start gap-3 p-3 rounded-lg transition-colors
                      ${isDone ? "opacity-50 bg-muted/30" : "bg-muted/10 hover:bg-muted/20"}`}
                  >
                    <button
                      onClick={() => !isDone && handleComplete(req.id)}
                      disabled={isDone || completing === req.id}
                      className="mt-0.5 shrink-0"
                    >
                      {completing === req.id ? (
                        <Loader2 className="h-5 w-5 animate-spin text-primary" />
                      ) : isDone ? (
                        <CheckCircle2 className="h-5 w-5 text-green-500" />
                      ) : (
                        <Circle className="h-5 w-5 text-muted-foreground hover:text-primary transition-colors" />
                      )}
                    </button>

                    <div className="flex-1 min-w-0">
                      <p className={`text-sm ${isDone ? "line-through" : ""}`}>
                        {req.details && typeof req.details === "object" && "notes" in req.details
                          ? String(req.details.notes)
                          : `${CATEGORY_LABELS[req.request_type] ?? req.request_type} request`}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {new Date(req.created_at).toLocaleTimeString("en-GB", {
                          hour: "2-digit", minute: "2-digit",
                        })}
                      </p>
                    </div>

                    <span className={`text-xs px-2 py-0.5 rounded-full shrink-0 capitalize
                      ${req.status === "completed" ? "bg-green-100 text-green-700" :
                        req.status === "in_progress" ? "bg-primary/10 text-primary" :
                        "bg-yellow-100 text-yellow-700"}`}>
                      {req.status.replace("_", " ")}
                    </span>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
