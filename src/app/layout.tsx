import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";

import { AppProviders } from "@/components/providers/app-providers";
import { getPublicAppUrl } from "@/lib/app-url";
import { APPLE_STARTUP_IMAGES, HOMESCREEN_APP_NAME } from "@/lib/homescreen";

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
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#000000" },
    { media: "(prefers-color-scheme: dark)", color: "#000000" },
  ],
};

export const metadata: Metadata = {
  metadataBase: new URL(getPublicAppUrl()),
  applicationName: HOMESCREEN_APP_NAME,
  title: {
    default: "Spark & Drive Autos",
    template: "%s | Spark & Drive Autos",
  },
  description:
    "Discover, source, and track premium vehicles from Ghana and China, with transparent shipping, duty updates, and concierge support.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    title: HOMESCREEN_APP_NAME,
    statusBarStyle: "black-translucent",
    startupImage: APPLE_STARTUP_IMAGES.map((image) => ({
      url: image.url,
      media: image.media,
    })),
  },
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
      { url: "/icon-1024.png", sizes: "1024x1024", type: "image/png" },
    ],
    apple: [
      { url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
      { url: "/apple-touch-icon-167.png", sizes: "167x167", type: "image/png" },
    ],
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
      <body className={`${geistSans.variable} ${geistMono.variable} min-h-screen min-w-0 overflow-x-clip antialiased`}>
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
