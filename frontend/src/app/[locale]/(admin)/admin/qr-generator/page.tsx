"use client";

import { useEffect, useState } from "react";
import { QrCode, Loader2, Download, Eye, Plus } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiClient, ApiError } from "@/lib/api-client";
import { useTranslate } from "@tolgee/react";
import QRCode from "react-qr-code";

interface QrBatchRead {
  id: string;
  promoter_id: string | null;
  promo_code: string | null;
  tier: string;
  count: number;
  prefix: string;
  notes: string | null;
  created_at: string;
  conversion_rate: number;
  converted_count: number;
}

interface QrCodeRead {
  id: string;
  pass_id: string;
  converted_at: string | null;
}

interface QrBatchDetail extends QrBatchRead {
  codes: QrCodeRead[];
}

interface PromoterOption {
  promoter_id: string;
  full_name: string | null;
  email: string;
}

const TIERS = ["silver", "gold", "obsidian"];

export default function AdminQrGeneratorPage() {
  const { t } = useTranslate();
  const [batches, setBatches] = useState<QrBatchRead[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [promoters, setPromoters] = useState<PromoterOption[]>([]);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [previewBatch, setPreviewBatch] = useState<QrBatchDetail | null>(null);
  const [previewLoading, setPreviewLoading] = useState<string | null>(null);

  const [form, setForm] = useState({
    promoter_id: "",
    promo_code: "",
    tier: "silver",
    count: 10,
    prefix: "RD-",
    notes: "",
  });

  const fetchBatches = async () => {
    try {
      const data = await apiClient.get<QrBatchRead[]>("/admin/qr-batches");
      setBatches(data);
    } catch {
      // silent
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchBatches();
    apiClient.get<PromoterOption[]>("/admin/promoters")
      .then(setPromoters)
      .catch(() => {});
  }, []);

  const handleSubmit = async () => {
    setSubmitting(true);
    setError("");
    try {
      await apiClient.post("/admin/qr-batches", {
        promoter_id: form.promoter_id || null,
        promo_code: form.promo_code || null,
        tier: form.tier,
        count: form.count,
        prefix: form.prefix,
        notes: form.notes || null,
      });
      setShowForm(false);
      setForm({ promoter_id: "", promo_code: "", tier: "silver", count: 10, prefix: "RD-", notes: "" });
      await fetchBatches();
    } catch (err) {
      if (err instanceof ApiError) setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDownloadPdf = async (batchId: string) => {
    setDownloadingId(batchId);
    try {
      const response = await fetch(`/api/admin/qr-batches/${batchId}/pdf`);
      if (!response.ok) throw new Error("PDF download failed");
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `qr-batch-${batchId}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      // silent
    } finally {
      setDownloadingId(null);
    }
  };

  const handlePreview = async (batchId: string) => {
    if (previewBatch?.id === batchId) {
      setPreviewBatch(null);
      return;
    }
    setPreviewLoading(batchId);
    try {
      const data = await apiClient.get<QrBatchDetail>(`/admin/qr-batches/${batchId}`);
      setPreviewBatch(data);
    } catch {
      // silent
    } finally {
      setPreviewLoading(null);
    }
  };

  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString("en-GB", {
      day: "numeric", month: "short", year: "numeric",
    });

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-light tracking-wide">{t("qrGenerator.title")}</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {t("qrGenerator.totalBatches", { count: batches.length })}
          </p>
        </div>
        <Button onClick={() => setShowForm(!showForm)} size="sm">
          <Plus className="h-4 w-4 mr-1" /> {t("qrGenerator.batchForm")}
        </Button>
      </div>

      {/* Create form */}
      {showForm && (
        <Card className="rounded-xl border-primary/20">
          <CardContent className="p-6 space-y-4">
            <h2 className="font-medium">{t("qrGenerator.batchForm")}</h2>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1">
                <Label>{t("qrGenerator.promoterLabel")}</Label>
                <select
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                  value={form.promoter_id}
                  onChange={(e) => setForm((p) => ({ ...p, promoter_id: e.target.value }))}
                >
                  <option value="">{t("qrGenerator.noPromoter")}</option>
                  {promoters.map((pr) => (
                    <option key={pr.promoter_id} value={pr.promoter_id}>
                      {pr.full_name ?? pr.email}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <Label>{t("qrGenerator.promoCodeLabel")}</Label>
                <Input
                  placeholder="PRO-07"
                  value={form.promo_code}
                  onChange={(e) => setForm((p) => ({ ...p, promo_code: e.target.value }))}
                />
              </div>

              <div className="space-y-1">
                <Label>{t("qrGenerator.tierLabel")}</Label>
                <select
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                  value={form.tier}
                  onChange={(e) => setForm((p) => ({ ...p, tier: e.target.value }))}
                >
                  {TIERS.map((tier) => (
                    <option key={tier} value={tier} className="capitalize">{tier}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <Label>{t("qrGenerator.countLabel")}</Label>
                <Input
                  type="number"
                  min={1}
                  max={500}
                  value={form.count}
                  onChange={(e) => setForm((p) => ({ ...p, count: parseInt(e.target.value) || 10 }))}
                />
              </div>

              <div className="space-y-1">
                <Label>{t("qrGenerator.prefixLabel")}</Label>
                <Input
                  value={form.prefix}
                  maxLength={10}
                  onChange={(e) => setForm((p) => ({ ...p, prefix: e.target.value }))}
                />
              </div>

              <div className="space-y-1">
                <Label>{t("qrGenerator.notesLabel")}</Label>
                <Input
                  value={form.notes}
                  onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
                />
              </div>
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}

            <div className="flex gap-2 justify-end">
              <Button variant="outline" size="sm" onClick={() => setShowForm(false)}>
                {t("common.cancel")}
              </Button>
              <Button size="sm" onClick={handleSubmit} disabled={submitting || !form.prefix}>
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : t("qrGenerator.generate")}
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

      {!isLoading && batches.length === 0 && !showForm && (
        <div className="text-center py-16 text-muted-foreground">
          <QrCode className="h-12 w-12 mx-auto mb-4 opacity-30" />
          <p>{t("qrGenerator.noBatches")}</p>
        </div>
      )}

      <div className="space-y-3">
        {batches.map((batch) => (
          <div key={batch.id}>
            <Card className="rounded-xl">
              <CardContent className="p-4 flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-medium">{batch.prefix}... × {batch.count}</p>
                    <Badge variant="outline" className="capitalize text-xs">{batch.tier}</Badge>
                    {batch.promo_code && (
                      <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                        {batch.promo_code}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-4 mt-1 text-xs text-muted-foreground flex-wrap">
                    <span>{formatDate(batch.created_at)}</span>
                    <span>
                      {batch.converted_count}/{batch.count} {t("qrGenerator.conversions")}
                    </span>
                    <span>
                      {t("qrGenerator.conversionRate")}: {(batch.conversion_rate * 100).toFixed(0)}%
                    </span>
                  </div>
                  {batch.notes && (
                    <p className="text-xs text-muted-foreground mt-1">{batch.notes}</p>
                  )}
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs px-3"
                    disabled={previewLoading === batch.id}
                    onClick={() => handlePreview(batch.id)}
                  >
                    {previewLoading === batch.id
                      ? <Loader2 className="h-3 w-3 animate-spin" />
                      : <><Eye className="h-3 w-3 mr-1" />{t("qrGenerator.preview")}</>
                    }
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs px-3"
                    disabled={downloadingId === batch.id}
                    onClick={() => handleDownloadPdf(batch.id)}
                  >
                    {downloadingId === batch.id
                      ? <Loader2 className="h-3 w-3 animate-spin" />
                      : <><Download className="h-3 w-3 mr-1" />{t("qrGenerator.downloadPdf")}</>
                    }
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Inline preview panel */}
            {previewBatch?.id === batch.id && (
              <Card className="rounded-xl rounded-t-none border-t-0 bg-muted/30">
                <CardContent className="p-4">
                  <p className="text-xs font-medium text-muted-foreground mb-3 uppercase tracking-wider">
                    {t("qrGenerator.previewTitle")} — {batch.prefix}*
                  </p>
                  <div className="grid grid-cols-3 sm:grid-cols-6 gap-4">
                    {previewBatch.codes.slice(0, 6).map((code) => (
                      <div key={code.id} className="flex flex-col items-center gap-1">
                        <div className="bg-white p-1.5 rounded-lg">
                          <QRCode
                            value={`/qr-register?pass=${code.pass_id}${batch.promo_code ? `&promo=${batch.promo_code}` : ""}&tier=${batch.tier}`}
                            size={80}
                          />
                        </div>
                        <span className="text-[10px] text-muted-foreground font-mono">{code.pass_id}</span>
                        {code.converted_at && (
                          <span className="text-[9px] text-green-600">✓</span>
                        )}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
