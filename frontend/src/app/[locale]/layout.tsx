import { notFound } from "next/navigation";
import { getMessages } from "next-intl/server";
import { routing } from "@/i18n/routing";
import { TolgeeClientProvider } from "@/tolgee/client";
import type { TolgeeStaticData } from "@tolgee/core";

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  if (!routing.locales.includes(locale as (typeof routing.locales)[number])) {
    notFound();
  }

  const messages = await getMessages();
  const staticData = { [locale]: messages } as unknown as TolgeeStaticData;

  return (
    <TolgeeClientProvider locale={locale} staticData={staticData}>
      {children}
    </TolgeeClientProvider>
  );
}
