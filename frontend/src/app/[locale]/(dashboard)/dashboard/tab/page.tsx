"use client";

import { useEffect, useState } from "react";
import { Receipt, Loader2, Download } from "lucide-react";
import { useTranslate } from "@tolgee/react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { apiClient } from "@/lib/api-client";
import type { Tab } from "@/types";

function formatAmount(amount: number) {
  return `฿${Number(amount).toLocaleString("en-US", { minimumFractionDigits: 0 })}`;
}

function formatTime(dateStr: string) {
  return new Date(dateStr).toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function TabPage() {
  const { t } = useTranslate();
  const [tab, setTab] = useState<Tab | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchTab = async () => {
      try {
        const data = await apiClient.get<Tab | null>("/members/tab");
        setTab(data);
      } catch {
        // no tab or error
      } finally {
        setIsLoading(false);
      }
    };
    fetchTab();
  }, []);

  const handleDownloadInvoice = (tabId: string) => {
    window.open(`/api/members/tabs/${tabId}/invoice`, "_blank");
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[300px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6 max-w-lg mx-auto">
      <div>
        <h1 className="text-2xl font-light tracking-wide">{t("tab.title")}</h1>
        <p className="text-muted-foreground text-sm mt-1">
          {t("tab.subtitle")}
        </p>
      </div>

      {tab ? (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Receipt className="h-5 w-5 text-primary" />
                Current Tab
              </CardTitle>
              <Badge variant="outline">
                {tab.status === "open" ? "Open" : "Closed"}
              </Badge>
            </div>
            <CardDescription>
              Opened at {formatTime(tab.opened_at)}
              {tab.closed_at && ` · Closed at ${formatTime(tab.closed_at)}`}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {tab.items.length > 0 ? (
              <div className="divide-y divide-border">
                {tab.items.map((item) => (
                  <div key={item.id} className="flex items-center justify-between py-2">
                    <div>
                      <p className="text-sm font-medium">{item.description}</p>
                      <p className="text-xs text-muted-foreground">{formatTime(item.added_at)}</p>
                    </div>
                    <p className="text-sm font-semibold text-primary">
                      {formatAmount(item.amount)}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">No items yet.</p>
            )}

            <div className="border-t border-border pt-3 flex justify-between items-center">
              <span className="font-medium">Total</span>
              <span className="text-lg font-semibold text-primary">
                {formatAmount(tab.total_amount)}
              </span>
            </div>

            {tab.status === "closed" && (
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={() => handleDownloadInvoice(tab.id)}
              >
                <Download className="h-4 w-4 mr-2" />
                {t("tab.downloadInvoice")}
              </Button>
            )}

            {tab.status === "open" && (
              <p className="text-xs text-muted-foreground">
                Staff will close your tab at the end of your visit.
              </p>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center gap-4">
            <Receipt className="h-12 w-12 text-muted-foreground/40" />
            <p className="text-muted-foreground">{t("tab.noTab")}</p>
            <p className="text-xs text-muted-foreground">
              {t("tab.noTabHint")}
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
