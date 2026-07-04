"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { User, Mail, Lock, Eye, EyeOff, ArrowRight, CheckCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { AuthShell, AuthField, AuthError } from "../auth-ui";

// `useSearchParams` opts out of static prerendering unless wrapped in Suspense.
export default function SignupPage() {
  return (
    <Suspense fallback={null}>
      <SignupPageInner />
    </Suspense>
  );
}

function SignupPageInner() {
  const searchParams = useSearchParams();
  // Carried through the signup → email verification → redirect round-trip.
  const inviteToken = searchParams.get("invite");

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const supabase = createClient();

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }

    setLoading(true);
    const emailRedirectTo = inviteToken
      ? `${window.location.origin}/join/${encodeURIComponent(inviteToken)}`
      : undefined;

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName },
        ...(emailRedirectTo ? { emailRedirectTo } : {}),
      },
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
            We&apos;ve sent a confirmation link to <span className="text-white/70">{email}</span>. Click it to verify
            your account.
          </p>
          <Link
            href={inviteToken ? `/login?invite=${encodeURIComponent(inviteToken)}` : "/login"}
            className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl border border-white/[0.08] bg-white/[0.03] px-5 py-3 text-[13px] font-medium text-white/70 transition-all hover:border-white/[0.12] hover:bg-white/[0.06]"
          >
            Back to sign in
          </Link>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell mode="signup">
      <h2 className="mb-1 text-2xl font-semibold text-white">
        {inviteToken ? "Create account & join" : "Create your account"}
      </h2>
      <p className="mb-6 text-[13px] text-white/40">
        {inviteToken ? "Verify your email, then accept the invitation to join your team." : "Start creating in seconds."}
      </p>

      <form onSubmit={handleSignup} className="space-y-4">
        {error ? <AuthError>{error}</AuthError> : null}

        <div>
          <label className="mb-1.5 block text-[12px] font-medium text-white/50">Full name</label>
          <AuthField
            icon={User}
            type="text"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="Jane Doe"
            required
            autoComplete="name"
          />
        </div>

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

        <div>
          <label className="mb-1.5 block text-[12px] font-medium text-white/50">Password</label>
          <AuthField
            icon={Lock}
            type={showPass ? "text" : "password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="At least 6 characters"
            required
            autoComplete="new-password"
            rightSlot={
              <button
                type="button"
                onClick={() => setShowPass((v) => !v)}
                aria-label={showPass ? "Hide password" : "Show password"}
                className="absolute right-3.5 text-white/20 transition-colors hover:text-white/40"
              >
                {showPass ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            }
          />
        </div>

        <div>
          <label className="mb-1.5 block text-[12px] font-medium text-white/50">Confirm password</label>
          <AuthField
            icon={Lock}
            type={showPass ? "text" : "password"}
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Repeat your password"
            required
            autoComplete="new-password"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="ad-cta flex w-full items-center justify-center gap-2 rounded-xl px-5 py-3 text-[14px] font-semibold disabled:opacity-60"
        >
          {loading ? (
            "Creating account…"
          ) : (
            <>
              Create account <ArrowRight className="size-3.5" strokeWidth={2.5} />
            </>
          )}
        </button>

        <p className="text-center text-[11px] leading-relaxed text-white/30">
          By creating an account you agree to our{" "}
          <Link href="/terms" className="text-white/50 underline-offset-2 hover:text-white/70 hover:underline">Terms of Service</Link>{" "}
          and{" "}
          <Link href="/privacy" className="text-white/50 underline-offset-2 hover:text-white/70 hover:underline">Privacy Policy</Link>.
        </p>
      </form>

      <p className="mt-5 text-center text-[12px] text-white/30">
        Already have an account?{" "}
        <Link
          href={inviteToken ? `/login?invite=${encodeURIComponent(inviteToken)}` : "/login"}
          className="font-medium text-primary/60 transition-colors hover:text-primary"
        >
          Log in
        </Link>
      </p>
    </AuthShell>
  );
}
