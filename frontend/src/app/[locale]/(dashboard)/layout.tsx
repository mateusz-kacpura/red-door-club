"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Header, Sidebar } from "@/components/layout";
import { useAuthStore } from "@/stores";
import { ROUTES } from "@/lib/constants";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = useAuthStore((s) => s.user);
  const router = useRouter();

  useEffect(() => {
    if (user && (user as { role?: string }).role === "staff" && !user.is_superuser) {
      router.replace(ROUTES.STAFF_HOME);
    }
  }, [user, router]);

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <Header />
        <main className="flex-1 overflow-auto p-3 sm:p-6">{children}</main>
      </div>
    </div>
  );
}
