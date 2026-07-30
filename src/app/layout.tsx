import type { Metadata, Viewport } from "next";
import "./globals.css";
import { BRAND } from "@/lib/branding";
import { DEFAULT_THEME } from "@/lib/themes";
import { ReducedMotionSync } from "@/components/shared/ReducedMotionSync";
import { PwaProvider } from "@/components/pwa/PwaProvider";
import { InstallBanner } from "@/components/pwa/InstallBanner";

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
    <html lang="en" data-theme={DEFAULT_THEME}>
      <body className="antialiased">
        <PwaProvider />
        <ReducedMotionSync />
        {children}
        <InstallBanner />
      </body>
    </html>
  );
}
