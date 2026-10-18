import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "2040 보이스룸",
  description: "실시간 웹 음성 대화방",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  interactiveWidget: "resizes-content",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="ko"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              if (typeof SVGAnimatedString !== "undefined" && !SVGAnimatedString.prototype.toLowerCase) {
                SVGAnimatedString.prototype.toLowerCase = function() {
                  return (this.baseVal || "").toLowerCase();
                };
              }
            `,
          }}
        />
      </head>
      <body suppressHydrationWarning className="h-full w-full overflow-hidden bg-slate-950 text-slate-100">{children}</body>
    </html>
  );
}
