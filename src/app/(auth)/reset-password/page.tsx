"use client";

// Landing page for the password-recovery email link. The browser Supabase client
// (PKCE, detectSessionInUrl) picks up the ?code/#token from the URL on mount and
// establishes a temporary recovery session; once that's ready we let the user set a
// new password. If no session ever arrives, the link was bad/expired.
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Lock, ArrowRight, ArrowLeft } from "lucide-react";

import { createClient } from "@/lib/supabase/client";
import { AuthShell, AuthField, AuthError } from "../auth-ui";

export default function ResetPasswordPage() {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);
  const [linkBad, setLinkBad] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  // Wait for the recovery session (from the emailed link) before enabling the form.
  useEffect(() => {
    let settled = false;
    const done = () => {
      settled = true;
      setReady(true);
      setLinkBad(false);
    };
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      if (session) done();
    });
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) done();
    });
    const t = setTimeout(() => {
      if (!settled) setLinkBad(true);
    }, 3500);
    return () => {
      sub.subscription.unsubscribe();
      clearTimeout(t);
    };
  }, [supabase]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords don't match.");
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      setError(
        /session|missing/i.test(error.message)
          ? "This reset link has expired — request a new one below."
          : error.message,
      );
      setLoading(false);
      return;
    }
    router.push("/ad-studio");
  };

  if (linkBad && !ready) {
    return (
      <AuthShell>
        <h2 className="mb-1 text-2xl font-semibold text-white">Link expired</h2>
        <p className="mb-6 text-[13px] leading-relaxed text-white/40">
          This password reset link is invalid or has already been used. Request a fresh one.
        </p>
        <Link
          href="/forgot-password"
          className="ad-cta flex w-full items-center justify-center gap-2 rounded-xl px-5 py-3 text-[14px] font-semibold"
        >
          Send a new reset link <ArrowRight className="size-3.5" strokeWidth={2.5} />
        </Link>
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

  return (
    <AuthShell>
      <h2 className="mb-1 text-2xl font-semibold text-white">Set a new password</h2>
      <p className="mb-6 text-[13px] text-white/40">Choose a new password for your account.</p>

      <form onSubmit={handleSubmit} className="space-y-4">
        {error ? <AuthError>{error}</AuthError> : null}

        <div>
          <label className="mb-1.5 block text-[12px] font-medium text-white/50">New password</label>
          <AuthField
            icon={Lock}
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="At least 8 characters"
            required
            autoComplete="new-password"
          />
        </div>

        <div>
          <label className="mb-1.5 block text-[12px] font-medium text-white/50">Confirm password</label>
          <AuthField
            icon={Lock}
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder="Repeat the password"
            required
            autoComplete="new-password"
          />
        </div>

        <button
          type="submit"
          disabled={loading || !ready}
          className="ad-cta flex w-full items-center justify-center gap-2 rounded-xl px-5 py-3 text-[14px] font-semibold disabled:opacity-60"
        >
          {loading ? "Saving…" : !ready ? "Verifying link…" : (
            <>
              Save new password <ArrowRight className="size-3.5" strokeWidth={2.5} />
            </>
          )}
        </button>
      </form>

      <Link
        href="/forgot-password"
        className="mt-5 flex items-center justify-center gap-1.5 text-[12px] font-medium text-white/40 transition-colors hover:text-white/70"
      >
        <ArrowLeft className="size-3.5" />
        Request a new link
      </Link>
    </AuthShell>
  );
}
