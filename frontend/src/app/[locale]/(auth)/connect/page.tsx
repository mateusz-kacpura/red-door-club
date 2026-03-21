"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2, UserPlus, CheckCircle, XCircle, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { apiClient, ApiError } from "@/lib/api-client";
import { useTranslate } from "@tolgee/react";

interface PublicProfile {
  id: string;
  full_name: string | null;
  company_name: string | null;
  industry: string | null;
}

type ConnectStatus = "loading" | "ready" | "connecting" | "connected" | "already_connected" | "error";

function ConnectContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const memberId = searchParams.get("member");
  const { t } = useTranslate();

  const [status, setStatus] = useState<ConnectStatus>("loading");
  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    if (!memberId) {
      setErrorMsg(t("connect.notFound"));
      setStatus("error");
      return;
    }

    apiClient
      .get<PublicProfile>(`/members/${memberId}/public-profile`)
      .then((data) => {
        setProfile(data);
        setStatus("ready");
      })
      .catch((err) => {
        if (err instanceof ApiError && err.status === 401) {
          const returnUrl = encodeURIComponent(`/connect?member=${memberId}`);
          router.replace(`/login?returnUrl=${returnUrl}`);
          return;
        }
        setErrorMsg(err instanceof ApiError ? err.message : t("connect.notFound"));
        setStatus("error");
      });
  }, [memberId, router, t]);

  const handleConnect = async () => {
    if (!memberId) return;
    setStatus("connecting");
    try {
      await apiClient.post("/members/connect", { member_id: memberId });
      setStatus("connected");
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setStatus("already_connected");
      } else if (err instanceof ApiError && err.status === 400) {
        setErrorMsg(err.message);
        setStatus("error");
      } else {
        setErrorMsg(err instanceof Error ? err.message : "Connection failed");
        setStatus("error");
      }
    }
  };

  const displayName = profile?.full_name ?? "Member";

  return (
    <div className="text-center max-w-sm mx-auto px-6">
      <p className="text-xs tracking-[0.3em] text-muted-foreground uppercase mb-8">
        S8LLS Club
      </p>

      {status === "loading" && (
        <div className="space-y-4">
          <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto" />
          <p className="text-muted-foreground">{t("connect.connecting")}</p>
        </div>
      )}

      {status === "ready" && (
        <div className="space-y-6">
          <UserPlus className="h-16 w-16 text-primary mx-auto" />
          <div className="space-y-2">
            <h1 className="text-2xl font-light tracking-wide">
              {t("connect.connectWith", { name: displayName })}
            </h1>
            {profile?.company_name && (
              <p className="text-sm text-muted-foreground">{profile.company_name}</p>
            )}
            {profile?.industry && (
              <p className="text-xs text-muted-foreground">{profile.industry}</p>
            )}
          </div>
          <Button onClick={handleConnect} size="lg" className="w-full max-w-[200px]">
            <UserPlus className="h-4 w-4 mr-2" />
            {t("connect.connectButton")}
          </Button>
        </div>
      )}

      {status === "connecting" && (
        <div className="space-y-4">
          <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto" />
          <p className="text-muted-foreground">{t("connect.connecting")}</p>
        </div>
      )}

      {status === "connected" && (
        <div className="space-y-4">
          <CheckCircle className="h-16 w-16 text-primary mx-auto" />
          <h1 className="text-2xl font-light tracking-wide">{t("connect.success")}</h1>
          <p className="text-muted-foreground text-sm">
            {t("connect.successDesc", { name: displayName })}
          </p>
          <Button onClick={() => router.push("/dashboard/connections")} variant="outline">
            <Users className="h-4 w-4 mr-2" />
            {t("connect.viewConnections")}
          </Button>
        </div>
      )}

      {status === "already_connected" && (
        <div className="space-y-4">
          <Users className="h-16 w-16 text-primary mx-auto" />
          <h1 className="text-2xl font-light tracking-wide">{t("connect.alreadyConnected")}</h1>
          <p className="text-muted-foreground text-sm">
            {t("connect.alreadyConnectedDesc", { name: displayName })}
          </p>
          <Button onClick={() => router.push("/dashboard/connections")} variant="outline">
            <Users className="h-4 w-4 mr-2" />
            {t("connect.viewConnections")}
          </Button>
        </div>
      )}

      {status === "error" && (
        <div className="space-y-4">
          <XCircle className="h-16 w-16 text-destructive mx-auto" />
          <h1 className="text-xl font-light">{t("connect.notFound")}</h1>
          <p className="text-muted-foreground text-sm">{errorMsg}</p>
        </div>
      )}
    </div>
  );
}

export default function ConnectPage() {
  return (
    <Suspense
      fallback={
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
        </div>
      }
    >
      <ConnectContent />
    </Suspense>
  );
}
