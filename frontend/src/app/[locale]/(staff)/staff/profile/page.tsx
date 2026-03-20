"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks";
import { Button, Card, Input, Label } from "@/components/ui";
import { ThemeToggle } from "@/components/theme";
import {
  User as UserIcon,
  Mail,
  Calendar,
  Phone,
  Building2,
  Briefcase,
  Loader2,
  Settings,
  ArrowLeft,
} from "lucide-react";
import { useTranslate } from "@tolgee/react";
import { apiClient } from "@/lib/api-client";
import type { User } from "@/types";

export default function StaffProfilePage() {
  const { user, isAuthenticated, isLoading } = useAuth();
  const router = useRouter();
  const { t } = useTranslate();
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [memberData, setMemberData] = useState<User | null>(null);

  const [form, setForm] = useState({
    full_name: "",
    phone: "",
    company_name: "",
    industry: "",
  });

  useEffect(() => {
    if (!isAuthenticated) return;
    apiClient
      .get<User>("/members/me")
      .then((data) => setMemberData(data))
      .catch(() => {});
  }, [isAuthenticated]);

  const startEditing = () => {
    const source = memberData ?? user;
    setForm({
      full_name: source?.full_name ?? "",
      phone: source?.phone ?? "",
      company_name: source?.company_name ?? "",
      industry: source?.industry ?? "",
    });
    setIsEditing(true);
  };

  const cancelEditing = () => setIsEditing(false);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const updated = await apiClient.patch<User>("/members/me", {
        full_name: form.full_name || null,
        phone: form.phone || null,
        company_name: form.company_name || null,
        industry: form.industry || null,
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

  if (!isAuthenticated || !user) return null;

  const displayData = memberData ?? user;

  return (
    <div className="space-y-4">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => router.back()}
        className="gap-1 -ml-2"
      >
        <ArrowLeft className="h-4 w-4" />
        {t("common.back")}
      </Button>

      {/* Header */}
      <Card className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 shrink-0">
              <UserIcon className="h-6 w-6 text-primary" />
            </div>
            <div className="min-w-0">
              <h2 className="text-lg font-semibold truncate">
                {displayData.full_name || displayData.email}
              </h2>
              <p className="text-sm text-muted-foreground truncate">{displayData.email}</p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={isEditing ? cancelEditing : startEditing}
            className="shrink-0 h-10"
          >
            <Settings className="mr-2 h-4 w-4" />
            {isEditing ? t("common.cancel") : t("common.edit")}
          </Button>
        </div>
      </Card>

      {/* Profile Information */}
      <Card className="p-4">
        <h3 className="mb-4 text-base font-semibold">{t("profile.accountInformation")}</h3>
        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="full_name" className="flex items-center gap-2 text-sm">
              <UserIcon className="h-4 w-4 text-muted-foreground" />
              {t("profile.fullName")}
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
              {t("profile.phone")}
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
              {t("profile.company")}
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
              {t("profile.industry")}
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
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Calendar className="h-4 w-4 shrink-0" />
              <span>{t("profile.memberSince", { date: new Date(user.created_at).toLocaleDateString() })}</span>
            </div>
          )}
        </div>
      </Card>

      {/* Save / Cancel */}
      {isEditing && (
        <div className="flex justify-end gap-2">
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
      <Card className="p-4">
        <h3 className="mb-4 text-base font-semibold">{t("profile.preferences")}</h3>
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="font-medium text-sm">{t("profile.theme")}</p>
            <p className="text-xs text-muted-foreground">{t("profile.themeDesc")}</p>
          </div>
          <ThemeToggle variant="dropdown" />
        </div>
      </Card>
    </div>
  );
}
