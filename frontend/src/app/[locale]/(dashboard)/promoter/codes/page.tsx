"use client";

import { useEffect, useState } from "react";
import { QrCode, Plus, Loader2, CheckCircle, XCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiClient } from "@/lib/api-client";
import { toast } from "sonner";
import { useTranslate } from "@tolgee/react";

interface PromoCode {
  id: string;
  code: string;
  tier_grant: string | null;
  quota: number;
  uses_count: number;
  reg_commission: number;
  checkin_commission_flat: number | null;
  checkin_commission_pct: number | null;
  is_active: boolean;
  created_at: string;
}

export default function PromoterCodesPage() {
  const { t } = useTranslate();
  const [codes, setCodes] = useState<PromoCode[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [newCode, setNewCode] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [showForm, setShowForm] = useState(false);

  const fetchCodes = () => {
    apiClient.get<PromoCode[]>("/promoters/codes")
      .then(setCodes)
      .catch(() => {})
      .finally(() => setIsLoading(false));
  };

  useEffect(() => { fetchCodes(); }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCode.trim()) return;
    setIsCreating(true);
    try {
      await apiClient.post("/promoters/codes", {
        code: newCode.trim().toUpperCase(),
      });
      toast.success(t("promoterCodes.codeCreated"), { description: t("promoterCodes.codeCreatedDesc", { code: newCode.toUpperCase() }) });
      setNewCode("");
      setShowForm(false);
      fetchCodes();
    } catch (err: unknown) {
      toast.error(t("promoterCodes.createFailed"), { description: (err as { message?: string })?.message ?? t("promoterCodes.createFailedDesc") });
    } finally {
      setIsCreating(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[300px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-light tracking-wide">{t("promoterCodes.title")}</h1>
          <p className="text-sm text-muted-foreground mt-1">{t("promoterCodes.subtitle")}</p>
        </div>
        <Button onClick={() => setShowForm((v) => !v)} size="sm">
          <Plus className="h-4 w-4 mr-1" />
          {t("promoterCodes.newCode")}
        </Button>
      </div>

      {showForm && (
        <Card className="rounded-xl border-primary/30">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">{t("promoterCodes.createTitle")}</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreate} className="flex gap-2">
              <Input
                placeholder={t("promoterCodes.codePlaceholder")}
                value={newCode}
                onChange={(e) => setNewCode(e.target.value)}
                className="uppercase flex-1"
                required
              />
              <Button type="submit" size="sm" disabled={isCreating}>
                {isCreating ? <Loader2 className="h-4 w-4 animate-spin" /> : t("promoterCodes.create")}
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={() => setShowForm(false)}>
                {t("promoterCodes.cancel")}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {codes.length === 0 ? (
        <Card className="rounded-xl border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center gap-2">
            <QrCode className="h-10 w-10 text-muted-foreground/30" />
            <p className="text-sm text-muted-foreground">{t("promoterCodes.noCodes")}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {codes.map((code) => (
            <Card key={code.id} className="rounded-xl">
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="rounded-lg bg-muted p-2">
                      <QrCode className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-mono font-medium tracking-wider">{code.code}</p>
                        {code.is_active ? (
                          <CheckCircle className="h-3.5 w-3.5 text-emerald-500" />
                        ) : (
                          <XCircle className="h-3.5 w-3.5 text-rose-500" />
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-0.5 text-xs text-muted-foreground">
                        <span>{t("promoterCodes.uses", { count: code.uses_count })}</span>
                        {code.quota > 0 && <span>{t("promoterCodes.quota", { quota: code.quota })}</span>}
                      </div>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-medium text-primary">
                      ฿{Number(code.reg_commission).toLocaleString()}
                    </p>
                    <p className="text-xs text-muted-foreground">{t("promoterCodes.commission")}</p>
                  </div>
                </div>
                {/* QR URL hint */}
                <p className="mt-3 text-xs text-muted-foreground bg-muted rounded px-2 py-1 font-mono truncate">
                  {typeof window !== "undefined" ? window.location.origin : ""}/qr-register?promo={code.code}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
