"use client";

import React, { useEffect } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";
import { ROUTES } from "@/lib/constants";
import { useTranslate } from "@tolgee/react";
import { LogOut, ScanLine, UserPlus, User } from "lucide-react";

export default function StaffLayout({ children }: { children: React.ReactNode }) {
  const { user, isAuthenticated, isLoading, logout } = useAuth();
  const router = useRouter();
  const { t } = useTranslate();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push(ROUTES.LOGIN);
    }
    if (
      !isLoading &&
      user &&
      user.role !== "staff" &&
      user.role !== "admin" &&
      !user.is_superuser
    ) {
      router.push(ROUTES.DASHBOARD);
    }
  }, [isLoading, isAuthenticated, user, router]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Minimal header for mobile */}
      <header className="border-b px-4 py-3 flex items-center justify-between">
        <div>
          <Image src="/icons/logo.svg" alt="S8LLS" width={80} height={28} className="dark:invert-0 invert" />
          <p className="text-sm font-medium">{t("staff.title")}</p>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => router.push(ROUTES.STAFF_HOME)}
            className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <ScanLine className="h-4 w-4" />
          </button>
          <button
            onClick={() => router.push(ROUTES.STAFF_REGISTER_GUEST)}
            className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <UserPlus className="h-4 w-4" />
          </button>
          <button
            onClick={() => router.push(ROUTES.STAFF_PROFILE)}
            className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <User className="h-4 w-4" />
          </button>
          <button
            onClick={logout}
            className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </header>

      <main className="p-4 max-w-lg mx-auto">{children}</main>
    </div>
  );
}
