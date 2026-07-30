import type { Metadata, Viewport } from "next";
import { Outfit, Geist } from "next/font/google";
import "./globals.css";
import { BRAND } from "@/lib/branding";
import { DEFAULT_THEME } from "@/lib/themes";
import { ReducedMotionSync } from "@/components/shared/ReducedMotionSync";
import { PwaProvider } from "@/components/pwa/PwaProvider";
import { InstallBanner } from "@/components/pwa/InstallBanner";

/* Display face for the wordmark and headings; body face for everything else. */
const display = Outfit({
  subsets: ["latin"],
  weight: ["600", "700", "800"],
  variable: "--font-brand-display",
  display: "swap",
});

const body = Geist({
  subsets: ["latin"],
  variable: "--font-brand-body",
  display: "swap",
});

export const metadata: Metadata = {
  title: BRAND.name,
  description: BRAND.tagline,
  applicationName: BRAND.name,
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: BRAND.shortName,
  },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#131035",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-theme={DEFAULT_THEME} className={`${display.variable} ${body.variable}`}>
      <body className="antialiased">
        <PwaProvider />
        <ReducedMotionSync />
        {children}
        <InstallBanner />
      </body>
    </html>
  );
}
