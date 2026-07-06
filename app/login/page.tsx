"use client";

import { useState, useEffect, Suspense } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18">
      <path
        fill="#4285F4"
        d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.9c1.7-1.57 2.7-3.88 2.7-6.62Z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.9-2.26c-.8.54-1.84.86-3.06.86-2.35 0-4.34-1.59-5.05-3.72H.95v2.33A9 9 0 0 0 9 18Z"
      />
      <path
        fill="#FBBC05"
        d="M3.95 10.7A5.4 5.4 0 0 1 3.67 9c0-.59.1-1.17.28-1.7V4.97H.95A9 9 0 0 0 0 9c0 1.45.35 2.83.95 4.03l3-2.33Z"
      />
      <path
        fill="#EA4335"
        d="M9 3.58c1.32 0 2.5.46 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0A9 9 0 0 0 .95 4.97l3 2.33C4.66 5.17 6.65 3.58 9 3.58Z"
      />
    </svg>
  );
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (searchParams.get("error")) {
      setError("That didn't work. Check your details and try again.");
    }
  }, [searchParams]);

  async function handleCredentialsLogin(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const res = await signIn("credentials", {
      username,
      password,
      redirect: false,
    });
    setLoading(false);
    if (res?.error) {
      setError("Incorrect username or password.");
    } else {
      router.push("/dashboard");
      router.refresh();
    }
  }

  async function handleGoogleLogin() {
    setGoogleLoading(true);
    await signIn("google", { callbackUrl: "/dashboard" });
  }

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-bg px-4">
      <div className="w-full max-w-sm animate-fade-up">
        {/* Mark */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-11 h-11 rounded-lg bg-ink flex items-center justify-center mb-4">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path
                d="M3 6.5C3 5.67 3.67 5 4.5 5H8l1.5 2H15.5c.83 0 1.5.67 1.5 1.5v6c0 .83-.67 1.5-1.5 1.5h-11C3.67 16 3 15.33 3 14.5v-8Z"
                stroke="#FAFAF8"
                strokeWidth="1.4"
                strokeLinejoin="round"
              />
            </svg>
          </div>
          <h1 className="text-[19px] font-semibold text-ink tracking-tight">
            Sign in to GairyFiles
          </h1>
          <p className="text-[13px] text-muted mt-1.5 font-mono">
            ~/your-files
          </p>
        </div>

        {/* Card */}
        <div className="bg-surface border border-border rounded-lg p-6 shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
          <button
            onClick={handleGoogleLogin}
            disabled={googleLoading}
            className="w-full h-10 flex items-center justify-center gap-2.5 rounded-sm border border-border bg-surface hover:bg-bg transition-colors text-[13.5px] font-medium text-ink disabled:opacity-60"
          >
            <GoogleIcon />
            {googleLoading ? "Redirecting…" : "Continue with Google"}
          </button>

          <div className="flex items-center gap-3 my-5">
            <div className="h-px bg-border flex-1" />
            <span className="text-[11px] text-muted uppercase tracking-wider">
              or
            </span>
            <div className="h-px bg-border flex-1" />
          </div>

          <form onSubmit={handleCredentialsLogin} className="space-y-3">
            <div>
              <label className="text-[12.5px] font-medium text-ink block mb-1.5">
                Username
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                autoComplete="username"
                className="w-full h-10 px-3 rounded-sm border border-border bg-surface text-[13.5px] text-ink placeholder:text-muted/70 focus:border-accent transition-colors"
                placeholder="admin"
              />
            </div>
            <div>
              <label className="text-[12.5px] font-medium text-ink block mb-1.5">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                className="w-full h-10 px-3 rounded-sm border border-border bg-surface text-[13.5px] text-ink placeholder:text-muted/70 focus:border-accent transition-colors"
                placeholder="••••••••"
              />
            </div>

            {error && (
              <p className="text-[12.5px] text-danger bg-danger/5 border border-danger/20 rounded-sm px-3 py-2">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full h-10 rounded-sm bg-accent hover:bg-accent/90 transition-colors text-[13.5px] font-medium text-white disabled:opacity-60 mt-1"
            >
              {loading ? "Signing in…" : "Sign in"}
            </button>
          </form>
        </div>

        <p className="text-center text-[12px] text-muted mt-6">
          Private tool — access is restricted to invited accounts.
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
