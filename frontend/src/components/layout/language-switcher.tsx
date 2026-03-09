"use client";

import { usePathname, useRouter } from "next/navigation";
import { useState, useRef, useEffect } from "react";
import { ChevronDown } from "lucide-react";
import { routing, type Locale } from "@/i18n/routing";
import { LOCALE_LABELS } from "@/tolgee/shared";

const LOCALE_FLAGS: Record<string, string> = {
  en: "🇬🇧",
  pl: "🇵🇱",
  ru: "🇷🇺",
  uk: "🇺🇦",
  th: "🇹🇭",
  zh: "🇨🇳",
};

const LOCALE_NAMES: Record<string, string> = {
  en: "English",
  pl: "Polski",
  ru: "Русский",
  uk: "Українська",
  th: "ภาษาไทย",
  zh: "中文",
};

export function LanguageSwitcher() {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const currentLocale =
    routing.locales.find((locale) => pathname.startsWith(`/${locale}`)) ??
    routing.defaultLocale;

  const switchLocale = (locale: Locale) => {
    const segments = pathname.split("/");
    segments[1] = locale;
    router.push(segments.join("/"));
    setOpen(false);
  };

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="relative" ref={ref}>
      {/* Trigger */}
      <button
        onClick={() => setOpen((prev) => !prev)}
        className="flex items-center gap-1.5 h-8 px-2.5 rounded-md text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className="text-base leading-none">{LOCALE_FLAGS[currentLocale]}</span>
        <span>{LOCALE_LABELS[currentLocale as keyof typeof LOCALE_LABELS]}</span>
        <ChevronDown
          className={`h-3 w-3 transition-transform duration-150 ${open ? "rotate-180" : ""}`}
        />
      </button>

      {/* Dropdown */}
      {open && (
        <div
          role="listbox"
          className="absolute right-0 top-full mt-1 z-50 min-w-[160px] rounded-md border bg-card shadow-lg overflow-hidden"
        >
          {routing.locales.map((locale) => {
            const active = locale === currentLocale;
            return (
              <button
                key={locale}
                role="option"
                aria-selected={active}
                onClick={() => switchLocale(locale as Locale)}
                className={`flex items-center gap-2.5 w-full px-3 py-2 text-xs text-left transition-colors ${
                  active
                    ? "bg-primary/10 text-primary font-medium"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
              >
                <span className="text-base leading-none">{LOCALE_FLAGS[locale]}</span>
                <span className="font-medium">
                  {LOCALE_LABELS[locale as keyof typeof LOCALE_LABELS]}
                </span>
                <span className="text-muted-foreground">
                  {LOCALE_NAMES[locale]}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
