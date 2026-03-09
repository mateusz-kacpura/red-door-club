"use client";

import { TolgeeProvider, useTolgeeSSR } from "@tolgee/react";
import type { TolgeeStaticData } from "@tolgee/core";
import { createTolgeeInstance } from "./shared";

interface TolgeeClientProviderProps {
  locale: string;
  staticData: TolgeeStaticData;
  children: React.ReactNode;
}

export function TolgeeClientProvider({
  locale,
  staticData,
  children,
}: TolgeeClientProviderProps) {
  const tolgee = useTolgeeSSR(createTolgeeInstance(locale, staticData), locale);
  return (
    <TolgeeProvider tolgee={tolgee} fallback={null}>
      {children}
    </TolgeeProvider>
  );
}
