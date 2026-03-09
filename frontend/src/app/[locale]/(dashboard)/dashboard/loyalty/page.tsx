"use client";

import { useEffect, useState } from "react";
import { Star, TrendingUp, Loader2, CheckCircle2, Gift } from "lucide-react";
import { useTranslate } from "@tolgee/react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { apiClient } from "@/lib/api-client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface PointsBalance {
  balance: number;
  lifetime_total: number;
}

interface LoyaltyTransaction {
  id: string;
  points: number;
  reason: string;
  created_at: string;
}

const REDEMPTION_OPTIONS = [
  { id: "event_ticket", labelKey: "loyalty.rewardEventTicket", points: 150, descKey: "loyalty.rewardEventTicketDesc" },
  { id: "car_booking", labelKey: "loyalty.rewardCarBooking", points: 200, descKey: "loyalty.rewardCarBookingDesc" },
  { id: "studio_session", labelKey: "loyalty.rewardStudioSession", points: 300, descKey: "loyalty.rewardStudioSessionDesc" },
];

const REASON_KEYS: Record<string, string> = {
  event_attendance: "loyalty.reasonVenueEntry",
  service_request: "loyalty.reasonServiceRequest",
  guest_referral: "loyalty.reasonGuestReferral",
  podcast_recording: "loyalty.reasonPodcastSession",
  manual_award: "loyalty.reasonAdminAward",
  redemption: "loyalty.reasonRedemption",
};

export default function LoyaltyPage() {
  const { t } = useTranslate();
  const [balance, setBalance] = useState<PointsBalance | null>(null);
  const [history, setHistory] = useState<LoyaltyTransaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [redeeming, setRedeeming] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      const [bal, hist] = await Promise.all([
        apiClient.get<PointsBalance>("/members/points"),
        apiClient.get<LoyaltyTransaction[]>("/members/points/history?limit=20"),
      ]);
      setBalance(bal);
      setHistory(hist);
    } catch {
      // silent
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const handleRedeem = async (optionId: string, points: number, labelKey: string) => {
    setRedeeming(optionId);
    try {
      await apiClient.post("/members/points/redeem", { amount: points, reason: optionId });
      toast.success(t("loyalty.redeemedSuccess", { label: t(labelKey) }), { description: t("loyalty.pointsDeducted", { points }) });
      fetchData();
    } catch (err: unknown) {
      const msg = (err as { message?: string })?.message ?? t("loyalty.insufficientPoints");
      toast.error(t("loyalty.redemptionFailed"), { description: msg });
    } finally {
      setRedeeming(null);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[300px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const current = balance?.balance ?? 0;
  const lifetime = balance?.lifetime_total ?? 0;
  const nextMilestone = [150, 200, 300, 500, 1000].find((m) => m > current) ?? 1000;
  const progressPct = Math.min((current / nextMilestone) * 100, 100);

  return (
    <div className="space-y-8 max-w-2xl">
      <div>
        <h1 className="text-2xl font-light tracking-wide">{t("loyalty.title")}</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {t("loyalty.subtitle")}
        </p>
      </div>

      {/* Balance card */}
      <Card className="rounded-xl border-primary/20 bg-gradient-to-br from-background to-primary/5">
        <CardContent className="p-6">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs uppercase tracking-widest text-muted-foreground">{t("loyalty.currentBalance")}</p>
              <p className="text-5xl font-light mt-1 text-primary">{current.toLocaleString()}</p>
              <p className="text-sm text-muted-foreground mt-1">{t("loyalty.pts")}</p>
            </div>
            <div className="text-right">
              <p className="text-xs uppercase tracking-widest text-muted-foreground">{t("loyalty.lifetimeEarned")}</p>
              <p className="text-2xl font-light mt-1">{lifetime.toLocaleString()}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{t("loyalty.totalPoints")}</p>
            </div>
          </div>

          {/* Progress bar */}
          <div className="mt-6 space-y-1.5">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>{current.toLocaleString()} {t("loyalty.pts")}</span>
              <span>{t("loyalty.nextReward", { milestone: nextMilestone.toLocaleString() })}</span>
            </div>
            <div className="h-1.5 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full rounded-full bg-primary transition-all duration-500"
                style={{ width: `${progressPct}%` }}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Earn rates */}
      <div>
        <h2 className="text-sm font-medium uppercase tracking-wider text-muted-foreground mb-3">
          {t("loyalty.howToEarn")}
        </h2>
        <div className="grid gap-2 sm:grid-cols-2">
          {[
            { labelKey: "loyalty.earnEventVisit", pts: 50, icon: Star },
            { labelKey: "loyalty.earnServiceRequest", pts: 20, icon: TrendingUp },
            { labelKey: "loyalty.earnGuestReferral", pts: 100, icon: Gift },
            { labelKey: "loyalty.earnPodcastSession", pts: 150, icon: Star },
          ].map(({ labelKey, pts, icon: Icon }) => (
            <div key={labelKey} className="flex items-center gap-3 rounded-lg border p-3 text-sm">
              <Icon className="h-4 w-4 text-primary shrink-0" />
              <span className="flex-1 text-muted-foreground">{t(labelKey)}</span>
              <span className="font-medium text-primary">+{pts}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Redeem */}
      <div>
        <h2 className="text-sm font-medium uppercase tracking-wider text-muted-foreground mb-3">
          {t("loyalty.redeemRewards")}
        </h2>
        <div className="space-y-3">
          {REDEMPTION_OPTIONS.map((opt) => {
            const canAfford = current >= opt.points;
            return (
              <Card key={opt.id} className={cn("rounded-xl", !canAfford && "opacity-60")}>
                <CardContent className="p-4 flex items-center gap-4">
                  <div className="rounded-lg bg-primary/10 p-2.5 shrink-0">
                    <Gift className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium">{t(opt.labelKey)}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{t(opt.descKey)}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-medium text-primary">{opt.points} {t("loyalty.pts")}</p>
                    <Button
                      size="sm"
                      variant={canAfford ? "default" : "outline"}
                      disabled={!canAfford || redeeming !== null}
                      onClick={() => handleRedeem(opt.id, opt.points, opt.labelKey)}
                      className="mt-1 h-7 text-xs"
                    >
                      {redeeming === opt.id ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : canAfford ? (
                        t("loyalty.redeem")
                      ) : (
                        t("loyalty.needMore")
                      )}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Transaction history */}
      <div>
        <h2 className="text-sm font-medium uppercase tracking-wider text-muted-foreground mb-3">
          {t("loyalty.transactionHistory")}
        </h2>
        {history.length === 0 ? (
          <Card className="rounded-xl border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-10 text-center gap-2">
              <Star className="h-8 w-8 text-muted-foreground/30" />
              <p className="text-sm text-muted-foreground">{t("loyalty.noTransactions")}</p>
              <p className="text-xs text-muted-foreground">{t("loyalty.visitToEarn")}</p>
            </CardContent>
          </Card>
        ) : (
          <Card className="rounded-xl">
            <CardContent className="p-0 divide-y divide-border">
              {history.map((tx) => (
                <div key={tx.id} className="flex items-center justify-between px-4 py-3 text-sm">
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      "h-2 w-2 rounded-full shrink-0",
                      tx.points > 0 ? "bg-emerald-500" : "bg-rose-500"
                    )} />
                    <div>
                      <p>{REASON_KEYS[tx.reason] ? t(REASON_KEYS[tx.reason]) : tx.reason}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(tx.created_at).toLocaleDateString("en-GB", {
                          day: "numeric", month: "short", year: "numeric",
                        })}
                      </p>
                    </div>
                  </div>
                  <span className={cn(
                    "font-medium",
                    tx.points > 0 ? "text-emerald-500" : "text-rose-500"
                  )}>
                    {tx.points > 0 ? "+" : ""}{tx.points}
                  </span>
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
