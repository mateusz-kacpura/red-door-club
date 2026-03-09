import { createServerInstance } from "@tolgee/react/server";
import { getLocale } from "next-intl/server";
import { createTolgeeInstance } from "./shared";

export const { getTolgee, getTranslate, T } = createServerInstance({
  getLocale,
  createTolgee: async (locale: string) => {
    const messages = (await import(`../../messages/${locale}.json`)).default;
    return createTolgeeInstance(locale, { [locale]: messages });
  },
});
