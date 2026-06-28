import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { AnalyticsData } from "@/components/analytics-data";
import { TrackingScript } from "@/components/tracking-script";
import { CookieConsentLoader } from "@/components/cookie-consent-loader";
import { OrganizationSchema, WebsiteSchema, SiteNavigationSchema } from "@/components/structured-data";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
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

async function readSettings(): Promise<Record<string, unknown> | null> {
  if (!isSupabaseConfigured()) {
    return null;
  }

  try {
    const { data, error } = await supabase
      .from("settings")
      .select("data")
      .eq("id", 1)
      .single();

    if (error || !data) {
      return null;
    }

    return (data.data as Record<string, unknown>) || null;
  } catch {
    return null;
  }
}

export async function generateMetadata(): Promise<Metadata> {
  const settings = await readSettings();
  const seo = (settings?.seo as Record<string, string>) || {};
  const searchConsole = (settings?.searchConsole as Record<string, string>) || {};
  const header = (settings?.header as Record<string, string>) || {};
  const searchConsoleCode = searchConsole.verificationCode || "";
  const favicon = header.favicon || "/icon.webp";
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://martpoint.com.ng";
  const ogImage = seo.ogImage || "/retail-dashboard.webp";

  const meta: Metadata = {
    title: {
      default: seo.title || "MartPoint — Retail & ERP Software for African Businesses",
      template: "%s — MartPoint",
    },
    description:
      seo.description ||
      "Business management software built for African retail stores and enterprises. POS, inventory, accounting, and operations in one ecosystem.",
    authors: [{ name: "MartPoint by Avario Digitals" }],
    metadataBase: new URL(baseUrl),
    openGraph: {
      type: "website",
      locale: "en_NG",
      siteName: "MartPoint",
      url: baseUrl,
      images: [
        {
          url: ogImage,
          secureUrl: `${baseUrl}${ogImage}`,
          width: 1200,
          height: 630,
          alt: seo.title || "MartPoint — Retail & ERP Software for African Businesses",
          type: "image/webp",
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      images: [ogImage],
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
        <SiteNavigationSchema />
        <AnalyticsData />
        <TrackingScript />
        {children}
        <CookieConsentLoader />
      </body>
    </html>
  );
}
