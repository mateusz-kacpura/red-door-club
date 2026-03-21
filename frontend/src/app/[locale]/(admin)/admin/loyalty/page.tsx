"use client";

import { useEffect, useState } from "react";
import { Star, Trophy, Loader2, Users } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiClient } from "@/lib/api-client";
import { toast } from "sonner";
import { useTranslate } from "@tolgee/react";

interface LeaderboardEntry {
  rank: number;
  member_id: string;
  full_name: string | null;
  company_name: string | null;
  tier: string | null;
  lifetime_points: number;
  current_balance: number;
}

export default function AdminLoyaltyPage() {
  const { t } = useTranslate();
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Award form state
  const [memberId, setMemberId] = useState("");
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("manual_award");
  const [isAwarding, setIsAwarding] = useState(false);

  const fetchLeaderboard = async () => {
    try {
      const data = await apiClient.get<LeaderboardEntry[]>("/admin/loyalty/leaderboard?limit=10");
      setLeaderboard(data);
    } catch {
      // silent
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { fetchLeaderboard(); }, []);

  const handleAward = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!memberId.trim() || !amount) return;
    const pts = parseInt(amount, 10);
    if (isNaN(pts) || pts <= 0) {
      toast.error(t("loyalty.invalidAmountTitle"), { description: t("loyalty.pointsMustBePositive") });
      return;
    }
    setIsAwarding(true);
    try {
      await apiClient.post("/admin/loyalty/award", {
        member_id: memberId.trim(),
        amount: pts,
        reason,
      });
      toast.success(t("loyalty.pointsAwarded"), { description: `${pts} pts → ${memberId.slice(0, 8)}…` });
      setMemberId("");
      setAmount("");
      setReason("manual_award");
      fetchLeaderboard();
    } catch (err: unknown) {
      const msg = (err as { message?: string })?.message ?? "Failed to award points.";
      toast.error(t("loyalty.awardFailed"), { description: msg });
    } finally {
      setIsAwarding(false);
    }
  };

  const tierColor: Record<string, string> = {
    founder: "text-yellow-500",
    gold: "text-yellow-400",
    silver: "text-slate-400",
    member: "text-muted-foreground",
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-light tracking-wide">{t("loyalty.managementTitle")}</h1>
        <p className="text-sm text-muted-foreground mt-1">{t("loyalty.managementSubtitle")}</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Leaderboard */}
        <div className="lg:col-span-2 space-y-4">
          <h2 className="text-sm font-medium uppercase tracking-wider text-muted-foreground flex items-center gap-2">
            <Trophy className="h-4 w-4 text-primary" />
            {t("loyalty.topMembersLifetime")}
          </h2>

          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : leaderboard.length === 0 ? (
            <Card className="rounded-xl border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-12 text-center gap-2">
                <Users className="h-8 w-8 text-muted-foreground/30" />
                <p className="text-sm text-muted-foreground">{t("loyalty.noActivity")}</p>
              </CardContent>
            </Card>
          ) : (
            <Card className="rounded-xl">
              <CardContent className="p-0 divide-y divide-border">
                {leaderboard.map((entry) => (
                  <div key={entry.member_id} className="flex items-center gap-4 px-4 py-3">
                    {/* Rank */}
                    <div className="w-7 text-center shrink-0">
                      {entry.rank <= 3 ? (
                        <span className={[
                          "text-base",
                          entry.rank === 1 ? "text-yellow-400" :
                          entry.rank === 2 ? "text-slate-400" : "text-amber-600",
                        ].join(" ")}>
                          {entry.rank === 1 ? "🥇" : entry.rank === 2 ? "🥈" : "🥉"}
                        </span>
                      ) : (
                        <span className="text-sm text-muted-foreground">{entry.rank}</span>
                      )}
                    </div>

                    {/* Member info */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        {entry.full_name ?? t("loyalty.unknownMember")}
                      </p>
                      {entry.company_name && (
                        <p className="text-xs text-muted-foreground truncate">{entry.company_name}</p>
                      )}
                    </div>

                    {/* Tier */}
                    {entry.tier && (
                      <Badge
                        variant="outline"
                        className={`text-xs capitalize shrink-0 ${tierColor[entry.tier] ?? ""}`}
                      >
                        {entry.tier}
                      </Badge>
                    )}

                    {/* Points */}
                    <div className="text-right shrink-0">
                      <p className="text-sm font-medium text-primary">
                        {entry.lifetime_points.toLocaleString()}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {entry.current_balance.toLocaleString()} {t("loyalty.bal")}
                      </p>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Award form */}
        <div className="space-y-4">
          <h2 className="text-sm font-medium uppercase tracking-wider text-muted-foreground flex items-center gap-2">
            <Star className="h-4 w-4 text-primary" />
            {t("loyalty.awardPoints")}
          </h2>

          <Card className="rounded-xl">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">{t("loyalty.manualAward")}</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleAward} className="space-y-3">
                <div className="space-y-1.5">
                  <label className="text-xs text-muted-foreground uppercase tracking-wide">
                    {t("loyalty.memberUuid")}
                  </label>
                  <Input
                    placeholder="xxxxxxxx-xxxx-xxxx-..."
                    value={memberId}
                    onChange={(e) => setMemberId(e.target.value)}
                    className="text-sm font-mono"
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs text-muted-foreground uppercase tracking-wide">
                    {t("loyalty.points")}
                  </label>
                  <Input
                    type="number"
                    min={1}
                    max={10000}
                    placeholder={t("loyalty.pointsPlaceholder")}
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs text-muted-foreground uppercase tracking-wide">
                    {t("loyalty.reason")}
                  </label>
                  <select
                    className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                  >
                    <option value="manual_award">{t("loyalty.reasonManualAward")}</option>
                    <option value="guest_referral">{t("loyalty.reasonGuestReferralAward")}</option>
                    <option value="podcast_recording">{t("loyalty.reasonPodcastAward")}</option>
                    <option value="event_attendance">{t("loyalty.reasonEventAward")}</option>
                  </select>
                </div>

                <Button type="submit" className="w-full" disabled={isAwarding}>
                  {isAwarding ? (
                    <><Loader2 className="h-4 w-4 animate-spin mr-2" />{t("loyalty.awarding")}</>
                  ) : (
                    t("loyalty.awardPointsBtn")
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
