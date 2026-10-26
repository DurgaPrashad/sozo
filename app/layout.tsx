import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SOZO — A workspace for discovery",
  description:
    "Big questions. Brighter discoveries. Explore scientific literature, connect evidence, and move your research forward.",
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
