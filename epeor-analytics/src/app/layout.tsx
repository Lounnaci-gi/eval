import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import Script from "next/script";
import { Poppins } from "next/font/google";
import { SweetAlertBridge } from "./components/SweetAlertBridge";
import "./globals.css";

const poppins = Poppins({
  weight: ["300", "400", "500", "600", "700", "800", "900"],
  subsets: ["latin"],
  display: "swap",
});


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
      </head>
      <body className={`${poppins.className} min-h-full min-h-[100dvh] flex flex-col overflow-x-hidden`}>
        <SweetAlertBridge />
        {children}
      </body>
    </html>
  );
}
