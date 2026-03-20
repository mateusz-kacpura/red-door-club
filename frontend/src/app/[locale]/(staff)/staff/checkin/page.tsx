"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2, CheckCircle2, AlertCircle, CalendarDays, ScanLine } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { apiClient, ApiError } from "@/lib/api-client";
import { ROUTES } from "@/lib/constants";
import { useTranslate } from "@tolgee/react";

interface MemberInfo {
  id: string;
  full_name: string | null;
  tier: string | null;
  company_name: string | null;
  is_active: boolean;
}

interface EventInfo {
  id: string;
  title: string;
  ticket_price: string;
  starts_at: string;
  promo_tiers: string[];
}

interface CheckinResult {
  status: string;
  member_name: string;
  event_title: string;
  fee: string;
  is_promo: boolean;
}

type PageStatus =
  | "loading"
  | "ready"
  | "no_events"
  | "checking_in"
  | "checked_in"
  | "already_checked_in"
  | "error"
  | "member_not_found";

const TIER_BADGE_COLORS: Record<string, string> = {
  vip: "bg-red-100 text-red-700",
  platinum: "bg-purple-100 text-purple-700",
  gold: "bg-amber-100 text-amber-700",
  silver: "bg-slate-100 text-slate-700",
};

function isPromoForMember(memberTier: string | null, event: EventInfo): boolean {
  if (!memberTier) return false;
  const tier = memberTier.toLowerCase();
  if (tier === "vip") return true;
  return (event.promo_tiers || []).map((t) => t.toLowerCase()).includes(tier);
}

export default function StaffCheckinPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const memberId = searchParams.get("member");
  const { t } = useTranslate();

  const [status, setStatus] = useState<PageStatus>("loading");
  const [member, setMember] = useState<MemberInfo | null>(null);
  const [events, setEvents] = useState<EventInfo[]>([]);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [result, setResult] = useState<CheckinResult | null>(null);
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    if (!memberId) {
      setStatus("member_not_found");
      return;
    }

    const fetchData = async () => {
      try {
        const [memberData, eventsData] = await Promise.all([
          apiClient.get<MemberInfo>(`/staff/member/${memberId}`),
          apiClient.get<EventInfo[]>("/staff/today-events"),
        ]);

        setMember(memberData);
        setEvents(eventsData);

        if (eventsData.length === 0) {
          setStatus("no_events");
        } else {
          setSelectedEventId(eventsData[0].id);
          setStatus("ready");
        }
      } catch (err) {
        if (err instanceof ApiError && err.status === 404) {
          setStatus("member_not_found");
          setErrorMsg(err.message);
        } else {
          setStatus("error");
          setErrorMsg(err instanceof Error ? err.message : "Unknown error");
        }
      }
    };

    fetchData();
  }, [memberId]);

  const handleCheckin = async () => {
    if (!memberId || !selectedEventId) return;
    setStatus("checking_in");

    try {
      const data = await apiClient.post<CheckinResult>("/staff/checkin", {
        member_id: memberId,
        event_id: selectedEventId,
      });
      setResult(data);
      setStatus("checked_in");
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setStatus("already_checked_in");
      } else {
        setStatus("error");
        setErrorMsg(err instanceof Error ? err.message : "Checkin failed");
      }
    }
  };

  // Loading
  if (status === "loading") {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">{t("common.loading")}</p>
      </div>
    );
  }

  // Member not found
  if (status === "member_not_found") {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3">
        <AlertCircle className="h-12 w-12 text-destructive/50" />
        <h2 className="text-lg font-semibold">{t("staff.memberNotFound")}</h2>
        {errorMsg && <p className="text-sm text-muted-foreground">{errorMsg}</p>}
        <Button variant="outline" className="mt-4 gap-2" onClick={() => router.push(ROUTES.STAFF_HOME)}>
          <ScanLine className="h-4 w-4" />
          {t("staff.scanNext")}
        </Button>
      </div>
    );
  }

  // Error
  if (status === "error") {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3">
        <AlertCircle className="h-12 w-12 text-destructive/50" />
        <h2 className="text-lg font-semibold">{t("staff.error", { defaultValue: "Error" })}</h2>
        <p className="text-sm text-muted-foreground">{errorMsg}</p>
        <Button variant="outline" className="mt-4 gap-2" onClick={() => router.push(ROUTES.STAFF_HOME)}>
          <ScanLine className="h-4 w-4" />
          {t("staff.scanNext")}
        </Button>
      </div>
    );
  }

  // Checked in successfully
  if (status === "checked_in" && result) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <CheckCircle2 className="h-16 w-16 text-green-500" />
        <h2 className="text-xl font-semibold">{t("staff.checkedIn")}</h2>
        <div className="text-center space-y-1">
          <p className="text-lg">{result.member_name}</p>
          <p className="text-sm text-muted-foreground">{result.event_title}</p>
          <p className="text-2xl font-light mt-2">
            {result.is_promo ? (
              <span className="text-green-600">0 ฿ <span className="text-sm font-medium">(PROMO)</span></span>
            ) : (
              <span>฿{Number(result.fee).toLocaleString()}</span>
            )}
          </p>
        </div>
        <Button variant="outline" className="gap-2" onClick={() => router.push(ROUTES.STAFF_HOME)}>
          <ScanLine className="h-4 w-4" />
          {t("staff.scanNext")}
        </Button>
      </div>
    );
  }

  // Already checked in
  if (status === "already_checked_in") {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <CheckCircle2 className="h-16 w-16 text-amber-500" />
        <h2 className="text-xl font-semibold">{t("staff.alreadyCheckedIn")}</h2>
        <p className="text-sm text-muted-foreground">
          {member?.full_name || "Member"} {t("staff.alreadyCheckedInDesc", { defaultValue: "is already checked in to this event." })}
        </p>
        <Button variant="outline" className="mt-2 gap-2" onClick={() => router.push(ROUTES.STAFF_HOME)}>
          <ScanLine className="h-4 w-4" />
          {t("staff.scanNext")}
        </Button>
      </div>
    );
  }

  // No events today
  if (status === "no_events") {
    return (
      <div className="space-y-6">
        {member && <MemberCard member={member} />}
        <div className="flex flex-col items-center justify-center py-12 gap-3">
          <CalendarDays className="h-12 w-12 text-muted-foreground/30" />
          <p className="text-muted-foreground">{t("staff.noEventsToday")}</p>
        </div>
      </div>
    );
  }

  // Ready — show member + events
  return (
    <div className="space-y-6">
      {member && <MemberCard member={member} />}

      <div>
        <h3 className="text-sm font-medium mb-3">{t("staff.selectEvent")}</h3>
        <div className="space-y-2">
          {events.map((event) => {
            const promo = isPromoForMember(member?.tier ?? null, event);
            const isSelected = selectedEventId === event.id;
            return (
              <button
                key={event.id}
                type="button"
                onClick={() => setSelectedEventId(event.id)}
                className={`w-full text-left p-4 rounded-xl border transition-colors ${
                  isSelected
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-primary/40"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">{event.title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {new Date(event.starts_at).toLocaleTimeString("en-GB", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  </div>
                  <div className="text-right">
                    {promo ? (
                      <span className="text-green-600 font-semibold text-sm">
                        0 ฿ <span className="text-xs font-medium">(PROMO)</span>
                      </span>
                    ) : (
                      <span className="font-semibold text-sm">
                        ฿{Number(event.ticket_price).toLocaleString()}
                      </span>
                    )}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <Button
        className="w-full h-14 text-lg"
        onClick={handleCheckin}
        disabled={!selectedEventId || status === "checking_in"}
      >
        {status === "checking_in" ? (
          <>
            <Loader2 className="h-5 w-5 animate-spin mr-2" />
            {t("staff.checkingIn")}
          </>
        ) : (
          t("staff.checkin")
        )}
      </Button>
    </div>
  );
}

function MemberCard({ member }: { member: MemberInfo }) {
  const tierColor = member.tier
    ? TIER_BADGE_COLORS[member.tier.toLowerCase()] || "bg-muted text-muted-foreground"
    : "";

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-lg font-semibold">{member.full_name || "Member"}</p>
          {member.company_name && (
            <p className="text-sm text-muted-foreground">{member.company_name}</p>
          )}
        </div>
        {member.tier && (
          <span className={`text-sm px-3 py-1 rounded-full font-semibold capitalize ${tierColor}`}>
            {member.tier}
          </span>
        )}
      </div>
    </Card>
  );
}
