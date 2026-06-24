import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
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

export const metadata: Metadata = {
  title: {
    default: "MartPoint — Retail & ERP Software for Nigerian Businesses",
    template: "%s — MartPoint",
  },
  description:
    "Business management software built for Nigerian retail stores and enterprises. POS, inventory, accounting, and operations in one ecosystem.",
  metadataBase: new URL("https://martpoint.ng"),
  openGraph: {
    type: "website",
    locale: "en_NG",
    siteName: "MartPoint",
  },
  twitter: {
    card: "summary_large_image",
  },
  robots: {
    index: true,
    follow: true,
  },
  icons: {
    icon: "/icon.webp",
    shortcut: "/icon.webp",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col font-sans">{children}</body>
    </html>
  );
}
