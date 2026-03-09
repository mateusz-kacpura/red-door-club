"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Users, CalendarDays, LayoutGrid, ClipboardList, TrendingUp, LogOut,
  Lock, Receipt, Headphones, Zap, Star, Building2,
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { ROUTES } from "@/lib/constants";

const adminNav = [
  { name: "Overview", href: ROUTES.ADMIN_ANALYTICS, icon: TrendingUp },
  { name: "Members", href: ROUTES.ADMIN_MEMBERS, icon: Users },
  { name: "Events", href: ROUTES.ADMIN_EVENTS, icon: CalendarDays },
  { name: "Floor View", href: ROUTES.ADMIN_FLOOR, icon: LayoutGrid },
  { name: "Checklist", href: ROUTES.ADMIN_CHECKLIST, icon: ClipboardList },
  { name: "Lockers", href: ROUTES.ADMIN_LOCKERS, icon: Lock },
  { name: "Tabs", href: ROUTES.ADMIN_TABS, icon: Receipt },
  { name: "Services", href: ROUTES.ADMIN_SERVICES, icon: Headphones },
  { name: "Activity", href: ROUTES.ADMIN_ACTIVITY, icon: Zap },
  { name: "Loyalty", href: ROUTES.ADMIN_LOYALTY, icon: Star },
  { name: "Promoters", href: ROUTES.ADMIN_PROMOTERS, icon: Users },
  { name: "Corporate", href: ROUTES.ADMIN_CORPORATE, icon: Building2 },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user, isAuthenticated, isLoading, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

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
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Admin Sidebar */}
      <aside className="w-56 shrink-0 border-r bg-card flex flex-col">
        <div className="p-4 border-b">
          <p className="text-xs tracking-[0.2em] text-muted-foreground uppercase">The Red Door</p>
          <p className="text-sm font-medium mt-0.5">Admin Panel</p>
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
            ← Member Dashboard
          </Link>
          <button
            onClick={logout}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition-colors w-full"
          >
            <LogOut className="h-3.5 w-3.5" />
            Log out
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
