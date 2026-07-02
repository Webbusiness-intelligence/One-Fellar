import type { Metadata } from "next";
import { Landing } from "./landing";

export const metadata: Metadata = {
  title: "Genalot — AI ad, image & video studio",
  description:
    "Generate studio-grade ads, images and native-4K video from a prompt — then schedule and auto-post them. Genalot is the AI creation suite that closes the loop.",
  robots: { index: true, follow: true },
};

export default function RootPage() {
  return <Landing />;
}
