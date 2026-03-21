"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useAuth } from "@/hooks";
import { Button } from "@/components/ui";
import { ThemeToggle } from "@/components/theme";
import { ROUTES } from "@/lib/constants";
import { LogOut, User, Menu, QrCode, X } from "lucide-react";
import { useSidebarStore } from "@/stores";
import { useTranslate } from "@tolgee/react";
import { LanguageSwitcher } from "./language-switcher";
import { apiClient } from "@/lib/api-client";
import QRCode from "react-qr-code";

export function Header() {
  const { user, isAuthenticated, logout } = useAuth();
  const { toggle } = useSidebarStore();
  const { t } = useTranslate();
  const [qrOpen, setQrOpen] = useState(false);
  const isMember = isAuthenticated && !user?.is_promoter;
  const isPromoter = isAuthenticated && !!user?.is_promoter;
  const [promoCode, setPromoCode] = useState<string | null>(null);

  useEffect(() => {
    if (!isPromoter) return;
    apiClient
      .get<{ code: string }[]>("/promoters/codes")
      .then((codes) => {
        if (codes.length > 0) setPromoCode(codes[0].code);
      })
      .catch(() => {});
  }, [isPromoter]);

  return (
    <>
      <header className="sticky top-0 z-40 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="flex h-14 items-center justify-between px-3 sm:px-6">
          <Button
            variant="ghost"
            size="sm"
            className="h-10 w-10 p-0 md:hidden"
            onClick={toggle}
          >
            <Menu className="h-5 w-5" />
            <span className="sr-only">Toggle menu</span>
          </Button>

          <div className="hidden md:block" />

          <div className="flex items-center gap-2 sm:gap-3">
            <LanguageSwitcher />
            <ThemeToggle />
            {isAuthenticated ? (
              <>
                {(isMember || isPromoter) && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-10 w-10 p-0"
                  onClick={() => setQrOpen(true)}
                >
                  <QrCode className="h-4 w-4" />
                  <span className="sr-only">
                    {isPromoter ? t("promoter.inviteQr") : t("profile.memberQr")}
                  </span>
                </Button>
                )}
                <Button variant="ghost" size="sm" asChild className="h-10 px-2 sm:px-3">
                  <Link href={ROUTES.PROFILE} className="flex items-center gap-2">
                    <User className="h-4 w-4" />
                    <span className="hidden max-w-32 truncate sm:inline">{user?.email}</span>
                  </Link>
                </Button>
                <Button variant="ghost" size="sm" onClick={logout} className="h-10 w-10 p-0 sm:w-auto sm:px-3">
                  <LogOut className="h-4 w-4" />
                  <span className="sr-only sm:not-sr-only sm:ml-2">{t("common.logout")}</span>
                </Button>
              </>
            ) : (
              <>
                <Button variant="ghost" size="sm" asChild className="h-10">
                  <Link href={ROUTES.LOGIN}>{t("common.login")}</Link>
                </Button>
                <Button size="sm" asChild className="h-10">
                  <Link href={ROUTES.REGISTER}>{t("common.register")}</Link>
                </Button>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Fullscreen Member QR overlay */}
      {isMember && user?.id && qrOpen && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-background">
          <button
            onClick={() => setQrOpen(false)}
            className="absolute top-4 right-4 h-10 w-10 flex items-center justify-center rounded-full hover:bg-muted transition-colors"
          >
            <X className="h-6 w-6" />
            <span className="sr-only">{t("common.close")}</span>
          </button>
          <h2 className="text-lg font-semibold mb-6">{t("profile.memberQr")}</h2>
          <div className="bg-white p-6 rounded-2xl">
            <QRCode
              value={`${typeof window !== "undefined" ? window.location.origin : ""}/m/${user.id}`}
              size={280}
            />
          </div>
          <p className="text-sm text-muted-foreground text-center mt-6 px-8">
            {t("profile.memberQrHint")}
          </p>
        </div>
      )}

      {/* Fullscreen Promoter Invite QR overlay */}
      {isPromoter && qrOpen && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-background">
          <button
            onClick={() => setQrOpen(false)}
            className="absolute top-4 right-4 h-10 w-10 flex items-center justify-center rounded-full hover:bg-muted transition-colors"
          >
            <X className="h-6 w-6" />
            <span className="sr-only">{t("common.close")}</span>
          </button>
          <h2 className="text-lg font-semibold mb-6">{t("promoter.inviteQr")}</h2>
          {promoCode ? (
            <>
              <div className="bg-white p-6 rounded-2xl">
                <QRCode
                  value={`${typeof window !== "undefined" ? window.location.origin : ""}/qr-register?promo=${promoCode}`}
                  size={280}
                />
              </div>
              <p className="text-base font-mono font-semibold mt-4">{promoCode}</p>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">{t("promoterCodes.noCodes")}</p>
          )}
          <p className="text-sm text-muted-foreground text-center mt-4 px-8">
            {t("promoter.inviteQrHint")}
          </p>
        </div>
      )}
    </>
  );
}
