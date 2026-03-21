"use client";

import { useEffect, useState } from "react";
import { UserPlus, Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { apiClient } from "@/lib/api-client";
import { useTranslate } from "@tolgee/react";

interface Referral {
  user_full_name: string | null;
  promo_code: string;
  registered_at: string;
}

export default function PromoterReferralsPage() {
  const { t } = useTranslate();
  const [referrals, setReferrals] = useState<Referral[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    apiClient
      .get<Referral[]>("/promoters/me/referrals")
      .then(setReferrals)
      .catch(() => {})
      .finally(() => setIsLoading(false));
  }, []);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[300px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-light tracking-wide">{t("promoterReferrals.title")}</h1>
        <p className="text-sm text-muted-foreground mt-1">{t("promoterReferrals.subtitle")}</p>
      </div>

      {referrals.length === 0 ? (
        <Card className="rounded-xl border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center gap-2">
            <UserPlus className="h-10 w-10 text-muted-foreground/30" />
            <p className="text-sm text-muted-foreground">{t("promoterReferrals.noReferrals")}</p>
          </CardContent>
        </Card>
      ) : (
        <Card className="rounded-xl">
          <CardContent className="p-0 divide-y divide-border">
            {referrals.map((r, i) => (
              <div key={i} className="flex items-center justify-between px-4 py-3">
                <div>
                  <p className="text-sm font-medium">{r.user_full_name ?? t("promoterReferrals.anonymous")}</p>
                  <p className="text-xs text-muted-foreground">
                    {t("promoterReferrals.registeredAt", {
                      date: new Date(r.registered_at).toLocaleDateString("en-GB", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      }),
                    })}
                  </p>
                </div>
                <span className="text-xs font-mono text-muted-foreground">{r.promo_code}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
