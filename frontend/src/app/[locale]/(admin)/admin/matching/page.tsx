"use client";

import { useEffect, useState } from "react";
import { Network, Loader2, ArrowLeftRight, Mail } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { apiClient } from "@/lib/api-client";
import { useTranslate } from "@tolgee/react";

interface MemberSide {
  member_id: string;
  full_name: string | null;
  company_name: string | null;
  industry: string | null;
  tier: string | null;
  segments: string[];
}

interface DealFlowPair {
  buyer: MemberSide;
  seller: MemberSide;
  mutual_connections: number;
  score: number;
}

export default function AdminMatchingPage() {
  const { t } = useTranslate();
  const [pairs, setPairs] = useState<DealFlowPair[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    apiClient.get<DealFlowPair[]>("/admin/matching/deal-flow")
      .then(setPairs)
      .catch(() => {})
      .finally(() => setIsLoading(false));
  }, []);

  const handleIntroduce = (buyer: MemberSide, seller: MemberSide) => {
    const subject = encodeURIComponent(`Introduction: ${buyer.full_name ?? "Member"} ↔ ${seller.full_name ?? "Member"}`);
    const body = encodeURIComponent(
      `Hi,\n\nI'd like to arrange an introduction between:\n\n` +
      `• ${buyer.full_name ?? "Member"} — ${buyer.company_name ?? buyer.industry ?? "—"}\n` +
      `• ${seller.full_name ?? "Member"} — ${seller.company_name ?? seller.industry ?? "—"}\n\n` +
      `These members have complementary business profiles and could benefit from a formal introduction.\n\nS8LLS Club Concierge`
    );
    window.open(`mailto:?subject=${subject}&body=${body}`);
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Network className="w-7 h-7 text-[#C9A96E]" />
        <div>
          <h1 className="text-2xl font-bold text-white">{t("matching.title")}</h1>
          <p className="text-zinc-400 text-sm">{t("matching.aiSubtitle")}</p>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 text-zinc-400">
          <Loader2 className="w-4 h-4 animate-spin" />
          {t("matching.loading")}
        </div>
      ) : pairs.length === 0 ? (
        <Card className="bg-zinc-900 border-zinc-800">
          <CardContent className="py-12 text-center text-zinc-500">
            {t("matching.noMatches")}
            <p className="mt-1 text-sm">{t("matching.noMatchesHint")}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {pairs.map((pair, idx) => (
            <Card key={idx} className="bg-zinc-900 border-zinc-800">
              <CardContent className="p-5">
                <div className="flex items-center gap-4">
                  {/* Buyer */}
                  <div className="flex-1 space-y-1">
                    <p className="text-xs text-[#C9A96E] font-semibold uppercase tracking-wide">{t("matching.buyer")}</p>
                    <p className="font-semibold text-white">{pair.buyer.full_name ?? "—"}</p>
                    <p className="text-sm text-zinc-400">{pair.buyer.company_name ?? pair.buyer.industry ?? "—"}</p>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {pair.buyer.segments.map((s) => (
                        <Badge key={s} variant="outline" className="text-xs border-zinc-700 text-zinc-300">{s}</Badge>
                      ))}
                    </div>
                  </div>

                  {/* Divider */}
                  <div className="flex flex-col items-center gap-1 text-zinc-600">
                    <ArrowLeftRight className="w-5 h-5" />
                    <span className="text-xs font-mono text-[#C9A96E]">{t("matching.score")}: {pair.score.toFixed(1)}</span>
                    {pair.mutual_connections > 0 && (
                      <span className="text-xs text-zinc-500">{pair.mutual_connections} {t("matching.mutual")}</span>
                    )}
                  </div>

                  {/* Seller */}
                  <div className="flex-1 space-y-1 text-right">
                    <p className="text-xs text-emerald-400 font-semibold uppercase tracking-wide">{t("matching.seller")}</p>
                    <p className="font-semibold text-white">{pair.seller.full_name ?? "—"}</p>
                    <p className="text-sm text-zinc-400">{pair.seller.company_name ?? pair.seller.industry ?? "—"}</p>
                    <div className="flex flex-wrap gap-1 mt-1 justify-end">
                      {pair.seller.segments.map((s) => (
                        <Badge key={s} variant="outline" className="text-xs border-zinc-700 text-zinc-300">{s}</Badge>
                      ))}
                    </div>
                  </div>

                  {/* Action */}
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-zinc-700 text-zinc-300 hover:bg-zinc-800 ml-3 shrink-0"
                    onClick={() => handleIntroduce(pair.buyer, pair.seller)}
                  >
                    <Mail className="w-4 h-4 mr-1" />
                    {t("matching.introduce")}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
