import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "回序｜从混乱，回到自己的节奏",
  description: "一套帮助你重新建立稳定生活秩序的渐进式挑战系统。",
  openGraph: {
    title: "回序｜从混乱，回到自己的节奏",
    description: "7日清场、21日稳定、50日挑战。从今天能承受的一件小事开始。",
    type: "website",
    locale: "zh_CN",
    images: [{ url: "/og.png", width: 1732, height: 909, alt: "回序生活重启挑战系统" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "回序｜从混乱，回到自己的节奏",
    description: "7日清场、21日稳定、50日挑战。",
    images: ["/og.png"],
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
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
