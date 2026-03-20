"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/hooks";
import { Button, Card, Input, Label, Badge } from "@/components/ui";
import { ThemeToggle } from "@/components/theme";
import {
  User as UserIcon,
  Mail,
  Calendar,
  Shield,
  Settings,
  CreditCard,
  Phone,
  Building2,
  Briefcase,
  Sparkles,
  Loader2,
  QrCode,
} from "lucide-react";
import { useTranslate } from "@tolgee/react";
import QRCode from "react-qr-code";
import { apiClient } from "@/lib/api-client";
import type { User } from "@/types";

const INTEREST_OPTIONS = [
  "Real Estate",
  "Finance",
  "Tech",
  "Networking",
  "Lifestyle",
  "Events",
  "Partnerships",
];

export default function ProfilePage() {
  const { user, isAuthenticated, isLoading, logout } = useAuth();
  const { t } = useTranslate();
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [nfcCards, setNfcCards] = useState<{ card_id: string; status: string }[]>([]);
  const [memberData, setMemberData] = useState<User | null>(null);

  const [form, setForm] = useState({
    full_name: "",
    phone: "",
    company_name: "",
    industry: "",
    interests: [] as string[],
  });

  useEffect(() => {
    if (!isAuthenticated) return;
    apiClient
      .get<User & { nfc_cards?: { card_id: string; status: string }[] }>("/members/me")
      .then((data) => {
        setNfcCards(data.nfc_cards ?? []);
        setMemberData(data);
      })
      .catch(() => {});
  }, [isAuthenticated]);

  const startEditing = () => {
    const source = memberData ?? user;
    setForm({
      full_name: source?.full_name ?? "",
      phone: source?.phone ?? "",
      company_name: source?.company_name ?? "",
      industry: source?.industry ?? "",
      interests: source?.interests ?? [],
    });
    setIsEditing(true);
  };

  const cancelEditing = () => {
    setIsEditing(false);
  };

  const toggleInterest = (interest: string) => {
    setForm((prev) => ({
      ...prev,
      interests: prev.interests.includes(interest)
        ? prev.interests.filter((i) => i !== interest)
        : [...prev.interests, interest],
    }));
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const updated = await apiClient.patch<User>("/members/me", {
        full_name: form.full_name || null,
        phone: form.phone || null,
        company_name: form.company_name || null,
        industry: form.industry || null,
        interests: form.interests,
      });
      setMemberData((prev) => (prev ? { ...prev, ...updated } : updated));
      setIsEditing(false);
    } catch {
      // TODO: show error toast
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Card className="p-6 sm:p-8 text-center mx-4">
          <p className="text-muted-foreground">{t("auth.pleaseLogin")}</p>
        </Card>
      </div>
    );
  }

  const displayData = memberData ?? user;

  return (
    <div className="container mx-auto max-w-4xl">
      <div className="mb-6 sm:mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">{t("profile.title")}</h1>
        <p className="text-sm sm:text-base text-muted-foreground">
          {t("profile.subtitle")}
        </p>
      </div>

      <div className="grid gap-4 sm:gap-6">
        {/* Header */}
        <Card className="p-4 sm:p-6">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
            <div className="flex items-center gap-3 sm:gap-4">
              <div className="flex h-12 w-12 sm:h-16 sm:w-16 items-center justify-center rounded-full bg-primary/10 shrink-0">
                <UserIcon className="h-6 w-6 sm:h-8 sm:w-8 text-primary" />
              </div>
              <div className="min-w-0">
                <h2 className="text-lg sm:text-xl font-semibold truncate">
                  {displayData.full_name || displayData.email}
                </h2>
                <p className="text-sm text-muted-foreground truncate">{displayData.email}</p>
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  {user.is_superuser && (
                    <Badge variant="secondary">
                      <Shield className="mr-1 h-3 w-3" />
                      {t("profile.admin")}
                    </Badge>
                  )}
                  {displayData.tier && (
                    <Badge variant="outline" className="capitalize">
                      {displayData.tier}
                    </Badge>
                  )}
                  {user.is_active && (
                    <Badge variant="outline" className="text-green-600">
                      {t("profile.active")}
                    </Badge>
                  )}
                </div>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={isEditing ? cancelEditing : startEditing}
              className="self-start h-10"
            >
              <Settings className="mr-2 h-4 w-4" />
              {isEditing ? t("common.cancel") : t("common.edit")}
            </Button>
          </div>
        </Card>

        {/* Profile Information */}
        <Card className="p-4 sm:p-6">
          <h3 className="mb-4 text-base sm:text-lg font-semibold">{t("profile.accountInformation")}</h3>
          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="full_name" className="flex items-center gap-2 text-sm">
                <UserIcon className="h-4 w-4 text-muted-foreground" />
                {t("profile.fullName", { defaultValue: "Full Name" })}
              </Label>
              {isEditing ? (
                <Input
                  id="full_name"
                  value={form.full_name}
                  onChange={(e) => setForm((f) => ({ ...f, full_name: e.target.value }))}
                  placeholder="John Doe"
                />
              ) : (
                <p className="text-sm px-3 py-2 bg-muted rounded-md">{displayData.full_name || "—"}</p>
              )}
            </div>

            <div className="grid gap-2">
              <Label htmlFor="email" className="flex items-center gap-2 text-sm">
                <Mail className="h-4 w-4 text-muted-foreground" />
                {t("profile.emailAddress")}
              </Label>
              <p className="text-sm px-3 py-2 bg-muted rounded-md">{displayData.email}</p>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="phone" className="flex items-center gap-2 text-sm">
                <Phone className="h-4 w-4 text-muted-foreground" />
                {t("profile.phone", { defaultValue: "Phone" })}
              </Label>
              {isEditing ? (
                <Input
                  id="phone"
                  value={form.phone}
                  onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                  placeholder="+66 812 345 678"
                />
              ) : (
                <p className="text-sm px-3 py-2 bg-muted rounded-md">{displayData.phone || "—"}</p>
              )}
            </div>

            <div className="grid gap-2">
              <Label htmlFor="company_name" className="flex items-center gap-2 text-sm">
                <Building2 className="h-4 w-4 text-muted-foreground" />
                {t("profile.company", { defaultValue: "Company" })}
              </Label>
              {isEditing ? (
                <Input
                  id="company_name"
                  value={form.company_name}
                  onChange={(e) => setForm((f) => ({ ...f, company_name: e.target.value }))}
                  placeholder="Acme Corp"
                />
              ) : (
                <p className="text-sm px-3 py-2 bg-muted rounded-md">{displayData.company_name || "—"}</p>
              )}
            </div>

            <div className="grid gap-2">
              <Label htmlFor="industry" className="flex items-center gap-2 text-sm">
                <Briefcase className="h-4 w-4 text-muted-foreground" />
                {t("profile.industry", { defaultValue: "Industry" })}
              </Label>
              {isEditing ? (
                <Input
                  id="industry"
                  value={form.industry}
                  onChange={(e) => setForm((f) => ({ ...f, industry: e.target.value }))}
                  placeholder="Technology"
                />
              ) : (
                <p className="text-sm px-3 py-2 bg-muted rounded-md">{displayData.industry || "—"}</p>
              )}
            </div>

            {user.created_at && (
              <div className="flex items-center gap-2 text-xs sm:text-sm text-muted-foreground">
                <Calendar className="h-4 w-4 shrink-0" />
                <span>{t("profile.memberSince", { date: new Date(user.created_at).toLocaleDateString() })}</span>
              </div>
            )}
          </div>
        </Card>

        {/* Interests */}
        <Card className="p-4 sm:p-6">
          <h3 className="mb-4 text-base sm:text-lg font-semibold flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            {t("profile.interests", { defaultValue: "Interests" })}
          </h3>
          {isEditing ? (
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">
                {t("profile.interestsHint", { defaultValue: "Select all that apply" })}
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {INTEREST_OPTIONS.map((interest) => (
                  <button
                    key={interest}
                    type="button"
                    onClick={() => toggleInterest(interest)}
                    className={`px-3 py-2 rounded-lg border text-sm font-medium transition-colors text-left
                      ${form.interests.includes(interest)
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border hover:border-primary/50"
                      }`}
                  >
                    {interest}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {displayData.interests && displayData.interests.length > 0 ? (
                displayData.interests.map((interest) => (
                  <Badge key={interest} variant="secondary">{interest}</Badge>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">
                  {t("profile.noInterests", { defaultValue: "No interests selected yet" })}
                </p>
              )}
            </div>
          )}
        </Card>

        {/* Save / Cancel */}
        {isEditing && (
          <div className="flex flex-col sm:flex-row justify-end gap-2">
            <Button variant="outline" onClick={cancelEditing} className="h-10">
              {t("common.cancel")}
            </Button>
            <Button onClick={handleSave} disabled={isSaving} className="h-10">
              {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t("profile.saveChanges")}
            </Button>
          </div>
        )}

        {/* Preferences */}
        <Card className="p-4 sm:p-6">
          <h3 className="mb-4 text-base sm:text-lg font-semibold">{t("profile.preferences")}</h3>
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              <p className="font-medium text-sm sm:text-base">{t("profile.theme")}</p>
              <p className="text-xs sm:text-sm text-muted-foreground">
                {t("profile.themeDesc")}
              </p>
            </div>
            <ThemeToggle variant="dropdown" />
          </div>
        </Card>

        {/* Member QR — unified for entry + connections */}
        {user?.id && (
          <Card className="p-4 sm:p-6">
            <h3 className="mb-4 text-base sm:text-lg font-semibold flex items-center gap-2">
              <QrCode className="h-5 w-5 text-primary" />
              {t("profile.memberQr")}
            </h3>
            <div className="flex flex-col sm:flex-row gap-6 items-start">
              <div className="bg-white p-3 rounded-xl border border-border shrink-0">
                <QRCode
                  value={`${typeof window !== "undefined" ? window.location.origin : ""}/m/${user.id}`}
                  size={160}
                />
              </div>
              <div className="space-y-3 text-sm">
                {displayData.tier && (
                  <span className={`inline-block text-sm px-3 py-1 rounded-full font-semibold capitalize ${
                    displayData.tier === "vip" ? "bg-red-100 text-red-700" :
                    displayData.tier === "platinum" ? "bg-purple-100 text-purple-700" :
                    displayData.tier === "gold" ? "bg-amber-100 text-amber-700" :
                    "bg-slate-100 text-slate-700"
                  }`}>
                    {displayData.tier}
                  </span>
                )}
                <p className="text-muted-foreground">{t("profile.memberQrHint")}</p>
              </div>
            </div>
          </Card>
        )}

        {/* NFC Card */}
        {nfcCards.length > 0 && (
          <Card className="p-4 sm:p-6">
            <h3 className="mb-4 text-base sm:text-lg font-semibold flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-primary" />
              {t("profile.nfcCard")}
            </h3>
            <div className="flex flex-col sm:flex-row gap-6 items-start">
              <div className="bg-white p-3 rounded-xl border border-border shrink-0">
                <QRCode
                  value={`${typeof window !== "undefined" ? window.location.origin : ""}/tap?cid=${nfcCards[0].card_id}`}
                  size={140}
                />
              </div>
              <div className="space-y-2 text-sm">
                {nfcCards.map((card) => (
                  <div key={card.card_id} className="flex items-center gap-2">
                    <span className="font-mono text-xs bg-muted px-2 py-1 rounded">{card.card_id}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full capitalize ${card.status === "active" ? "bg-green-100 text-green-700" : "bg-muted text-muted-foreground"}`}>
                      {card.status}
                    </span>
                  </div>
                ))}
                <p className="text-xs text-muted-foreground pt-1">{t("profile.nfcCardHint")}</p>
              </div>
            </div>
          </Card>
        )}

        {/* Danger Zone */}
        <Card className="border-destructive/50 p-4 sm:p-6">
          <h3 className="mb-4 text-base sm:text-lg font-semibold text-destructive">
            {t("profile.dangerZone")}
          </h3>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <p className="font-medium text-sm sm:text-base">{t("profile.signOut")}</p>
              <p className="text-xs sm:text-sm text-muted-foreground">
                {t("profile.signOutDesc")}
              </p>
            </div>
            <Button variant="destructive" onClick={logout} className="h-10 self-start sm:self-auto">
              {t("profile.signOut")}
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
}
