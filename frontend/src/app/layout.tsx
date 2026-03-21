import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";

const inter = Inter({ subsets: ["latin", "cyrillic"] });

export const metadata: Metadata = {
  title: "S8LLS Club",
  description: "S8LLS — Private Members Club",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "S8LLS",
  },
};

export default function RootLayout({
  children,
  params,
}: Readonly<{
  children: React.ReactNode;
  params?: Promise<{ locale?: string }>;
}>) {
  return (
    <html suppressHydrationWarning>
      <head>
        <meta name="theme-color" content="#C9A96E" />
        <link rel="apple-touch-icon" href="/icons/icon-192.png" />
      </head>
      <body className={inter.className}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
