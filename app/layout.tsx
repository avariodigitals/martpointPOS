import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { AnalyticsData } from "@/components/analytics-data";
import { TrackingScript } from "@/components/tracking-script";
import { CookieConsentLoader } from "@/components/cookie-consent-loader";
import { OrganizationSchema, WebsiteSchema } from "@/components/structured-data";
import fs from "fs";
import path from "path";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

function readSettings() {
  try {
    const settingsPath = path.join(process.cwd(), "data", "settings.json");
    if (!fs.existsSync(settingsPath)) return null;
    const data = fs.readFileSync(settingsPath, "utf-8");
    return JSON.parse(data);
  } catch {
    return null;
  }
}

export async function generateMetadata(): Promise<Metadata> {
  const settings = readSettings();
  const seo = settings?.seo || {};
  const searchConsoleCode = settings?.searchConsole?.verificationCode || "";
  const favicon = settings?.header?.favicon || "/icon.webp";
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://martpoint.ng";

  const meta: Metadata = {
    title: {
      default: seo.title || "MartPoint — Retail & ERP Software for African Businesses",
      template: "%s — MartPoint",
    },
    description:
      seo.description ||
      "Business management software built for African retail stores and enterprises. POS, inventory, accounting, and operations in one ecosystem.",
    metadataBase: new URL(baseUrl),
    openGraph: {
      type: "website",
      locale: "en_NG",
      siteName: "MartPoint",
      images: [
        {
          url: "/retail-dashboard.webp",
          width: 1908,
          height: 956,
          alt: "MartPoint — Retail & ERP Software for African Businesses",
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      images: ["/retail-dashboard.webp"],
    },
    robots: {
      index: true,
      follow: true,
    },
    icons: {
      icon: favicon,
      shortcut: favicon,
    },
  };

  if (searchConsoleCode && searchConsoleCode.length > 10) {
    meta.verification = {
      google: searchConsoleCode.trim(),
    };
  }

  return meta;
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} h-full antialiased`} suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://www.googletagmanager.com" />
        <link rel="preconnect" href="https://connect.facebook.net" />
        <link rel="dns-prefetch" href="https://www.clarity.ms" />
        <link rel="dns-prefetch" href="https://static.hotjar.com" />
      </head>
      <body className="min-h-full flex flex-col font-sans">
        <OrganizationSchema />
        <WebsiteSchema />
        <AnalyticsData />
        <TrackingScript />
        {children}
        <CookieConsentLoader />
      </body>
    </html>
  );
}
