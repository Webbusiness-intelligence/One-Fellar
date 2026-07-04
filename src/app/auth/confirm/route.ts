// GET /auth/confirm — server-side verification of emailed auth links (password
// recovery + signup confirmation). Uses the token_hash flow: it does NOT need the
// PKCE code verifier, so it works no matter which browser/device opens the link
// (the #1 real-world failure of client-side exchange). Verifies the one-time token,
// sets the session cookie, then redirects to ?next= (relative paths only).
import { type EmailOtpType } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const nextParam = searchParams.get("next") ?? "/ad-studio";
  const next = nextParam.startsWith("/") && !nextParam.startsWith("//") ? nextParam : "/ad-studio";

  if (token_hash && type) {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({ type, token_hash });
    if (!error) return NextResponse.redirect(new URL(next, origin));
  }
  return NextResponse.redirect(new URL("/login?error=auth-link", origin));
}
