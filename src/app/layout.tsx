import type { Metadata, Viewport } from "next";
import "./globals.css";
import { BRAND } from "@/lib/branding";
import { DEFAULT_THEME } from "@/lib/themes";
import { ReducedMotionSync } from "@/components/shared/ReducedMotionSync";

export const metadata: Metadata = {
  title: BRAND.name,
  description: BRAND.tagline,
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-theme={DEFAULT_THEME}>
      <body className="antialiased">
        <ReducedMotionSync />
        {children}
      </body>
    </html>
  );
}
