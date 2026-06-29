import type { Metadata } from "next";
import { PricingClient } from "./pricing-client";

export const metadata: Metadata = { title: "Plans & credits — Genalot" };

export default function PricingPage() {
  return <PricingClient />;
}
