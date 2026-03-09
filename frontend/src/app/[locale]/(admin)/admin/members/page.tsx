"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { apiClient } from "@/lib/api-client";
import type { ClubMember } from "@/types";
import { useTranslate } from "@tolgee/react";

const TIER_COLORS: Record<string, string> = {
  silver: "bg-slate-100 text-slate-600",
  gold: "bg-yellow-100 text-yellow-700",
  obsidian: "bg-zinc-800 text-zinc-100",
};

export default function AdminMembersPage() {
  const router = useRouter();
  const { t } = useTranslate();
  const [members, setMembers] = useState<ClubMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    apiClient.get<ClubMember[]>("/admin/members")
      .then(setMembers)
      .catch(() => {})
      .finally(() => setIsLoading(false));
  }, []);

  const filtered = members.filter((m) => {
    const q = search.toLowerCase();
    return (
      (m.full_name ?? "").toLowerCase().includes(q) ||
      m.email.toLowerCase().includes(q) ||
      (m.company_name ?? "").toLowerCase().includes(q)
    );
  });

  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-light tracking-wide">{t("members.title")}</h1>
          <p className="text-sm text-muted-foreground mt-1">{t("members.totalRegistered", { count: members.length })}</p>
        </div>
        <div className="relative w-56">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder={t("members.searchPlaceholder")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {isLoading && (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      )}

      {!isLoading && (
        <div className="rounded-xl border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">{t("members.colName")}</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground hidden md:table-cell">{t("members.colCompany")}</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground hidden lg:table-cell">{t("members.colType")}</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">{t("members.colTier")}</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground hidden xl:table-cell">{t("members.colSegments")}</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground hidden lg:table-cell">{t("members.colJoined")}</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((m) => (
                <tr
                  key={m.id}
                  className="border-b last:border-0 hover:bg-muted/30 transition-colors cursor-pointer"
                  onClick={() => router.push(`/admin/members/${m.id}`)}
                >
                  <td className="px-4 py-3">
                    <div>
                      <p className="font-medium">{m.full_name ?? "—"}</p>
                      <p className="text-xs text-muted-foreground">{m.email}</p>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">
                    {m.company_name ?? "—"}
                  </td>
                  <td className="px-4 py-3 hidden lg:table-cell">
                    <span className="text-xs bg-muted px-2 py-0.5 rounded-full capitalize">
                      {m.user_type}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {m.tier ? (
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${TIER_COLORS[m.tier] ?? "bg-muted"}`}>
                        {m.tier}
                      </span>
                    ) : (
                      <span className="text-muted-foreground text-xs">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 hidden xl:table-cell">
                    <div className="flex flex-wrap gap-1">
                      {m.segment_groups.slice(0, 2).map((seg) => (
                        <span key={seg} className="text-xs bg-muted px-1.5 py-0.5 rounded">{seg}</span>
                      ))}
                      {m.segment_groups.length > 2 && (
                        <span className="text-xs text-muted-foreground">+{m.segment_groups.length - 2}</span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground hidden lg:table-cell">
                    {formatDate(m.created_at)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {filtered.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              {t("members.noResults", { search })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
