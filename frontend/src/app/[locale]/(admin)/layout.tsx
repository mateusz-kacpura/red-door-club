"use client";

import React, { useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Users, CalendarDays, LayoutGrid, ClipboardList, TrendingUp, LogOut,
  Lock, Receipt, Headphones, Zap, Star, Building2, Shield,
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { ROUTES } from "@/lib/constants";
import { useTranslate } from "@tolgee/react";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user, isAuthenticated, isLoading, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const { t } = useTranslate();

  const adminNav = [
    { name: t("nav.overview"), href: ROUTES.ADMIN_ANALYTICS, icon: TrendingUp },
    { name: t("nav.members"), href: ROUTES.ADMIN_MEMBERS, icon: Users },
    { name: t("nav.events"), href: ROUTES.ADMIN_EVENTS, icon: CalendarDays },
    { name: t("nav.floorView"), href: ROUTES.ADMIN_FLOOR, icon: LayoutGrid },
    { name: t("nav.checklist"), href: ROUTES.ADMIN_CHECKLIST, icon: ClipboardList },
    { name: t("nav.lockers"), href: ROUTES.ADMIN_LOCKERS, icon: Lock },
    { name: t("nav.tabs"), href: ROUTES.ADMIN_TABS, icon: Receipt },
    { name: t("nav.services"), href: ROUTES.ADMIN_SERVICES, icon: Headphones },
    { name: t("nav.activity"), href: ROUTES.ADMIN_ACTIVITY, icon: Zap },
    { name: t("nav.staffPerformance"), href: ROUTES.ADMIN_STAFF, icon: Shield },
    { name: t("nav.loyalty"), href: ROUTES.ADMIN_LOYALTY, icon: Star },
    { name: t("nav.promoters"), href: ROUTES.ADMIN_PROMOTERS, icon: Users },
    { name: t("nav.corporate"), href: ROUTES.ADMIN_CORPORATE, icon: Building2 },
  ];

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push(ROUTES.LOGIN);
    }
    if (!isLoading && user && user.role !== "admin" && !user.is_superuser) {
      router.push(ROUTES.DASHBOARD);
    }
  }, [isLoading, isAuthenticated, user, router]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-muted-foreground">{t("common.loading")}</div>
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Admin Sidebar */}
      <aside className="w-56 shrink-0 border-r bg-card flex flex-col">
        <div className="p-4 border-b">
          <p className="text-xs tracking-[0.2em] text-muted-foreground uppercase">{t("nav.s8lls")}</p>
          <p className="text-sm font-medium mt-0.5">{t("nav.adminPanel")}</p>
        </div>

        <nav className="flex-1 py-4 px-2 space-y-1 overflow-y-auto">
          {adminNav.map(({ name, href, icon: Icon }) => {
            const active = pathname === href || pathname.startsWith(href + "/");
            return (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors
                  ${active ? "bg-primary/10 text-primary font-medium" : "text-muted-foreground hover:bg-muted hover:text-foreground"}`}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {name}
              </Link>
            );
          })}
        </nav>

        <div className="p-3 border-t">
          <Link
            href={ROUTES.DASHBOARD}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition-colors mb-1"
          >
            ← {t("nav.memberDashboard")}
          </Link>
          <button
            onClick={logout}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition-colors w-full"
          >
            <LogOut className="h-3.5 w-3.5" />
            {t("auth.signOut")}
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto p-6">
        {children}
      </main>
    </div>
  );
}
