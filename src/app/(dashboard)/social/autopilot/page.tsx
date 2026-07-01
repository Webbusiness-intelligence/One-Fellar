import type { Metadata } from "next";
import { AutopilotPanel } from "../autopilot-panel";

export const metadata: Metadata = { title: "Autopilot — Genalot" };

export default function AutopilotPage() {
  return <AutopilotPanel />;
}
