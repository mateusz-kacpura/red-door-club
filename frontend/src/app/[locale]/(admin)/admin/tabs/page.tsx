"use client";

import { useEffect, useState } from "react";
import { Loader2, Receipt, CheckCircle, Download, FileDown } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { apiClient, ApiError } from "@/lib/api-client";
import type { Tab } from "@/types";
import { useTranslate } from "@tolgee/react";

function formatAmount(amount: number) {
  return `฿${Number(amount).toLocaleString("en-US", { minimumFractionDigits: 0 })}`;
}

function formatTime(dateStr: string) {
  return new Date(dateStr).toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function AdminTabsPage() {
  const { t } = useTranslate();
  const [tabs, setTabs] = useState<Tab[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [closing, setClosing] = useState<string | null>(null);

  const fetchTabs = async () => {
    try {
      const data = await apiClient.get<Tab[]>("/admin/tabs");
      setTabs(data);
    } catch {
      // silent
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchTabs();
    const interval = setInterval(fetchTabs, 30_000);
    return () => clearInterval(interval);
  }, []);

  const handleClose = async (tabId: string) => {
    setClosing(tabId);
    try {
      await apiClient.post(`/admin/tabs/${tabId}/close`, {});
      await fetchTabs();
    } catch (err) {
      alert(err instanceof ApiError ? err.message : t("tabs.closeFailed"));
    } finally {
      setClosing(null);
    }
  };

  const handleInvoice = (tabId: string) => {
    window.open(`/api/admin/tabs/${tabId}/invoice`, "_blank");
  };

  const handleExportCSV = () => {
    window.open("/api/admin/analytics/export-csv", "_blank");
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[300px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const totalRevenue = tabs.reduce((sum, t) => sum + Number(t.total_amount), 0);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-light tracking-wide">{t("tabs.title")}</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {t("tabs.totalRevenue", { amount: formatAmount(totalRevenue) })}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={handleExportCSV}>
          <FileDown className="h-4 w-4 mr-2" />
          {t("tabs.exportCsv")}
        </Button>
      </div>

      {tabs.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center gap-4">
          <CheckCircle className="h-12 w-12 text-primary/30" />
          <p className="text-muted-foreground">{t("tabs.noTabs")}</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {tabs.map((tab) => (
            <Card key={tab.id}>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <CardTitle className="text-base flex items-center gap-2">
                      <Receipt className="h-4 w-4 text-primary" />
                      {tab.member_id.slice(0, 8)}…
                    </CardTitle>
                    <CardDescription className="text-xs mt-0.5">
                      {t("tabs.opened")} {formatTime(tab.opened_at)}
                    </CardDescription>
                  </div>
                  <Badge variant="outline" className="text-xs">
                    {t("tabs.items", { count: tab.items.length })}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="divide-y divide-border text-sm">
                  {tab.items.slice(0, 3).map((item) => (
                    <div key={item.id} className="flex justify-between py-1">
                      <span className="text-muted-foreground truncate max-w-[140px]">
                        {item.description}
                      </span>
                      <span className="font-medium">{formatAmount(item.amount)}</span>
                    </div>
                  ))}
                  {tab.items.length > 3 && (
                    <p className="text-xs text-muted-foreground py-1">
                      +{t("tabs.moreItems", { count: tab.items.length - 3 })}
                    </p>
                  )}
                </div>
                <div className="flex items-center justify-between pt-1">
                  <span className="font-semibold">{formatAmount(tab.total_amount)}</span>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleInvoice(tab.id)}
                      title={t("tabs.downloadInvoice")}
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      disabled={closing === tab.id}
                      onClick={() => handleClose(tab.id)}
                    >
                      {closing === tab.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        t("tabs.closeTab")
                      )}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
