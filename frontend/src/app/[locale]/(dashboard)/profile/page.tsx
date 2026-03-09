"use client";

import { useState } from "react";
import { useAuth } from "@/hooks";
import { Button, Card, Input, Label, Badge } from "@/components/ui";
import { ThemeToggle } from "@/components/theme";
import { User, Mail, Calendar, Shield, Settings } from "lucide-react";
import { useTranslate } from "@tolgee/react";

export default function ProfilePage() {
  const { user, isAuthenticated, isLoading, logout } = useAuth();
  const { t } = useTranslate();
  const [isEditing, setIsEditing] = useState(false);

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

  return (
    <div className="container mx-auto max-w-4xl">
      <div className="mb-6 sm:mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">{t("profile.title")}</h1>
        <p className="text-sm sm:text-base text-muted-foreground">
          {t("profile.subtitle")}
        </p>
      </div>

      <div className="grid gap-4 sm:gap-6">
        <Card className="p-4 sm:p-6">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
            <div className="flex items-center gap-3 sm:gap-4">
              <div className="flex h-12 w-12 sm:h-16 sm:w-16 items-center justify-center rounded-full bg-primary/10 shrink-0">
                <User className="h-6 w-6 sm:h-8 sm:w-8 text-primary" />
              </div>
              <div className="min-w-0">
                <h2 className="text-lg sm:text-xl font-semibold truncate">{user.email}</h2>
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  {user.is_superuser && (
                    <Badge variant="secondary">
                      <Shield className="mr-1 h-3 w-3" />
                      {t("profile.admin")}
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
              onClick={() => setIsEditing(!isEditing)}
              className="self-start h-10"
            >
              <Settings className="mr-2 h-4 w-4" />
              {isEditing ? t("common.cancel") : t("common.edit")}
            </Button>
          </div>
        </Card>

        <Card className="p-4 sm:p-6">
          <h3 className="mb-4 text-base sm:text-lg font-semibold">{t("profile.accountInformation")}</h3>
          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="email" className="flex items-center gap-2 text-sm">
                <Mail className="h-4 w-4 text-muted-foreground" />
                {t("profile.emailAddress")}
              </Label>
              <Input
                id="email"
                type="email"
                value={user.email}
                disabled={!isEditing}
                className={!isEditing ? "bg-muted" : ""}
              />
            </div>

            {user.created_at && (
              <div className="flex items-center gap-2 text-xs sm:text-sm text-muted-foreground">
                <Calendar className="h-4 w-4 shrink-0" />
                <span>{t("profile.memberSince", { date: new Date(user.created_at).toLocaleDateString() })}</span>
              </div>
            )}
          </div>

          {isEditing && (
            <div className="mt-4 flex flex-col sm:flex-row justify-end gap-2">
              <Button variant="outline" onClick={() => setIsEditing(false)} className="h-10">
                {t("common.cancel")}
              </Button>
              <Button className="h-10">{t("profile.saveChanges")}</Button>
            </div>
          )}
        </Card>

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
