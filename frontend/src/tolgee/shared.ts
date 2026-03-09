import { DevTools, Tolgee, FormatSimple } from "@tolgee/web";
import type { TolgeeStaticData } from "@tolgee/core";

export const ALL_LOCALES = ["en", "pl", "ru", "uk", "th", "zh"] as const;
export type AppLocale = (typeof ALL_LOCALES)[number];

export const LOCALE_LABELS: Record<AppLocale, string> = {
  en: "EN",
  pl: "PL",
  ru: "RU",
  uk: "UK",
  th: "TH",
  zh: "ZH",
};

export const createTolgeeInstance = (
  locale: string,
  staticData: TolgeeStaticData
) =>
  Tolgee()
    .use(DevTools())
    .use(FormatSimple())
    .init({
      defaultLanguage: locale,
      staticData,
    });
