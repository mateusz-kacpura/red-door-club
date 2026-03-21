import { Suspense } from "react";
import { QRRegisterForm } from "@/components/auth/qr-register-form";

export const metadata = {
  title: "Join S8LLS Club",
  description: "Complete your membership registration",
};

export default function QRRegisterPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center py-12 px-4">
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-light tracking-widest text-foreground uppercase">
          S8LLS
        </h1>
        <p className="text-sm text-muted-foreground mt-1 tracking-wider">
          Private Business Club — Bangkok
        </p>
      </div>
      <Suspense fallback={<div className="text-muted-foreground">Loading...</div>}>
        <QRRegisterForm />
      </Suspense>
    </div>
  );
}
