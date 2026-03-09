"use client";

import { useEffect, useState } from "react";
import { Lock, Unlock, Loader2 } from "lucide-react";
import { useTranslate } from "@tolgee/react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { apiClient } from "@/lib/api-client";
import type { Locker } from "@/types";

export default function LockerPage() {
  const { t } = useTranslate();
  const [locker, setLocker] = useState<Locker | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchLocker = async () => {
      try {
        const data = await apiClient.get<Locker | null>("/members/locker");
        setLocker(data);
      } catch {
        // no locker or error — show empty state
      } finally {
        setIsLoading(false);
      }
    };
    fetchLocker();
  }, []);

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
        <h1 className="text-2xl font-light tracking-wide">{t("locker.title")}</h1>
        <p className="text-muted-foreground text-sm mt-1">
          {t("locker.subtitle")}
        </p>
      </div>

      {locker ? (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Lock className="h-5 w-5 text-primary" />
                {t("locker.lockerNumber", { number: locker.locker_number })}
              </CardTitle>
              <Badge variant="default" className="bg-primary/10 text-primary border-primary/20">
                Assigned
              </Badge>
            </div>
            <CardDescription>{locker.location.replace(/_/g, " ")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            {locker.assigned_at && (
              <p>
                Assigned:{" "}
                {new Date(locker.assigned_at).toLocaleTimeString("en-GB", {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </p>
            )}
            <p className="text-xs">Tap your card to the same locker reader to release it.</p>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center gap-4">
            <Unlock className="h-12 w-12 text-muted-foreground/40" />
            <p className="text-muted-foreground">{t("locker.noLocker")}</p>
            <p className="text-xs text-muted-foreground">
              {t("locker.noLockerHint")}
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
