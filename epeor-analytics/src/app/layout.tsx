import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import Script from "next/script";
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

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Read server cookie header to determine initial theme for SSR to avoid hydration mismatch
  const headersList = headers();
  const cookieHeader = (await headersList).get?.("cookie") || "";
  const themeCookie = cookieHeader
    .split(";")
    .map((c) => c.trim())
    .find((c) => c.startsWith("theme="))
    ?.split("=")[1];
  const serverDataTheme = themeCookie === "dark" ? "dark" : undefined;

  return (
    <html lang="fr" className="h-full antialiased" {...(serverDataTheme ? { "data-theme": serverDataTheme } : {})}>
      <head>
        {/* Theme initialization script to avoid FOUC: reads localStorage and applies data-theme early */}
        <Script id="theme-init" strategy="beforeInteractive">
          {"(function(){try{var key='theme';var m=document.cookie.match(new RegExp('(^| )'+key+'=([^;]+)'));var v=m?decodeURIComponent(m[2]):null;var root=document.documentElement;if(v==='dark'){root.setAttribute('data-theme','dark');}else if(v==='light'){root.removeAttribute('data-theme');}else{var isDark=window.matchMedia&&window.matchMedia('(prefers-color-scheme: dark)').matches;if(isDark){root.setAttribute('data-theme','dark');}else{root.removeAttribute('data-theme');}}}catch(e){} })()"}
        </Script>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@300;400;600;700;900&family=Inter:ital,opsz,wght@0,14..32,300..900;1,14..32,300..900&family=Poppins:wght@300;400;600;700;900&display=swap" rel="stylesheet" />
      </head>
      <body className="min-h-full min-h-[100dvh] flex flex-col overflow-x-hidden">{children}</body>
    </html>
  );
}
