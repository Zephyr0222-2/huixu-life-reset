import type { Metadata } from "next";
import HuixuApp from "../HuixuApp";

export const metadata: Metadata = {
  title: "Huixu — Find Your Rhythm Again",
  description: "A gentle, local-first challenge tool for rebuilding a livable daily rhythm, beginning with the body and basic life before growth.",
  manifest: "/manifest-en.webmanifest",
  alternates: { canonical: "/en" },
  openGraph: {
    title: "Huixu — Find Your Rhythm Again",
    description: "A free, local-first life reset challenge. No account, no streak pressure, and your records stay on your device.",
    type: "website",
    locale: "en_US",
    images: [{ url: "/og.png", width: 1732, height: 909, alt: "Huixu — Find Your Rhythm Again" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Huixu — Find Your Rhythm Again",
    description: "A gentle, local-first challenge for rebuilding your daily rhythm.",
    images: ["/og.png"],
  },
};

export default function EnglishHuixuPage() {
  return <HuixuApp />;
}
