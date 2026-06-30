// GET /api/social/accounts — the networks connected to the Ayrshare account.
import { NextResponse } from "next/server";

import { requireRole, toErrorResponse } from "@/lib/auth/account";
import { listConnected } from "@/lib/ayrshare";

export const runtime = "nodejs";

export async function GET() {
  try {
    await requireRole("agent");
    const accounts = await listConnected();
    return NextResponse.json({ accounts });
  } catch (err) {
    return toErrorResponse(err);
  }
}
