"use client";

import { useEffect, useState } from "react";
import { Loader2, Plus, Car, Plane, Hotel, Coffee, Mic, MoreHorizontal } from "lucide-react";
import { useTranslate } from "@tolgee/react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { apiClient, ApiError } from "@/lib/api-client";
import type { ServiceRequest } from "@/types";

const SERVICE_ICONS: Record<string, React.ReactNode> = {
  car: <Car className="h-4 w-4" />,
  driver: <Car className="h-4 w-4" />,
  jet: <Plane className="h-4 w-4" />,
  hotel: <Hotel className="h-4 w-4" />,
  bar: <Coffee className="h-4 w-4" />,
  studio: <Mic className="h-4 w-4" />,
  other: <MoreHorizontal className="h-4 w-4" />,
};

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-yellow-500/10 text-yellow-600 border-yellow-200",
  acknowledged: "bg-blue-500/10 text-blue-600 border-blue-200",
  in_progress: "bg-primary/10 text-primary border-primary/20",
  completed: "bg-green-500/10 text-green-600 border-green-200",
  cancelled: "bg-muted text-muted-foreground",
};

const REQUEST_TYPES = [
  "car", "driver", "jet", "hotel", "restaurant", "bar", "studio", "other",
] as const;

export default function ServicesPage() {
  const { t } = useTranslate();
  const [requests, setRequests] = useState<ServiceRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formType, setFormType] = useState<string>("other");
  const [formDetails, setFormDetails] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const fetchRequests = async () => {
    try {
      const data = await apiClient.get<ServiceRequest[]>("/members/services");
      setRequests(data);
    } catch {
      // silent
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { fetchRequests(); }, []);

  const handleSubmit = async () => {
    setSubmitting(true);
    setError("");
    try {
      await apiClient.post("/members/services", {
        request_type: formType,
        details: formDetails ? { notes: formDetails } : null,
      });
      setShowForm(false);
      setFormDetails("");
      await fetchRequests();
    } catch (err) {
      if (err instanceof ApiError) setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-light tracking-wide">{t("services.title")}</h1>
          <p className="text-sm text-muted-foreground mt-1">{t("services.subtitle")}</p>
        </div>
        <Button onClick={() => setShowForm(!showForm)} size="sm">
          <Plus className="h-4 w-4 mr-1" /> {t("services.newRequest")}
        </Button>
      </div>

      {/* New request form */}
      {showForm && (
        <Card className="rounded-xl border-primary/20">
          <CardHeader>
            <CardTitle className="text-base">{t("services.newServiceRequest")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {REQUEST_TYPES.map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setFormType(type)}
                  className={`flex flex-col items-center gap-1 px-2 py-3 rounded-lg border text-xs font-medium transition-colors capitalize
                    ${formType === type ? "border-primary bg-primary/10 text-primary" : "border-border hover:border-primary/40"}`}
                >
                  {SERVICE_ICONS[type] ?? <MoreHorizontal className="h-4 w-4" />}
                  {type}
                </button>
              ))}
            </div>
            <textarea
              className="w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm resize-none h-20"
              placeholder={t("services.additionalDetails")}
              value={formDetails}
              onChange={(e) => setFormDetails(e.target.value)}
            />
            {error && <p className="text-sm text-destructive">{error}</p>}
            <div className="flex gap-2 justify-end">
              <Button variant="outline" size="sm" onClick={() => setShowForm(false)}>{t("common.cancel")}</Button>
              <Button size="sm" onClick={handleSubmit} disabled={submitting}>
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : t("services.submitRequest")}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      )}

      {!isLoading && requests.length === 0 && !showForm && (
        <div className="text-center py-16 text-muted-foreground">
          <Coffee className="h-12 w-12 mx-auto mb-4 opacity-30" />
          <p>{t("services.noRequests")}</p>
          <p className="text-sm mt-1">{t("services.noRequestsHint")}</p>
        </div>
      )}

      <div className="space-y-3">
        {requests.map((req) => (
          <Card key={req.id} className="rounded-xl">
            <CardContent className="p-4 flex items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 text-muted-foreground">
                  {SERVICE_ICONS[req.request_type] ?? <MoreHorizontal className="h-4 w-4" />}
                </div>
                <div>
                  <p className="font-medium capitalize text-sm">{req.request_type.replace("_", " ")}</p>
                  {req.details && typeof req.details === "object" && "notes" in req.details && (
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                      {String(req.details.notes)}
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground mt-1">{formatDate(req.created_at)}</p>
                </div>
              </div>
              <span className={`shrink-0 text-xs px-2 py-1 rounded-full border font-medium capitalize ${STATUS_COLORS[req.status] ?? ""}`}>
                {t(`services.status${req.status}`)}
              </span>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
