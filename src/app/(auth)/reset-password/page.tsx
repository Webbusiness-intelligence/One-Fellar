"use client";

// Landing page for the password-recovery email link (via /auth/callback, which has
// already exchanged the code for a session). Sets the new password and enters the app.
import { useState } from "react";
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
  const router = useRouter();
  const supabase = createClient();

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
        /session/i.test(error.message)
          ? "This reset link has expired — request a new one below."
          : error.message,
      );
      setLoading(false);
      return;
    }
    router.push("/ad-studio");
  };

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
          disabled={loading}
          className="ad-cta flex w-full items-center justify-center gap-2 rounded-xl px-5 py-3 text-[14px] font-semibold disabled:opacity-60"
        >
          {loading ? (
            "Saving…"
          ) : (
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
