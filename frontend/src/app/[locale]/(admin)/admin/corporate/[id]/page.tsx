"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Building2, Plus, Loader2, Trash2, Users } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiClient } from "@/lib/api-client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useTranslate } from "@tolgee/react";

interface CorporateMember {
  id: string;
  member_id: string;
  role: string;
  is_active: boolean;
  added_at: string;
  member_name: string | null;
  member_email: string | null;
}

interface CorporateDetail {
  id: string;
  company_name: string;
  billing_contact_name: string;
  billing_contact_email: string;
  billing_address: string;
  vat_number: string | null;
  package_type: string;
  max_seats: number;
  active_seats: number;
  annual_fee: number;
  renewal_date: string | null;
  status: string;
  created_at: string;
  members: CorporateMember[];
}

const statusColor: Record<string, string> = {
  active: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
  expired: "bg-yellow-500/10 text-yellow-600 border-yellow-500/20",
  suspended: "bg-rose-500/10 text-rose-600 border-rose-500/20",
};

export default function CorporateDetailPage() {
  const { t } = useTranslate();
  const { id } = useParams<{ id: string }>();
  const [account, setAccount] = useState<CorporateDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [newMemberEmail, setNewMemberEmail] = useState("");
  const [isAdding, setIsAdding] = useState(false);

  const fetchAccount = () => {
    apiClient.get<CorporateDetail>(`/admin/corporate/${id}`)
      .then(setAccount)
      .catch(() => {})
      .finally(() => setIsLoading(false));
  };

  useEffect(() => { fetchAccount(); }, [id]);

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMemberEmail.trim()) return;
    setIsAdding(true);
    try {
      await apiClient.post(`/admin/corporate/${id}/members`, { email: newMemberEmail.trim() });
      toast.success(t("corporateDetail.memberAdded"));
      setNewMemberEmail("");
      fetchAccount();
    } catch (err: unknown) {
      toast.error("Failed", { description: (err as { message?: string })?.message });
    } finally {
      setIsAdding(false);
    }
  };

  const handleStatusChange = async (newStatus: string) => {
    try {
      await apiClient.patch(`/admin/corporate/${id}`, { status: newStatus });
      toast.success(newStatus === "suspended" ? t("corporateDetail.suspended") : t("corporateDetail.reactivated"));
      fetchAccount();
    } catch (err: unknown) {
      toast.error("Failed", { description: (err as { message?: string })?.message });
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[300px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!account) {
    return <p className="text-muted-foreground">{t("corporateDetail.notFound")}</p>;
  }

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-light tracking-wide">{account.company_name}</h1>
          <p className="text-sm text-muted-foreground mt-1">{account.billing_contact_email}</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className={cn("text-sm capitalize", statusColor[account.status] ?? "")}>
            {account.status}
          </Badge>
          {account.status === "active" ? (
            <Button size="sm" variant="outline" className="text-xs h-7" onClick={() => handleStatusChange("suspended")}>
              {t("corporateDetail.suspend")}
            </Button>
          ) : (
            <Button size="sm" variant="outline" className="text-xs h-7" onClick={() => handleStatusChange("active")}>
              {t("corporateDetail.reactivate")}
            </Button>
          )}
        </div>
      </div>

      {/* Info cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        {[
          { labelKey: "corporateDetail.package", value: account.package_type.charAt(0).toUpperCase() + account.package_type.slice(1) },
          { labelKey: "corporateDetail.seatsUsed", value: `${account.active_seats} / ${account.max_seats}` },
          { labelKey: "corporateDetail.annualFee", value: `฿${Number(account.annual_fee).toLocaleString()}` },
        ].map(({ labelKey, value }) => (
          <Card key={labelKey} className="rounded-xl">
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground uppercase tracking-wide">{t(labelKey)}</p>
              <p className="text-xl font-light mt-1">{value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Billing info */}
      <Card className="rounded-xl">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">{t("corporateDetail.billingDetails")}</CardTitle>
        </CardHeader>
        <CardContent className="text-sm space-y-1 text-muted-foreground">
          <p><span className="text-foreground font-medium">{t("corporateDetail.contact")}:</span> {account.billing_contact_name}</p>
          {account.billing_address && (
            <p><span className="text-foreground font-medium">{t("corporateDetail.address")}:</span> {account.billing_address}</p>
          )}
          {account.vat_number && (
            <p><span className="text-foreground font-medium">{t("corporateDetail.vat")}:</span> {account.vat_number}</p>
          )}
          {account.renewal_date && (
            <p><span className="text-foreground font-medium">{t("corporateDetail.renewal")}:</span> {new Date(account.renewal_date).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}</p>
          )}
        </CardContent>
      </Card>

      {/* Members */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium uppercase tracking-wider text-muted-foreground flex items-center gap-2">
            <Users className="h-4 w-4 text-primary" />
            {t("corporateDetail.membersCount", { count: account.members.length })}
          </h2>
        </div>

        {/* Add member form */}
        <form onSubmit={handleAddMember} className="flex gap-2">
          <Input
            type="email"
            placeholder={t("corporateDetail.emailPlaceholder")}
            value={newMemberEmail}
            onChange={(e) => setNewMemberEmail(e.target.value)}
            className="flex-1"
          />
          <Button type="submit" size="sm" disabled={isAdding || account.active_seats >= account.max_seats}>
            {isAdding ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Plus className="h-4 w-4 mr-1" />{t("corporateDetail.add")}</>}
          </Button>
        </form>

        {account.members.length === 0 ? (
          <Card className="rounded-xl border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-8 text-center gap-2">
              <Users className="h-8 w-8 text-muted-foreground/30" />
              <p className="text-sm text-muted-foreground">{t("corporateDetail.noMembers")}</p>
            </CardContent>
          </Card>
        ) : (
          <Card className="rounded-xl">
            <CardContent className="p-0 divide-y divide-border">
              {account.members.map((m) => (
                <div key={m.id} className="flex items-center justify-between px-4 py-3 text-sm">
                  <div>
                    <p className="font-medium">{m.member_name ?? "Unknown"}</p>
                    <p className="text-xs text-muted-foreground">{m.member_email}</p>
                  </div>
                  <Badge variant="outline" className="text-xs capitalize">{m.role}</Badge>
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
