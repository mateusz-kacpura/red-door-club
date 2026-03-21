"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2, CreditCard, CheckCircle, XCircle, Users, Receipt, Lock, Unlock } from "lucide-react";

type TapAction =
  | "setup"
  | "welcome"
  | "card_suspended"
  | "connection_made"
  | "payment_added"
  | "locker_assigned"
  | "locker_released"
  | "locker_occupied"
  | "locker_already_assigned"
  | null;

interface TapResult {
  action: TapAction;
  message: string | null;
  member_name: string | null;
  redirect_url: string | null;
}

function TapContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const cid = searchParams.get("cid");

  const [status, setStatus] = useState<"loading" | "done" | "error">("loading");
  const [result, setResult] = useState<TapResult | null>(null);
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    if (!cid) {
      setErrorMsg("Invalid card — no card ID provided.");
      setStatus("error");
      return;
    }

    const fetchTap = async () => {
      try {
        const res = await fetch(`/api/nfc/tap?cid=${encodeURIComponent(cid)}`);
        const data = await res.json();

        if (!res.ok) {
          throw new Error(data.detail ?? "Unknown error");
        }

        if (data.action === "setup") {
          router.replace(data.redirect_url ?? `/setup?cid=${cid}`);
          return;
        }

        setResult(data);
        setStatus("done");
      } catch (err) {
        setErrorMsg(err instanceof Error ? err.message : "Tap failed");
        setStatus("error");
      }
    };

    fetchTap();
  }, [cid, router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center max-w-sm mx-auto px-6">
        {/* Logo */}
        <p className="text-xs tracking-[0.3em] text-muted-foreground uppercase mb-8">
          S8LLS Club
        </p>

        {status === "loading" && (
          <div className="space-y-4">
            <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto" />
            <p className="text-muted-foreground">Reading card...</p>
          </div>
        )}

        {/* Welcome */}
        {status === "done" && result?.action === "welcome" && (
          <div className="space-y-4">
            <CheckCircle className="h-16 w-16 text-primary mx-auto" />
            <h1 className="text-2xl font-light tracking-wide">
              {result.member_name ? `Welcome back, ${result.member_name}` : "Welcome back"}
            </h1>
            <p className="text-muted-foreground text-sm">{result.message}</p>
            <button
              onClick={() => router.push("/dashboard")}
              className="mt-4 inline-flex items-center gap-2 px-6 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
            >
              Go to Dashboard
            </button>
          </div>
        )}

        {/* Card suspended */}
        {status === "done" && result?.action === "card_suspended" && (
          <div className="space-y-4">
            <XCircle className="h-16 w-16 text-destructive mx-auto" />
            <h1 className="text-xl font-light">Card Deactivated</h1>
            <p className="text-muted-foreground text-sm">{result.message}</p>
            <p className="text-xs text-muted-foreground">Please contact club staff for assistance.</p>
          </div>
        )}

        {/* Connection made */}
        {status === "done" && result?.action === "connection_made" && (
          <div className="space-y-4">
            <Users className="h-16 w-16 text-primary mx-auto" />
            <h1 className="text-2xl font-light tracking-wide">Connected!</h1>
            <p className="text-muted-foreground text-sm">
              {result.member_name ? `You are now connected with ${result.member_name}.` : result.message}
            </p>
            <button
              onClick={() => router.push("/dashboard/connections")}
              className="mt-4 inline-flex items-center gap-2 px-6 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
            >
              View Connections
            </button>
          </div>
        )}

        {/* Payment added to tab */}
        {status === "done" && result?.action === "payment_added" && (
          <div className="space-y-4">
            <Receipt className="h-16 w-16 text-primary mx-auto" />
            <h1 className="text-2xl font-light tracking-wide">Added to Tab</h1>
            <p className="text-muted-foreground text-sm">{result.message}</p>
            <button
              onClick={() => router.push("/dashboard/tab")}
              className="mt-4 inline-flex items-center gap-2 px-6 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
            >
              View Tab
            </button>
          </div>
        )}

        {/* Locker assigned */}
        {status === "done" && result?.action === "locker_assigned" && (
          <div className="space-y-4">
            <Lock className="h-16 w-16 text-primary mx-auto" />
            <h1 className="text-2xl font-light tracking-wide">Locker Assigned</h1>
            <p className="text-muted-foreground text-sm">{result.message}</p>
            <button
              onClick={() => router.push("/dashboard/locker")}
              className="mt-4 inline-flex items-center gap-2 px-6 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
            >
              View Locker
            </button>
          </div>
        )}

        {/* Locker released */}
        {status === "done" && result?.action === "locker_released" && (
          <div className="space-y-4">
            <Unlock className="h-16 w-16 text-primary mx-auto" />
            <h1 className="text-2xl font-light tracking-wide">Locker Released</h1>
            <p className="text-muted-foreground text-sm">{result.message}</p>
          </div>
        )}

        {/* Locker errors */}
        {status === "done" && (result?.action === "locker_occupied" || result?.action === "locker_already_assigned") && (
          <div className="space-y-4">
            <XCircle className="h-16 w-16 text-destructive mx-auto" />
            <h1 className="text-xl font-light">
              {result.action === "locker_occupied" ? "Locker Unavailable" : "Already Assigned"}
            </h1>
            <p className="text-muted-foreground text-sm">{result.message}</p>
            <p className="text-xs text-muted-foreground">Please contact club staff for assistance.</p>
          </div>
        )}

        {status === "error" && (
          <div className="space-y-4">
            <XCircle className="h-16 w-16 text-destructive mx-auto" />
            <h1 className="text-xl font-light">Something went wrong</h1>
            <p className="text-muted-foreground text-sm">{errorMsg}</p>
          </div>
        )}

        <div className="mt-12">
          <CreditCard className="h-5 w-5 text-muted-foreground/40 mx-auto" />
        </div>
      </div>
    </div>
  );
}

export default function TapPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    }>
      <TapContent />
    </Suspense>
  );
}
