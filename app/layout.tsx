import type { Metadata } from "next";
import "./globals.css";
import "./space.css";

export const metadata: Metadata = {
  title: "SOZO — Two worlds. One limitless frontier.",
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
      <body className="antialiased">{children}</body>
    </html>
  );
}
