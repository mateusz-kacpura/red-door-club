"use client";

import { useState } from "react";
import Link from "next/link";
import { useAuth } from "@/hooks";
import { Button, Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui";
import { ThemeToggle } from "@/components/theme";
import { ROUTES } from "@/lib/constants";
import { LogOut, User, Menu, QrCode } from "lucide-react";
import { useSidebarStore } from "@/stores";
import { useTranslate } from "@tolgee/react";
import { LanguageSwitcher } from "./language-switcher";
import QRCode from "react-qr-code";

export function Header() {
  const { user, isAuthenticated, logout } = useAuth();
  const { toggle } = useSidebarStore();
  const { t } = useTranslate();
  const [qrOpen, setQrOpen] = useState(false);
  const isMember = isAuthenticated && !user?.is_promoter;

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
                {isMember && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-10 w-10 p-0"
                  onClick={() => setQrOpen(true)}
                >
                  <QrCode className="h-4 w-4" />
                  <span className="sr-only">{t("profile.memberQr")}</span>
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

      {/* Member QR Sheet — outside header to avoid backdrop-filter containing block */}
      {isMember && user?.id && (
        <Sheet open={qrOpen} onOpenChange={setQrOpen}>
          <SheetContent side="bottom" className="rounded-t-2xl">
            <SheetHeader className="justify-center border-b-0 pb-0">
              <SheetTitle>{t("profile.memberQr")}</SheetTitle>
            </SheetHeader>
            <div className="flex flex-col items-center gap-4 px-4 pb-8 pt-4">
              <div className="bg-white p-4 rounded-xl">
                <QRCode
                  value={`${typeof window !== "undefined" ? window.location.origin : ""}/m/${user.id}`}
                  size={220}
                />
              </div>
              <p className="text-sm text-muted-foreground text-center">
                {t("profile.memberQrHint")}
              </p>
            </div>
          </SheetContent>
        </Sheet>
      )}
    </>
  );
}
