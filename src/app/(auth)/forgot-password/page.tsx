"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Mail, ArrowLeft, ArrowRight, CheckCircle } from "lucide-react";
import { AuthShell, AuthField, AuthError } from "../auth-ui";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const supabase = createClient();

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    // Tell the user up-front if there's no account for this email.
    try {
      const res = await fetch("/api/auth/check-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const j = (await res.json()) as { exists?: boolean };
      if (res.ok && j.exists === false) {
        setError("We don't have an account with that email. Check the address, or create one.");
        setLoading(false);
        return;
      }
    } catch {
      // network hiccup on the check — fall through and try the reset anyway
    }

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }
    setSuccess(true);
    setLoading(false);
  };

  if (success) {
    return (
      <AuthShell>
        <div className="text-center">
          <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-2xl border border-primary/10 bg-primary/5">
            <CheckCircle className="size-6 text-primary/60" />
          </div>
          <h2 className="mb-1 text-2xl font-semibold text-white">Check your email</h2>
          <p className="mb-6 text-[13px] leading-relaxed text-white/40">
            We&apos;ve sent a password reset link to <span className="text-white/70">{email}</span>.
          </p>
          <Link
            href="/login"
            className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl border border-white/[0.08] bg-white/[0.03] px-5 py-3 text-[13px] font-medium text-white/70 transition-all hover:border-white/[0.12] hover:bg-white/[0.06]"
          >
            Back to sign in
          </Link>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell>
      <h2 className="mb-1 text-2xl font-semibold text-white">Reset password</h2>
      <p className="mb-6 text-[13px] text-white/40">Enter your email and we&apos;ll send you a reset link.</p>

      <form onSubmit={handleReset} className="space-y-4">
        {error ? <AuthError>{error}</AuthError> : null}

        <div>
          <label className="mb-1.5 block text-[12px] font-medium text-white/50">Email</label>
          <AuthField
            icon={Mail}
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@company.com"
            required
            autoComplete="email"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="ad-cta flex w-full items-center justify-center gap-2 rounded-xl px-5 py-3 text-[14px] font-semibold disabled:opacity-60"
        >
          {loading ? (
            "Sending…"
          ) : (
            <>
              Send reset link <ArrowRight className="size-3.5" strokeWidth={2.5} />
            </>
          )}
        </button>
      </form>

      <Link
        href="/login"
        className="mt-5 flex items-center justify-center gap-1.5 text-[12px] font-medium text-white/40 transition-colors hover:text-white/70"
      >
        <ArrowLeft className="size-3.5" />
        Back to sign in
      </Link>
    </AuthShell>
  );
}
