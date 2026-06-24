// /api/ai-ads/copy  (POST)
// Body: { prompt, productName?, platform?, tone?, count? }
// Generates ready-to-post ad copy for an ad concept.

import { NextResponse } from "next/server";

import { requireRole, toErrorResponse } from "@/lib/auth/account";
import { writeAdCopy } from "@/lib/ai-ads/copywriter";

export async function POST(req: Request) {
  try {
    await requireRole("agent");
    const body = (await req.json()) as {
      prompt?: string;
      productName?: string;
      platform?: string;
      tone?: string;
      count?: number;
    };
    const prompt = String(body.prompt ?? "").trim();
    if (!prompt) return NextResponse.json({ error: "Nothing to write copy for" }, { status: 400 });

    const variants = await writeAdCopy({
      prompt,
      productName: body.productName ?? null,
      tone: body.tone ?? null,
      platform: body.platform,
      count: body.count ?? 3,
    });

    if (!variants.length) {
      return NextResponse.json({ error: "Couldn't write copy — try again" }, { status: 502 });
    }
    return NextResponse.json({ variants });
  } catch (err) {
    return toErrorResponse(err);
  }
}
