import type { Metadata } from "next";
import { SocialClient } from "./social-client";

export const metadata: Metadata = { title: "Social — Genalot" };

export default function SocialPage() {
  return <SocialClient />;
}
