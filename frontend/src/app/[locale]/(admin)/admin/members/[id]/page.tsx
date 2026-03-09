"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Loader2, ArrowLeft, Users, DollarSign, Headphones, Zap } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { apiClient } from "@/lib/api-client";
import type { MemberDetail } from "@/types";
import { useTranslate } from "@tolgee/react";

const TIER_COLORS: Record<string, string> = {
  silver: "bg-slate-100 text-slate-700",
  gold: "bg-yellow-100 text-yellow-800",
  obsidian: "bg-gray-900 text-white",
};

const TAP_TYPE_COLORS: Record<string, string> = {
  venue_entry: "bg-green-100 text-green-700",
  payment_tap: "bg-primary/10 text-primary",
  connection_tap: "bg-blue-100 text-blue-700",
  locker_access: "bg-purple-100 text-purple-700",
};

function formatAmount(amount: number) {
  return `฿${Number(amount).toLocaleString("en-US", { minimumFractionDigits: 0 })}`;
}

export default function MemberDetailPage() {
  const { t } = useTranslate();
  const params = useParams();
  const router = useRouter();
  const memberId = params?.id as string;

  const [member, setMember] = useState<MemberDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [notes, setNotes] = useState("");
  const [savingNotes, setSavingNotes] = useState(false);
  const [notesSaved, setNotesSaved] = useState(false);

  useEffect(() => {
    if (!memberId) return;
    apiClient
      .get<MemberDetail>(`/admin/members/${memberId}`)
      .then((data) => {
        setMember(data);
        setNotes(data.staff_notes ?? "");
      })
      .catch(() => {})
      .finally(() => setIsLoading(false));
  }, [memberId]);

  const handleSaveNotes = async () => {
    if (!member) return;
    setSavingNotes(true);
    try {
      await apiClient.patch(`/admin/members/${member.id}/notes`, { notes });
      setMember((prev) => prev ? { ...prev, staff_notes: notes } : prev);
      setNotesSaved(true);
      setTimeout(() => setNotesSaved(false), 2000);
    } catch {
      // silent
    } finally {
      setSavingNotes(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[300px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!member) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-4">
        <p className="text-muted-foreground">{t("memberDetail.notFound")}</p>
        <Button variant="ghost" onClick={() => router.push("/admin/members")}>
          <ArrowLeft className="h-4 w-4 mr-2" /> {t("memberDetail.backToMembers")}
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Back + Header */}
      <div>
        <Button
          variant="ghost"
          size="sm"
          className="mb-2 -ml-2 text-muted-foreground"
          onClick={() => router.push("/admin/members")}
        >
          <ArrowLeft className="h-4 w-4 mr-1" /> {t("members.title")}
        </Button>
        <div className="flex items-start gap-3 flex-wrap">
          <div>
            <h1 className="text-2xl font-light tracking-wide">
              {member.full_name ?? member.email}
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              {member.company_name && <span>{member.company_name} · </span>}
              {member.email}
            </p>
          </div>
          <div className="flex gap-2 flex-wrap mt-1">
            {member.tier && (
              <span className={`text-xs px-2.5 py-0.5 rounded-full font-medium capitalize ${TIER_COLORS[member.tier] ?? "bg-muted text-muted-foreground"}`}>
                {member.tier}
              </span>
            )}
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-muted text-muted-foreground capitalize">
              {member.user_type}
            </span>
            <span className={`text-xs px-2.5 py-0.5 rounded-full ${member.is_active ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
              {member.is_active ? "Active" : "Inactive"}
            </span>
          </div>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="pt-6 flex items-center gap-3">
            <Users className="h-8 w-8 text-primary/50" />
            <div>
              <p className="text-2xl font-light">{member.connections_count}</p>
              <p className="text-xs text-muted-foreground">{t("memberDetail.connections")}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 flex items-center gap-3">
            <DollarSign className="h-8 w-8 text-primary/50" />
            <div>
              <p className="text-2xl font-light">{formatAmount(member.tab_total)}</p>
              <p className="text-xs text-muted-foreground">{t("memberDetail.totalSpent")}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 flex items-center gap-3">
            <Headphones className="h-8 w-8 text-primary/50" />
            <div>
              <p className="text-2xl font-light">{member.service_requests_count}</p>
              <p className="text-xs text-muted-foreground">{t("memberDetail.serviceRequests")}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Recent Taps */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Zap className="h-4 w-4 text-primary" />
              {t("memberDetail.recentActivity")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {member.recent_taps.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">{t("memberDetail.noTapHistory")}</p>
            ) : (
              <div className="divide-y divide-border">
                {member.recent_taps.map((tap) => (
                  <div key={tap.id} className="flex items-center justify-between py-2 text-sm">
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full capitalize ${TAP_TYPE_COLORS[tap.tap_type] ?? "bg-muted text-muted-foreground"}`}
                    >
                      {tap.tap_type.replace(/_/g, " ")}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {tap.location && <span className="mr-2">{tap.location}</span>}
                      {new Date(tap.tapped_at).toLocaleString("en-GB", {
                        day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
                      })}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Staff Notes */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("memberDetail.staffNotes")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <textarea
              className="w-full min-h-[120px] p-3 text-sm rounded-lg border border-border bg-background resize-none focus:outline-none focus:ring-1 focus:ring-primary"
              placeholder={t("memberDetail.noteHint")}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
            <Button
              size="sm"
              onClick={handleSaveNotes}
              disabled={savingNotes}
              className="w-full"
            >
              {savingNotes ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : notesSaved ? (
                t("memberDetail.saved")
              ) : (
                t("memberDetail.saveNotes")
              )}
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Profile details */}
      {(member.industry || member.revenue_range || member.interests?.length > 0) && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("memberDetail.profileInfo")}</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-2 text-sm sm:grid-cols-2">
            {member.industry && (
              <div>
                <span className="text-muted-foreground">{t("memberDetail.industry")}: </span>
                <span className="capitalize">{member.industry}</span>
              </div>
            )}
            {member.revenue_range && (
              <div>
                <span className="text-muted-foreground">{t("memberDetail.revenueRange")}: </span>
                <span>{member.revenue_range}</span>
              </div>
            )}
            {member.interests?.length > 0 && (
              <div className="sm:col-span-2">
                <span className="text-muted-foreground">{t("memberDetail.interests")}: </span>
                <span>{member.interests.join(", ")}</span>
              </div>
            )}
            {member.phone && (
              <div>
                <span className="text-muted-foreground">{t("memberDetail.phone")}: </span>
                <span>{member.phone}</span>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
