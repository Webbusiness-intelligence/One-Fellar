import type { Metadata } from "next";
import { Landing } from "./landing";

export const metadata: Metadata = {
  title: "Genalot — Generate. Publish. Convert.",
  description:
    "Generate studio-grade ads, images and native-4K video from a prompt, auto-post them to every channel, and turn them into leads. Genalot — Generate. Publish. Convert.",
  robots: { index: true, follow: true },
};

export default function RootPage() {
  return <Landing />;
}
