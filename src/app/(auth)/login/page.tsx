"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Mail, Lock, Eye, EyeOff, ArrowRight } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { AuthShell, AuthField, AuthError } from "../auth-ui";

// `useSearchParams` opts out of static prerendering unless wrapped in Suspense.
export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginPageInner />
    </Suspense>
  );
}

function LoginPageInner() {
  const searchParams = useSearchParams();
  // Forwarded from `/join/<token>` when the visitor already has an account.
  const inviteToken = searchParams.get("invite");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }
    router.push(inviteToken ? `/join/${encodeURIComponent(inviteToken)}` : "/ad-studio");
  };

  return (
    <AuthShell mode="login">
      <h2 className="mb-1 text-2xl font-semibold text-white">
        {inviteToken ? "Sign in to accept" : "Welcome back"}
      </h2>
      <p className="mb-6 text-[13px] text-white/40">
        {inviteToken ? "Sign in and we'll take you to the invitation." : "Sign in to continue creating."}
      </p>

      <form onSubmit={handleLogin} className="space-y-4">
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

        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <label className="text-[12px] font-medium text-white/50">Password</label>
            <Link href="/forgot-password" className="text-[12px] font-medium text-primary/60 transition-colors hover:text-primary">
              Forgot?
            </Link>
          </div>
          <AuthField
            icon={Lock}
            type={showPass ? "text" : "password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter your password"
            required
            autoComplete="current-password"
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

        <button
          type="submit"
          disabled={loading}
          className="ad-cta flex w-full items-center justify-center gap-2 rounded-xl px-5 py-3 text-[14px] font-semibold disabled:opacity-60"
        >
          {loading ? (
            "Signing in…"
          ) : (
            <>
              Sign in <ArrowRight className="size-3.5" strokeWidth={2.5} />
            </>
          )}
        </button>
      </form>

      <p className="mt-5 text-center text-[12px] text-white/30">
        Don&apos;t have an account?{" "}
        <Link
          href={inviteToken ? `/signup?invite=${encodeURIComponent(inviteToken)}` : "/signup"}
          className="font-medium text-primary/60 transition-colors hover:text-primary"
        >
          Sign up
        </Link>
      </p>
    </AuthShell>
  );
}
