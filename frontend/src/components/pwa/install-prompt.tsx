"use client";

import { useEffect, useState } from "react";
import { X, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

/**
 * PWA Install Prompt — shown on mobile when the app can be installed.
 * Captures the beforeinstallprompt event and shows a banner with an install button.
 * Hides itself after installation or dismissal (saved to localStorage).
 */
export function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Skip if already dismissed
    if (localStorage.getItem("pwa-install-dismissed")) return;

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setVisible(true);
    };

    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") {
      setVisible(false);
    }
    setDeferredPrompt(null);
  };

  const handleDismiss = () => {
    localStorage.setItem("pwa-install-dismissed", "1");
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div className="fixed bottom-20 left-4 right-4 z-50 md:left-auto md:right-6 md:w-80 animate-in slide-in-from-bottom-4">
      <div
        className="rounded-xl border p-4 shadow-lg"
        style={{ background: "#141426", borderColor: "rgba(201,169,110,0.3)" }}
      >
        <div className="flex items-start gap-3">
          <div className="rounded-lg p-1.5" style={{ background: "rgba(201,169,110,0.15)" }}>
            <Smartphone className="h-4 w-4" style={{ color: "#C9A96E" }} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-white">Add to Home Screen</p>
            <p className="text-xs mt-0.5" style={{ color: "rgba(201,169,110,0.7)" }}>
              Install S8LLS Club for quick access
            </p>
          </div>
          <button
            onClick={handleDismiss}
            className="shrink-0 opacity-50 hover:opacity-100 transition-opacity"
          >
            <X className="h-4 w-4 text-white" />
          </button>
        </div>
        <div className="mt-3 flex gap-2">
          <Button
            size="sm"
            className="flex-1 text-xs"
            style={{ background: "#C9A96E", color: "#141426" }}
            onClick={handleInstall}
          >
            Install
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="text-xs"
            style={{ color: "rgba(201,169,110,0.7)" }}
            onClick={handleDismiss}
          >
            Not now
          </Button>
        </div>
      </div>
    </div>
  );
}
