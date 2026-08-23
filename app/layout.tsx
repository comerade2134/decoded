import type { Metadata, Viewport } from "next";
import { Inter, Space_Grotesk } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-space-grotesk",
  display: "swap",
});

export const metadata: Metadata = {
  title: "DECODED — Psychological Text & Subtext Analyzer",
  description:
    "Analyze texting dynamics, reveal psychological subtext, avoid fatal communication traps, and craft precise Safe and Bold response plays.",
  applicationName: "Decoded",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Decoded",
  },
  formatDetection: {
    telephone: false,
  },
  icons: {
    icon: "/favicon.ico",
    apple: "/apple-touch-icon.png",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#09090b" },
    { media: "(prefers-color-scheme: light)", color: "#09090b" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`dark ${inter.variable} ${spaceGrotesk.variable}`}>
      <head>
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="mobile-web-app-capable" content="yes" />
        {/* Suppress third-party Chrome extension runtime errors from triggering dev overlay */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              if (typeof window !== 'undefined') {
                window.addEventListener('error', function(e) {
                  if (e.filename && (e.filename.includes('chrome-extension://') || e.filename.includes('moz-extension://') || (e.message && e.message.includes('M_ID')))) {
                    e.stopImmediatePropagation();
                  }
                }, true);
                window.addEventListener('unhandledrejection', function(e) {
                  if (e.reason && (String(e.reason).includes('M_ID') || String(e.reason).includes('chrome-extension://'))) {
                    e.stopImmediatePropagation();
                  }
                }, true);
              }
            `,
          }}
        />
      </head>
      <body className="bg-[#09090b] text-zinc-100 font-sans antialiased selection:bg-blue-500/20 selection:text-blue-200">
        <div className="relative min-h-screen flex flex-col items-center justify-between">
          {/* Subtle Ambient Radial Glow */}
          <div
            aria-hidden="true"
            className="pointer-events-none fixed inset-0 z-0 overflow-hidden"
          >
            <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[700px] h-[400px] bg-gradient-to-b from-blue-600/10 via-indigo-600/5 to-transparent blur-[130px] rounded-full" />
            <div className="absolute top-1/3 -right-40 w-[450px] h-[450px] bg-purple-600/5 blur-[150px] rounded-full" />
            <div className="absolute -bottom-40 left-1/3 w-[550px] h-[350px] bg-emerald-600/5 blur-[150px] rounded-full" />
          </div>

          {/* Main Content Area */}
          <div className="relative z-10 w-full flex-1 flex flex-col items-center">
            {children}
          </div>
        </div>
      </body>
    </html>
  );
}
