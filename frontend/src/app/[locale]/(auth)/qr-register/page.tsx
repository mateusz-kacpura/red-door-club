import { Suspense } from "react";
import Image from "next/image";
import { QRRegisterForm } from "@/components/auth/qr-register-form";

export const metadata = {
  title: "Join S8LLS Club",
  description: "Complete your membership registration",
};

export default function QRRegisterPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center py-12 px-4">
      <div className="mb-8 text-center flex flex-col items-center">
        <Image src="/icons/logo.svg" alt="S8LLS" width={150} height={54} className="dark:invert-0 invert" unoptimized priority />
        <p className="text-sm text-muted-foreground mt-2 tracking-wider">
          Private Business Club — Bangkok
        </p>
      </div>
      <Suspense fallback={<div className="text-muted-foreground">Loading...</div>}>
        <QRRegisterForm />
      </Suspense>
    </div>
  );
}
