import { defineRouting } from "next-intl/routing";

export const routing = defineRouting({
  locales: ["en", "pl", "ru", "uk", "th", "zh"],
  defaultLocale: "en",
});

export type Locale = (typeof routing.locales)[number];
