// POST /api/auth/check-email — does an account exist for this email?
// Used by the forgot-password page so we can tell the user "no account with that
// email" instead of silently pretending a reset was sent. NOTE: this is a deliberate
// product choice — it lets someone probe which emails have accounts (enumeration).
// Fails OPEN (exists:true) on any error so a real reset is never blocked.
import { NextResponse } from "next/server";

import { supabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const { email } = (await req.json()) as { email?: string };
    const clean = String(email ?? "").trim().toLowerCase();
    if (!clean || !clean.includes("@")) {
      return NextResponse.json({ error: "Enter a valid email" }, { status: 400 });
    }
    const admin = supabaseAdmin();
    const { data, error } = await admin
      .from("profiles")
      .select("user_id")
      .ilike("email", clean)
      .limit(1)
      .maybeSingle();
    if (error) return NextResponse.json({ exists: true, unknown: true });
    return NextResponse.json({ exists: !!data });
  } catch {
    return NextResponse.json({ exists: true, unknown: true });
  }
}
