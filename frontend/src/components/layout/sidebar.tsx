"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { ROUTES } from "@/lib/constants";
import { LayoutDashboard, CalendarDays, Users, UserPlus, Wrench, Shield, Lock, Receipt, Headphones, Zap, Network, Star, GitFork, AlertTriangle, QrCode, Megaphone, Ticket, Wallet, UserCircle, ScanLine } from "lucide-react";
import { useSidebarStore } from "@/stores";
import { useAuthStore } from "@/stores";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetClose } from "@/components/ui";
import { useTranslate } from "@tolgee/react";

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const user = useAuthStore((s) => s.user);
  const { t } = useTranslate();
  const isAdmin = user && (user as { role?: string; is_superuser?: boolean }).role === "admin" ||
    (user as { is_superuser?: boolean } | null)?.is_superuser;
  const isPromoter = (user as { user_type?: string } | null)?.user_type === "promoter";
  const isStaffOnly = (user as { role?: string } | null)?.role === "staff" && !isAdmin;

  const staffNavigation = [
    { name: t("staff.scanQr"), href: ROUTES.STAFF_HOME, icon: ScanLine },
    { name: t("staff.registerGuest"), href: ROUTES.STAFF_REGISTER_GUEST, icon: UserPlus },
  ];

  const promoterNavigation = [
    { name: t("nav.promoterDashboard", { defaultValue: "Dashboard" }), href: ROUTES.PROMOTER_DASHBOARD, icon: Megaphone },
    { name: t("nav.promoCodes", { defaultValue: "Codes" }), href: ROUTES.PROMOTER_CODES, icon: Ticket },
    { name: t("nav.referrals", { defaultValue: "Referrals" }), href: ROUTES.PROMOTER_REFERRALS, icon: UserPlus },
    { name: t("nav.payouts", { defaultValue: "Payouts" }), href: ROUTES.PROMOTER_PAYOUTS, icon: Wallet },
    { name: t("nav.profile", { defaultValue: "Profile" }), href: ROUTES.PROFILE, icon: UserCircle },
  ];

  const memberNavigation = [
    { name: t("nav.dashboard"), href: ROUTES.DASHBOARD, icon: LayoutDashboard },
    { name: t("nav.events"), href: ROUTES.EVENTS, icon: CalendarDays },
    { name: t("nav.connections"), href: ROUTES.CONNECTIONS, icon: Users },
    { name: t("nav.services"), href: ROUTES.SERVICES, icon: Wrench },
    { name: t("nav.myLocker"), href: ROUTES.LOCKER, icon: Lock },
    { name: t("nav.myTab"), href: ROUTES.TAB, icon: Receipt },
    { name: t("nav.networking"), href: ROUTES.NETWORKING_REPORT, icon: Network },
    { name: t("nav.loyalty"), href: ROUTES.LOYALTY, icon: Star },
  ];

  const adminNavigation = [
    { name: t("nav.adminPanel"), href: ROUTES.ADMIN_ANALYTICS, icon: Shield },
    { name: t("nav.lockers"), href: ROUTES.ADMIN_LOCKERS, icon: Lock },
    { name: t("nav.tabs"), href: ROUTES.ADMIN_TABS, icon: Receipt },
    { name: t("nav.services"), href: ROUTES.ADMIN_SERVICES, icon: Headphones },
    { name: t("nav.activity"), href: ROUTES.ADMIN_ACTIVITY, icon: Zap },
    { name: t("nav.loyalty"), href: ROUTES.ADMIN_LOYALTY, icon: Star },
    { name: t("nav.smartMatching"), href: ROUTES.ADMIN_MATCHING, icon: GitFork },
    { name: t("nav.churnRisk"), href: ROUTES.ADMIN_CHURN, icon: AlertTriangle },
    { name: t("nav.qrGenerator"), href: ROUTES.ADMIN_QR_GENERATOR, icon: QrCode },
  ];

  type NavItem = { name: string; href: string; icon: React.ComponentType<{ className?: string }> };
  const renderLinks = (items: NavItem[]) =>
    items.map((item) => {
      const isActive = pathname === item.href ||
        (item.href !== ROUTES.DASHBOARD && pathname.startsWith(item.href + "/"));
      return (
        <Link
          key={item.href}
          href={item.href}
          onClick={onNavigate}
          className={cn(
            "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
            "min-h-[40px]",
            isActive
              ? "bg-secondary text-secondary-foreground"
              : "text-muted-foreground hover:bg-secondary/50 hover:text-secondary-foreground"
          )}
        >
          <item.icon className="h-4 w-4" />
          {item.name}
        </Link>
      );
    });

  return (
    <nav className="flex-1 p-3 space-y-0.5">
      {isStaffOnly ? (
        <>
          <p className="text-xs font-medium text-muted-foreground px-3 py-2 uppercase tracking-wider">{t("staff.title")}</p>
          {renderLinks(staffNavigation)}
        </>
      ) : isPromoter ? (
        <>
          <p className="text-xs font-medium text-muted-foreground px-3 py-2 uppercase tracking-wider">{t("nav.promoter", { defaultValue: "Promoter" })}</p>
          {renderLinks(promoterNavigation)}
        </>
      ) : (
        <>
          <p className="text-xs font-medium text-muted-foreground px-3 py-2 uppercase tracking-wider">{t("nav.member")}</p>
          {renderLinks(memberNavigation)}
        </>
      )}

      {isAdmin && (
        <>
          <p className="text-xs font-medium text-muted-foreground px-3 py-2 mt-4 uppercase tracking-wider">{t("nav.admin")}</p>
          {renderLinks(adminNavigation)}
        </>
      )}
    </nav>
  );
}

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const { t } = useTranslate();
  return (
    <div className="flex h-full flex-col">
      <div className="flex h-14 items-center border-b px-4">
        <Link
          href={ROUTES.HOME}
          className="flex items-center gap-2"
          onClick={onNavigate}
        >
          <span className="font-light tracking-widest uppercase text-sm">{t("nav.theRedDoor")}</span>
        </Link>
      </div>
      <NavLinks onNavigate={onNavigate} />
    </div>
  );
}

export function Sidebar() {
  const { isOpen, close } = useSidebarStore();
  const { t } = useTranslate();

  return (
    <>
      <aside className="hidden w-64 shrink-0 border-r bg-background md:block">
        <SidebarContent />
      </aside>

      <Sheet open={isOpen} onOpenChange={close}>
        <SheetContent side="left" className="w-72 p-0">
          <SheetHeader className="h-14 px-4">
            <SheetTitle>{t("nav.theRedDoor")}</SheetTitle>
            <SheetClose onClick={close} />
          </SheetHeader>
          <NavLinks onNavigate={close} />
        </SheetContent>
      </Sheet>
    </>
  );
}
