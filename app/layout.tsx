import type { Metadata } from "next";
import "./globals.css";
import "./space.css";
import "./premium.css";
import "./companion.css";
import "./cosmos.css";

export const metadata: Metadata = {
  title: "SOZO — Intelligence for life beyond Earth.",
  description:
    "Explore the Moon and Mars with SOZO. Planetary evidence, interactive 3D exploration, and scientific research connected to the MOMAR workspaces.",
  icons: {
    icon: "/sozo-logo.svg",
    shortcut: "/sozo-logo.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head><link rel="preload" href="/fonts/dm-sans-latin.woff2" as="font" type="font/woff2" crossOrigin="anonymous"/><link rel="preload" href="/fonts/saira-condensed-latin-600.woff2" as="font" type="font/woff2" crossOrigin="anonymous"/></head>
      <body className="antialiased">{children}</body>
    </html>
  );
}
