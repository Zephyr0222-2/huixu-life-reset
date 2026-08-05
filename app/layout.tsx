import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "回序｜从混乱，回到自己的节奏",
  description: "一套帮助你重新建立稳定生活秩序的渐进式挑战系统。",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "回序",
  },
  openGraph: {
    title: "回序｜从混乱，回到自己的节奏",
    description: "7日清场、21日稳定、50日挑战与自定义挑战。从今天能承受的一件小事开始。",
    type: "website",
    locale: "zh_CN",
    images: [{ url: "/og.png", width: 1732, height: 909, alt: "回序生活重启挑战系统" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "回序｜从混乱，回到自己的节奏",
    description: "7日清场、21日稳定、50日挑战与自定义挑战。",
    images: ["/og.png"],
  },
  icons: {
    icon: [
      { url: "/favicon-v3-32.png", sizes: "32x32", type: "image/png" },
      { url: "/icon-v3-192.png", sizes: "192x192", type: "image/png" },
    ],
    shortcut: "/favicon-v3-32.png",
    apple: [{ url: "/apple-touch-icon-v3.png", sizes: "180x180", type: "image/png" }],
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
