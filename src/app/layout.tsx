import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";

import { AppProviders } from "@/components/providers/app-providers";
import { getPublicAppUrl } from "@/lib/app-url";

import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f7fafc" },
    { media: "(prefers-color-scheme: dark)", color: "#0f172a" },
  ],
};

export const metadata: Metadata = {
  metadataBase: new URL(getPublicAppUrl()),
  applicationName: "Spark & Drive Autos",
  title: {
    default: "Spark & Drive Autos",
    template: "%s | Spark & Drive Autos",
  },
  description:
    "Discover, source, and track premium vehicles from Ghana and China, with transparent shipping, duty updates, and concierge support.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    title: "Spark & Drive Autos",
    statusBarStyle: "black-translucent",
  },
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
  openGraph: {
    title: "Spark & Drive Autos",
    description: "Premium automotive commerce and managed import journeys in Ghana.",
    type: "website",
    images: [{ url: "/icon-512.png", width: 512, height: 512, alt: "Spark & Drive Autos" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Spark & Drive Autos",
    description: "Premium automotive commerce and managed import journeys in Ghana.",
    images: ["/icon-512.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${geistSans.variable} ${geistMono.variable} min-h-screen min-w-0 antialiased`}>
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
