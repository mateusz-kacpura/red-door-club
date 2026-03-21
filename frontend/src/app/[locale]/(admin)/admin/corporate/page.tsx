"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Building2, Plus, Loader2, Users } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiClient } from "@/lib/api-client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { ROUTES } from "@/lib/constants";
import { useTranslate } from "@tolgee/react";

interface CorporateAccount {
  id: string;
  company_name: string;
  billing_contact_name: string;
  billing_contact_email: string;
  package_type: string;
  max_seats: number;
  active_seats: number;
  annual_fee: number;
  renewal_date: string | null;
  status: string;
  created_at: string;
}

const statusColor: Record<string, string> = {
  active: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
  expired: "bg-yellow-500/10 text-yellow-600 border-yellow-500/20",
  suspended: "bg-rose-500/10 text-rose-600 border-rose-500/20",
};

const CORPORATE_STATUS_KEYS: Record<string, string> = {
  active: "corporate.statusActive",
  expired: "corporate.statusExpired",
  suspended: "corporate.statusSuspended",
};

const packageColor: Record<string, string> = {
  starter: "text-slate-500",
  business: "text-blue-500",
  enterprise: "text-primary",
};

export default function AdminCorporatePage() {
  const { t } = useTranslate();
  const [accounts, setAccounts] = useState<CorporateAccount[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [form, setForm] = useState({
    company_name: "",
    billing_contact_name: "",
    billing_contact_email: "",
    package_type: "starter",
    annual_fee: "",
  });

  const fetchAccounts = () => {
    apiClient.get<CorporateAccount[]>("/admin/corporate")
      .then(setAccounts)
      .catch(() => {})
      .finally(() => setIsLoading(false));
  };

  useEffect(() => { fetchAccounts(); }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsCreating(true);
    try {
      await apiClient.post("/admin/corporate", {
        ...form,
        annual_fee: parseFloat(form.annual_fee) || 0,
      });
      toast.success(t("corporate.created"));
      setShowForm(false);
      setForm({ company_name: "", billing_contact_name: "", billing_contact_email: "", package_type: "starter", annual_fee: "" });
      fetchAccounts();
    } catch (err: unknown) {
      toast.error(t("corporate.createFailed"), { description: (err as { message?: string })?.message });
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-light tracking-wide">{t("corporate.title")}</h1>
          <p className="text-sm text-muted-foreground mt-1">{t("corporate.managementSubtitle")}</p>
        </div>
        <Button onClick={() => setShowForm((v) => !v)} size="sm">
          <Plus className="h-4 w-4 mr-1" />
          {t("corporate.newAccount")}
        </Button>
      </div>

      {showForm && (
        <Card className="rounded-xl border-primary/30">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">{t("corporate.createAccount")}</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreate} className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label className="text-xs text-muted-foreground uppercase tracking-wide">{t("corporate.companyName")}</label>
                <Input
                  value={form.company_name}
                  onChange={(e) => setForm((f) => ({ ...f, company_name: e.target.value }))}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs text-muted-foreground uppercase tracking-wide">{t("corporate.contactName")}</label>
                <Input
                  value={form.billing_contact_name}
                  onChange={(e) => setForm((f) => ({ ...f, billing_contact_name: e.target.value }))}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs text-muted-foreground uppercase tracking-wide">{t("corporate.contactEmail")}</label>
                <Input
                  type="email"
                  value={form.billing_contact_email}
                  onChange={(e) => setForm((f) => ({ ...f, billing_contact_email: e.target.value }))}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs text-muted-foreground uppercase tracking-wide">{t("corporate.packageLabel")}</label>
                <select
                  className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                  value={form.package_type}
                  onChange={(e) => setForm((f) => ({ ...f, package_type: e.target.value }))}
                >
                  <option value="starter">{t("corporate.starterPackage")}</option>
                  <option value="business">{t("corporate.businessPackage")}</option>
                  <option value="enterprise">{t("corporate.enterprisePackage")}</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs text-muted-foreground uppercase tracking-wide">{t("corporate.annualFeeLabel")}</label>
                <Input
                  type="number"
                  min={0}
                  value={form.annual_fee}
                  onChange={(e) => setForm((f) => ({ ...f, annual_fee: e.target.value }))}
                />
              </div>
              <div className="flex items-end gap-2">
                <Button type="submit" disabled={isCreating} className="flex-1">
                  {isCreating ? <Loader2 className="h-4 w-4 animate-spin" /> : t("corporate.create")}
                </Button>
                <Button type="button" variant="outline" onClick={() => setShowForm(false)}>{t("common.cancel")}</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : accounts.length === 0 ? (
        <Card className="rounded-xl border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center gap-2">
            <Building2 className="h-8 w-8 text-muted-foreground/30" />
            <p className="text-sm text-muted-foreground">{t("corporate.noAccounts")}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {accounts.map((a) => (
            <Link key={a.id} href={`${ROUTES.ADMIN_CORPORATE}/${a.id}`}>
              <Card className="rounded-xl hover:bg-muted/20 transition-colors cursor-pointer">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-medium truncate">{a.company_name}</p>
                        <Badge
                          variant="outline"
                          className={cn("text-xs capitalize shrink-0", packageColor[a.package_type] ?? "")}
                        >
                          {a.package_type}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">{a.billing_contact_email}</p>
                    </div>
                    <div className="text-right shrink-0 space-y-1">
                      <Badge
                        variant="outline"
                        className={cn("text-xs capitalize", statusColor[a.status] ?? "")}
                      >
                        {CORPORATE_STATUS_KEYS[a.status] ? t(CORPORATE_STATUS_KEYS[a.status]) : a.status}
                      </Badge>
                      <div className="flex items-center gap-1 justify-end text-xs text-muted-foreground">
                        <Users className="h-3 w-3" />
                        {a.active_seats}/{a.max_seats}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
