"use client";

import { usePathname, useRouter } from "next/navigation";
import { routing, type Locale } from "@/i18n/routing";
import { LOCALE_LABELS } from "@/tolgee/shared";
import { Button } from "@/components/ui";

export function LanguageSwitcher() {
  const pathname = usePathname();
  const router = useRouter();

  const currentLocale = routing.locales.find((locale) =>
    pathname.startsWith(`/${locale}`)
  ) ?? routing.defaultLocale;

  const switchLocale = (locale: Locale) => {
    const segments = pathname.split("/");
    // Replace the locale segment (index 1) with the new locale
    segments[1] = locale;
    router.push(segments.join("/"));
  };

  return (
    <div className="flex items-center gap-1">
      {routing.locales.map((locale) => (
        <Button
          key={locale}
          variant={locale === currentLocale ? "secondary" : "ghost"}
          size="sm"
          className="h-8 px-2 text-xs font-medium"
          onClick={() => switchLocale(locale as Locale)}
        >
          {LOCALE_LABELS[locale as Locale]}
        </Button>
      ))}
    </div>
  );
}
