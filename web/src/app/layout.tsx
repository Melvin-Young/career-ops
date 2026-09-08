import type { Metadata, Viewport } from "next";
import { plexSans } from "@/lib/fonts";
import { AppShell } from "@/components/app-shell";
import "./globals.css";

export const metadata: Metadata = {
  title: "career-ops",
  description: "A personal application desk over your career-ops files.",
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "career-ops" },
};

export const viewport: Viewport = {
  viewportFit: "cover",
  themeColor: "#edeff2",
};

// Before paint: apply the stored theme and tint the browser chrome to the
// ground color so the status bar and the top bar read as one surface.
const THEME_SCRIPT = `(function(){try{var t=localStorage.getItem('career-ops:theme');var d=t==='dark'||(!t&&window.matchMedia('(prefers-color-scheme: dark)').matches);if(d)document.documentElement.classList.add('dark');var m=document.querySelector('meta[name="theme-color"]');if(!m){m=document.createElement('meta');m.setAttribute('name','theme-color');document.head.appendChild(m);}m.setAttribute('content',d?'#0f1216':'#edeff2');}catch(e){}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className={plexSans.variable}>
      <body className="font-sans antialiased">
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
