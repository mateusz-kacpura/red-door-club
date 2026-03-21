"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Loader2, ArrowLeft, Users, DollarSign, Headphones, Zap, Pencil, X, Check, CreditCard, TrendingUp, Wallet, QrCode, DoorOpen } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiClient, ApiError } from "@/lib/api-client";
import type { MemberDetail } from "@/types";
import { useTranslate } from "@tolgee/react";
import QRCode from "react-qr-code";

const TIER_COLORS: Record<string, string> = {
  silver: "bg-slate-100 text-slate-700",
  gold: "bg-yellow-100 text-yellow-800",
  platinum: "bg-purple-100 text-purple-700",
  obsidian: "bg-gray-900 text-white",
  vip: "bg-red-100 text-red-700",
};

const TAP_TYPE_COLORS: Record<string, string> = {
  venue_entry: "bg-green-100 text-green-700",
  payment_tap: "bg-primary/10 text-primary",
  connection_tap: "bg-blue-100 text-blue-700",
  locker_access: "bg-purple-100 text-purple-700",
};

const TAP_TYPE_KEYS: Record<string, string> = {
  venue_entry: "activity.tapVenueEntry",
  payment_tap: "activity.tapPaymentTap",
  connection_tap: "activity.tapConnectionTap",
  locker_access: "activity.tapLockerAccess",
  profile_created: "activity.tapProfileCreated",
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

  // Edit profile state
  const [showEdit, setShowEdit] = useState(false);
  const [editForm, setEditForm] = useState({
    full_name: "",
    email: "",
    phone: "",
    company_name: "",
    tier: "",
    user_type: "",
    is_active: true,
  });
  const [saving, setSaving] = useState(false);
  const [editError, setEditError] = useState("");
  const [editSaved, setEditSaved] = useState(false);

  // Staff role state
  const [togglingStaff, setTogglingStaff] = useState(false);

  // Promoter code state
  const [renamingCodeId, setRenamingCodeId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");

  useEffect(() => {
    if (!memberId) return;
    apiClient
      .get<MemberDetail>(`/admin/members/${memberId}`)
      .then((data) => {
        setMember(data);
        setNotes(data.staff_notes ?? "");
        setEditForm({
          full_name: data.full_name ?? "",
          email: data.email ?? "",
          phone: data.phone ?? "",
          company_name: data.company_name ?? "",
          tier: data.tier ?? "",
          user_type: data.user_type ?? "member",
          is_active: data.is_active ?? true,
        });
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

  const handleSaveProfile = async () => {
    if (!member) return;
    setSaving(true);
    setEditError("");
    try {
      const payload = {
        full_name: editForm.full_name || null,
        email: editForm.email || null,
        phone: editForm.phone || null,
        company_name: editForm.company_name || null,
        tier: editForm.tier || null,
        user_type: editForm.user_type || null,
        is_active: editForm.is_active,
      };
      const updated = await apiClient.patch<MemberDetail>(`/admin/members/${member.id}`, payload);
      setMember((prev) => prev ? { ...prev, ...updated } : prev);
      setEditSaved(true);
      setShowEdit(false);
      setTimeout(() => setEditSaved(false), 3000);
    } catch (err) {
      if (err instanceof ApiError) setEditError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleToggleStaff = async () => {
    if (!member || member.role === "admin") return;
    setTogglingStaff(true);
    try {
      const isStaff = member.role === "staff";
      const endpoint = isStaff
        ? `/admin/members/${member.id}/revoke-staff`
        : `/admin/members/${member.id}/make-staff`;
      await apiClient.post(endpoint, {});
      const data = await apiClient.get<MemberDetail>(`/admin/members/${member.id}`);
      setMember(data);
      setEditForm((p) => ({ ...p, user_type: data.user_type ?? "member" }));
    } catch {
      // silent
    } finally {
      setTogglingStaff(false);
    }
  };

  const handleRenameCode = async (codeId: string) => {
    if (!renameValue.trim()) return;
    try {
      await apiClient.patch(`/admin/promo-codes/${codeId}`, {
        code: renameValue.trim().toUpperCase(),
      });
      setRenamingCodeId(null);
      setRenameValue("");
      // Re-fetch member detail
      if (member) {
        const data = await apiClient.get<MemberDetail>(`/admin/members/${member.id}`);
        setMember(data);
      }
    } catch {
      // silent
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
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-light tracking-wide">
              {member.full_name ?? member.email}
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              {member.company_name && <span>{member.company_name} · </span>}
              {member.email}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap mt-1">
            {member.tier && (
              <span className={`text-xs px-2.5 py-0.5 rounded-full font-medium capitalize ${TIER_COLORS[member.tier] ?? "bg-muted text-muted-foreground"}`}>
                {member.tier}
              </span>
            )}
            <span className={`text-xs px-2.5 py-0.5 rounded-full capitalize ${member.user_type === "promoter" ? "bg-purple-100 text-purple-700" : "bg-muted text-muted-foreground"}`}>
              {member.user_type}
            </span>
            <span className={`text-xs px-2.5 py-0.5 rounded-full ${member.is_active ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
              {member.is_active ? t("memberDetail.active") : t("memberDetail.inactive")}
            </span>
            <Button size="sm" variant="outline" className="h-7 text-xs gap-1.5" onClick={() => setShowEdit(!showEdit)}>
              {showEdit ? <X className="h-3.5 w-3.5" /> : <Pencil className="h-3.5 w-3.5" />}
              {showEdit ? t("common.cancel") : t("memberDetail.editProfile")}
            </Button>
            {member.role !== "admin" && (
              <Button
                size="sm"
                variant={member.role === "staff" ? "destructive" : "outline"}
                className="h-7 text-xs"
                onClick={handleToggleStaff}
                disabled={togglingStaff}
              >
                {togglingStaff ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : member.role === "staff" ? (
                  t("memberDetail.revokeStaff")
                ) : (
                  t("memberDetail.makeStaff")
                )}
              </Button>
            )}
            {editSaved && (
              <span className="text-xs text-green-600 flex items-center gap-1">
                <Check className="h-3.5 w-3.5" /> {t("memberDetail.editSaved")}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Edit profile form */}
      {showEdit && (
        <Card className="rounded-xl border-primary/20">
          <CardContent className="p-6 space-y-4">
            <h2 className="font-medium text-sm">{t("memberDetail.editProfile")}</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1">
                <Label className="text-xs">{t("memberDetail.fullNameLabel")}</Label>
                <Input
                  value={editForm.full_name}
                  onChange={(e) => setEditForm((p) => ({ ...p, full_name: e.target.value }))}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">{t("memberDetail.emailLabel")}</Label>
                <Input
                  type="email"
                  value={editForm.email}
                  onChange={(e) => setEditForm((p) => ({ ...p, email: e.target.value }))}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">{t("memberDetail.phoneLabel")}</Label>
                <Input
                  value={editForm.phone}
                  onChange={(e) => setEditForm((p) => ({ ...p, phone: e.target.value }))}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">{t("memberDetail.companyLabel")}</Label>
                <Input
                  value={editForm.company_name}
                  onChange={(e) => setEditForm((p) => ({ ...p, company_name: e.target.value }))}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">{t("memberDetail.tierLabel")}</Label>
                <select
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                  value={editForm.tier}
                  onChange={(e) => setEditForm((p) => ({ ...p, tier: e.target.value }))}
                >
                  <option value="">{t("memberDetail.noTier")}</option>
                  <option value="silver">{t("memberDetail.tierSilver")}</option>
                  <option value="gold">{t("memberDetail.tierGold")}</option>
                  <option value="platinum">{t("memberDetail.tierPlatinum")}</option>
                  <option value="obsidian">{t("memberDetail.tierObsidian")}</option>
                  <option value="vip">{t("memberDetail.tierVip")}</option>
                </select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">{t("memberDetail.userTypeLabel")}</Label>
                <select
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                  value={editForm.user_type}
                  onChange={(e) => setEditForm((p) => ({ ...p, user_type: e.target.value }))}
                >
                  <option value="prospect">{t("memberDetail.typeProspect")}</option>
                  <option value="member">{t("memberDetail.typeMember")}</option>
                  <option value="promoter">{t("memberDetail.typePromoter")}</option>
                  <option value="staff">{t("memberDetail.typeStaff")}</option>
                  <option value="admin">{t("memberDetail.typeAdmin")}</option>
                </select>
              </div>
              <div className="flex items-center gap-2 pt-4">
                <input
                  type="checkbox"
                  id="is_active"
                  checked={editForm.is_active}
                  onChange={(e) => setEditForm((p) => ({ ...p, is_active: e.target.checked }))}
                  className="h-4 w-4 rounded border-input accent-primary"
                />
                <Label htmlFor="is_active" className="text-xs cursor-pointer">{t("memberDetail.isActiveLabel")}</Label>
              </div>
            </div>
            {editError && <p className="text-sm text-destructive">{editError}</p>}
            <div className="flex gap-2 justify-end">
              <Button variant="outline" size="sm" onClick={() => { setShowEdit(false); setEditError(""); }}>
                {t("common.cancel")}
              </Button>
              <Button size="sm" onClick={handleSaveProfile} disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : t("common.saveChanges")}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Entry QR — hide for promoters (they only have promoter QR) */}
      {member.user_type !== "promoter" && !member.is_promoter && (
        <Card className="rounded-xl">
          <CardContent className="p-4 flex flex-col sm:flex-row gap-5 items-start">
            <div className="bg-white p-3 rounded-xl border border-border shrink-0">
              <QRCode
                value={`${typeof window !== "undefined" ? window.location.origin : ""}/staff/checkin?member=${member.id}`}
                size={120}
              />
            </div>
            <div className="space-y-2">
              <p className="text-sm font-medium flex items-center gap-2">
                <DoorOpen className="h-4 w-4 text-primary" />
                {t("profile.entryQr")}
              </p>
              <p className="text-xs text-muted-foreground">{t("profile.entryQrHint")}</p>
              <p className="text-xs text-muted-foreground bg-muted rounded px-2 py-1 font-mono truncate">
                {typeof window !== "undefined" ? window.location.origin : ""}/staff/checkin?member={member.id}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* NFC Card QR */}
      {member.nfc_cards && member.nfc_cards.length > 0 && (
        <Card className="rounded-xl">
          <CardContent className="p-4 flex flex-col sm:flex-row gap-5 items-start">
            <div className="bg-white p-3 rounded-xl border border-border shrink-0">
              <QRCode
                value={`${typeof window !== "undefined" ? window.location.origin : ""}/tap?cid=${member.nfc_cards[0].card_id}`}
                size={120}
              />
            </div>
            <div className="space-y-2">
              <p className="text-sm font-medium flex items-center gap-2">
                <CreditCard className="h-4 w-4 text-primary" />
                {t("memberDetail.nfcCard")}
              </p>
              {member.nfc_cards.map((card: { card_id: string; status: string }) => (
                <div key={card.card_id} className="flex items-center gap-2">
                  <span className="font-mono text-xs bg-muted px-2 py-1 rounded">{card.card_id}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full capitalize ${card.status === "active" ? "bg-green-100 text-green-700" : "bg-muted text-muted-foreground"}`}>
                    {card.status === "active" ? t("memberDetail.active") : card.status === "inactive" ? t("memberDetail.inactive") : card.status}
                  </span>
                </div>
              ))}
              <p className="text-xs text-muted-foreground">{t("profile.nfcCardHint")}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Promoter QR Code */}
      {(member.user_type === "promoter" || member.is_promoter) && (
        <Card className="rounded-xl">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <QrCode className="h-4 w-4 text-primary" />
              {t("memberDetail.promoterQrTitle")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {member.promoter_codes && member.promoter_codes.length > 0 ? (
              <div className="space-y-4">
                {member.promoter_codes.map((pc) => (
                  <div key={pc.id} className="flex flex-col sm:flex-row gap-4 items-start">
                    <div className="bg-white p-3 rounded-xl border border-border shrink-0">
                      <QRCode
                        value={`${typeof window !== "undefined" ? window.location.origin : ""}/qr-register?promo=${pc.code}`}
                        size={120}
                      />
                    </div>
                    <div className="flex-1 space-y-2">
                      {renamingCodeId === pc.id ? (
                        <div className="flex gap-2 items-center">
                          <Input
                            value={renameValue}
                            onChange={(e) => setRenameValue(e.target.value)}
                            className="uppercase h-8 font-mono max-w-[200px]"
                            placeholder={t("memberDetail.promoterCodeNamePlaceholder")}
                          />
                          <Button size="sm" variant="ghost" className="h-8 px-2" onClick={() => handleRenameCode(pc.id)}>
                            <Check className="h-3.5 w-3.5" />
                          </Button>
                          <Button size="sm" variant="ghost" className="h-8 px-2" onClick={() => { setRenamingCodeId(null); setRenameValue(""); }}>
                            <X className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <p className="font-mono font-medium tracking-wider text-lg">{pc.code}</p>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 px-2"
                            onClick={() => { setRenamingCodeId(pc.id); setRenameValue(pc.code); }}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      )}
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <span>{t("memberDetail.promoterCodeUses", { count: pc.uses_count })}</span>
                        <span>{t("memberDetail.promoterRegCommission")}: {formatAmount(pc.reg_commission)}</span>
                        <span>
                          {t("memberDetail.promoterCheckinCommission")}:{" "}
                          {pc.checkin_commission_flat !== null
                            ? formatAmount(pc.checkin_commission_flat)
                            : pc.checkin_commission_pct !== null
                              ? `${pc.checkin_commission_pct}%`
                              : t("memberDetail.promoterCommissionNone")}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground bg-muted rounded px-2 py-1 font-mono truncate">
                        {typeof window !== "undefined" ? window.location.origin : ""}/qr-register?promo={pc.code}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center gap-4 py-6">
                <QrCode className="h-10 w-10 text-muted-foreground/30" />
                <p className="text-sm text-muted-foreground">{t("memberDetail.promoterNoCode")}</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Stat cards */}
      {member.user_type === "promoter" && member.promoter_stats ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[
            { label: t("memberDetail.promoterConversions"), value: member.promoter_stats.total_uses.toString(), icon: TrendingUp },
            { label: t("memberDetail.promoterRevenue"), value: formatAmount(member.promoter_stats.total_revenue), icon: DollarSign },
            { label: t("memberDetail.promoterCommission"), value: formatAmount(member.promoter_stats.commission_earned), icon: DollarSign },
            { label: t("memberDetail.promoterPendingPayout"), value: formatAmount(member.promoter_stats.pending_payout), icon: Wallet },
          ].map(({ label, value, icon: Icon }) => (
            <Card key={label}>
              <CardContent className="pt-6 flex items-center gap-3">
                <Icon className="h-8 w-8 text-primary/50" />
                <div>
                  <p className="text-2xl font-light">{value}</p>
                  <p className="text-xs text-muted-foreground">{label}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
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
      )}

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
                    <span className={`text-xs px-2 py-0.5 rounded-full capitalize ${TAP_TYPE_COLORS[tap.tap_type] ?? "bg-muted text-muted-foreground"}`}>
                      {TAP_TYPE_KEYS[tap.tap_type] ? t(TAP_TYPE_KEYS[tap.tap_type]) : tap.tap_type.replace(/_/g, " ")}
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
            <Button size="sm" onClick={handleSaveNotes} disabled={savingNotes} className="w-full">
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
