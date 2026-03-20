"use client";

import { useRouter } from "next/navigation";
import QRCode from "react-qr-code";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useTranslate } from "@tolgee/react";

export default function StaffRegisterGuestPage() {
  const router = useRouter();
  const { t } = useTranslate();

  const qrValue = `${typeof window !== "undefined" ? window.location.origin : ""}/qr-register`;

  return (
    <div className="space-y-6">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => router.back()}
        className="gap-1 -ml-2"
      >
        <ArrowLeft className="h-4 w-4" />
        {t("common.back")}
      </Button>

      <div className="text-center space-y-2">
        <h1 className="text-xl font-semibold">{t("staff.registerGuest")}</h1>
        <p className="text-sm text-muted-foreground">
          {t("staff.registerGuestHint")}
        </p>
      </div>

      <Card className="p-6 flex items-center justify-center">
        <div className="bg-white p-4 rounded-lg">
          <QRCode value={qrValue} size={256} />
        </div>
      </Card>
    </div>
  );
}
