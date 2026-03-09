"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2, CreditCard, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useAuth } from "@/hooks/use-auth";
import { apiClient, ApiError } from "@/lib/api-client";

function SetupContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const cid = searchParams.get("cid");
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();

  const [status, setStatus] = useState<"idle" | "binding" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  // If user is already authenticated, auto-bind
  useEffect(() => {
    if (!authLoading && isAuthenticated && cid && status === "idle") {
      handleBind();
    }
  }, [authLoading, isAuthenticated, cid]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleBind = async () => {
    if (!cid) return;
    setStatus("binding");
    setErrorMsg("");
    try {
      await apiClient.post("/nfc/bind", { card_id: cid });
      setStatus("success");
      setTimeout(() => router.push("/dashboard"), 2000);
    } catch (err) {
      if (err instanceof ApiError) {
        setErrorMsg(err.message);
      } else {
        setErrorMsg("Failed to activate card. Please try again.");
      }
      setStatus("error");
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background px-4">
      <div className="mb-8 text-center">
        <p className="text-xs tracking-[0.3em] text-muted-foreground uppercase">
          The Red Door Club
        </p>
        <h1 className="text-2xl font-light tracking-wide mt-2">Card Activation</h1>
      </div>

      <Card className="w-full max-w-sm">
        <CardHeader>
          <div className="flex items-center gap-3">
            <CreditCard className="h-6 w-6 text-primary" />
            <div>
              <CardTitle className="text-base">NFC Card Setup</CardTitle>
              <CardDescription className="text-xs">{cid}</CardDescription>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {status === "binding" && (
            <div className="text-center py-4">
              <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">Activating your card...</p>
            </div>
          )}

          {status === "success" && (
            <div className="text-center py-4">
              <CheckCircle className="h-12 w-12 text-primary mx-auto mb-3" />
              <p className="font-medium">Card activated!</p>
              <p className="text-sm text-muted-foreground mt-1">Redirecting to your dashboard...</p>
            </div>
          )}

          {status === "error" && (
            <div className="space-y-3">
              <p className="text-sm text-destructive">{errorMsg}</p>
              <Button onClick={handleBind} className="w-full">
                Try Again
              </Button>
            </div>
          )}

          {status === "idle" && !isAuthenticated && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                To activate your NFC card, you need to create an account or log in first.
              </p>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  variant="outline"
                  onClick={() => router.push(`/login?redirect=/setup?cid=${cid}`)}
                >
                  Log In
                </Button>
                <Button
                  onClick={() => router.push(`/qr-register?cid=${cid}`)}
                >
                  Register
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function SetupPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    }>
      <SetupContent />
    </Suspense>
  );
}
