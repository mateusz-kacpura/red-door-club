"use client";

import { useEffect, useState } from "react";
import { Wallet, Plus, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiClient } from "@/lib/api-client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface PayoutRequest {
  id: string;
  amount: number;
  status: string;
  notes: string | null;
  created_at: string;
  processed_at: string | null;
}

const statusColor: Record<string, string> = {
  pending: "bg-yellow-500/10 text-yellow-600 border-yellow-500/20",
  approved: "bg-blue-500/10 text-blue-600 border-blue-500/20",
  paid: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
};

export default function PromoterPayoutsPage() {
  const [payouts, setPayouts] = useState<PayoutRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [amount, setAmount] = useState("");
  const [isRequesting, setIsRequesting] = useState(false);
  const [showForm, setShowForm] = useState(false);

  const fetchPayouts = () => {
    apiClient.get<PayoutRequest[]>("/promoters/payouts")
      .then(setPayouts)
      .catch(() => {})
      .finally(() => setIsLoading(false));
  };

  useEffect(() => { fetchPayouts(); }, []);

  const handleRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(amount);
    if (isNaN(amt) || amt <= 0) {
      toast.error("Invalid amount");
      return;
    }
    setIsRequesting(true);
    try {
      await apiClient.post("/promoters/payouts", { amount: amt });
      toast.success("Payout requested", { description: `฿${amt.toLocaleString()} request submitted.` });
      setAmount("");
      setShowForm(false);
      fetchPayouts();
    } catch (err: unknown) {
      toast.error("Failed", { description: (err as { message?: string })?.message ?? "Could not submit request." });
    } finally {
      setIsRequesting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[300px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-light tracking-wide">Payout Requests</h1>
          <p className="text-sm text-muted-foreground mt-1">Request commission payouts from earned revenue</p>
        </div>
        <Button onClick={() => setShowForm((v) => !v)} size="sm">
          <Plus className="h-4 w-4 mr-1" />
          Request Payout
        </Button>
      </div>

      {showForm && (
        <Card className="rounded-xl border-primary/30">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">New Payout Request</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleRequest} className="flex gap-2">
              <Input
                type="number"
                min={1}
                step={0.01}
                placeholder="Amount (฿)"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="flex-1"
                required
              />
              <Button type="submit" disabled={isRequesting}>
                {isRequesting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Submit"}
              </Button>
              <Button type="button" variant="outline" onClick={() => setShowForm(false)}>
                Cancel
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {payouts.length === 0 ? (
        <Card className="rounded-xl border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center gap-2">
            <Wallet className="h-10 w-10 text-muted-foreground/30" />
            <p className="text-sm text-muted-foreground">No payout requests yet</p>
          </CardContent>
        </Card>
      ) : (
        <Card className="rounded-xl">
          <CardContent className="p-0 divide-y divide-border">
            {payouts.map((p) => (
              <div key={p.id} className="flex items-center justify-between px-4 py-3">
                <div>
                  <p className="text-sm font-medium">฿{Number(p.amount).toLocaleString()}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(p.created_at).toLocaleDateString("en-GB", {
                      day: "numeric", month: "short", year: "numeric",
                    })}
                    {p.processed_at && (
                      <> · Processed {new Date(p.processed_at).toLocaleDateString("en-GB", {
                        day: "numeric", month: "short",
                      })}</>
                    )}
                  </p>
                  {p.notes && <p className="text-xs text-muted-foreground mt-0.5">{p.notes}</p>}
                </div>
                <Badge
                  variant="outline"
                  className={cn("text-xs capitalize", statusColor[p.status] ?? "")}
                >
                  {p.status}
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
