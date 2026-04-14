import type { Metadata } from "next";
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

export const metadata: Metadata = {
  metadataBase: new URL(getPublicAppUrl()),
  title: {
    default: "Spark and Drive Autos | Premium Automotive Commerce",
    template: "%s | Spark and Drive Autos",
  },
  description:
    "Discover, source, and track premium vehicles from Ghana and China, with transparent shipping, duty updates, and concierge support.",
  openGraph: {
    title: "Spark and Drive Autos",
    description: "Premium automotive commerce and managed import journeys in Ghana.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${geistSans.variable} ${geistMono.variable} min-h-screen antialiased`}>
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
