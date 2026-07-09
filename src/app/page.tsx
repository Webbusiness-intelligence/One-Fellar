import type { Metadata } from "next";
import { Landing } from "./landing";

export const metadata: Metadata = {
  title: "Genalot — Generate. Publish. Convert.",
  description:
    "Generate studio-grade ads, images and native-4K video from a prompt, auto-post them to every channel, and turn them into leads. Genalot — Generate. Publish. Convert.",
  robots: { index: true, follow: true },
  openGraph: {
    title: "Genalot — Generate. Publish. Convert.",
    description:
      "Studio-grade ads, images and native-4K video from one prompt — auto-posted to your channels.",
    url: "https://genalot.com",
    siteName: "Genalot",
    type: "website",
    images: [{ url: "/og.jpg", width: 1200, height: 630, alt: "A cinematic AI render made with Genalot" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Genalot — Generate. Publish. Convert.",
    description:
      "Studio-grade ads, images and native-4K video from one prompt — auto-posted to your channels.",
    images: ["/og.jpg"],
  },
};

export default function RootPage() {
  return <Landing />;
}
