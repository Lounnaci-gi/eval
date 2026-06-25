import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "EPEOR Insights - Analytics Dashboard",
  description: "Système solide d'analyse de données EPEOR",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr" className="h-full antialiased">
      <body className="min-h-full min-h-[100dvh] flex flex-col overflow-x-hidden">{children}</body>
    </html>
  );
}
