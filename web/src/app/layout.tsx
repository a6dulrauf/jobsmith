import type { Metadata, Viewport } from "next";
import { inter, instrumentSerif, instrumentSerifItalic } from "@/lib/fonts";
import { AppShell } from "@/components/app-shell";
import "./globals.css";

export const metadata: Metadata = {
  // Jobsmith, not career-ops: this is a fork, and the inherited title claimed to
  // be the "official" career-ops experience — an endorsement this project does
  // not have and its upstream's trademark policy specifically reserves.
  // Only what a person READS is renamed. Internal identifiers keep the
  // career-ops spelling (CAREER_OPS_ROOT, the localStorage keys, the skill
  // directories, modes/) so upstream changes still merge cleanly and nobody's
  // saved settings are orphaned.
  title: "Jobsmith",
  description: "A local-first job-search workbench. Finds roles, scores them against your CV, and tailors a document set per application.",
  // Home-screen / standalone (iOS): let our theme-color flow up to the status bar
  // + Dynamic Island; safe-area insets handle the layout.
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "Jobsmith" },
};

export const viewport: Viewport = {
  // viewport-fit=cover → env(safe-area-inset-*) become non-zero so the header can
  // sit flush under the notch / Dynamic Island.
  viewportFit: "cover",
  // Default (corrected to the real theme before paint by THEME_SCRIPT, then kept
  // in sync by the theme toggle). Dark flows seamlessly into the black island.
  themeColor: "#0a0a0a",
};

// Before paint: set the theme class AND tint the browser chrome (theme-color) to
// match — so Safari's status bar / URL bar unify with the header instead of a
// jarring light seam. Matches --bg (light #f7f6f3 / dark #0a0a0a).
const THEME_SCRIPT = `(function(){try{var t=localStorage.getItem('career-ops:theme');var d=t==='dark'||(!t&&window.matchMedia('(prefers-color-scheme: dark)').matches);if(d)document.documentElement.classList.add('dark');var m=document.querySelector('meta[name="theme-color"]');if(!m){m=document.createElement('meta');m.setAttribute('name','theme-color');document.head.appendChild(m);}m.setAttribute('content',d?'#0a0a0a':'#f7f6f3');}catch(e){document.documentElement.classList.add('dark');}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${inter.variable} ${instrumentSerif.variable} ${instrumentSerifItalic.variable}`}
    >
      <body className="font-sans antialiased">
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
