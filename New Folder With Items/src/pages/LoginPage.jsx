import { useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { isAuthenticated, login } from "../lib/auth/localAuth";

export function LoginPage() {
  const [email, setEmail] = useState(import.meta.env.VITE_ASAP_AUTH_EMAIL || "");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const redirectTo = location.state?.from?.pathname || "/dashboard";

  if (isAuthenticated()) {
    return <Navigate replace to="/dashboard" />;
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);

    const result = await login(email, password);
    setIsSubmitting(false);

    if (!result.ok) {
      setError(result.message);
      return;
    }

    navigate(redirectTo.startsWith("/dashboard/login") ? "/dashboard" : redirectTo, { replace: true });
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#11141c] px-4 py-10 text-white">
      <section className="w-full max-w-md rounded-[28px] border border-white/10 bg-[#1c1e26] p-6 shadow-2xl shadow-black/30 sm:p-8">
        <div className="mb-8">
          <div className="mb-5 flex items-center gap-3">
            <span className="h-4 w-4 rounded-full bg-indigo-500" />
            <p className="text-lg font-semibold">ASAP Operations</p>
          </div>
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-indigo-300">
            Secure dashboard
          </p>
          <h1 className="mt-3 text-3xl font-semibold tracking-normal">Login</h1>
          <p className="mt-3 text-sm leading-6 text-slate-400">
            Temporary local gate for the CRM dashboard. Supabase Auth can replace this without
            changing the protected route shape.
          </p>
        </div>

        <form className="space-y-5" onSubmit={handleSubmit}>
          <label className="block text-sm font-semibold text-slate-300">
            Email
            <input
              autoComplete="email"
              className="mt-2 w-full rounded-2xl border border-white/10 bg-[#11141c] px-4 py-3 text-base text-white outline-none transition focus:border-indigo-400"
              onChange={(event) => setEmail(event.target.value)}
              required
              type="email"
              value={email}
            />
          </label>

          <label className="block text-sm font-semibold text-slate-300">
            Password
            <input
              autoComplete="current-password"
              className="mt-2 w-full rounded-2xl border border-white/10 bg-[#11141c] px-4 py-3 text-base text-white outline-none transition focus:border-indigo-400"
              onChange={(event) => setPassword(event.target.value)}
              required
              type="password"
              value={password}
            />
          </label>

          {error ? (
            <div className="rounded-2xl border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
              {error}
            </div>
          ) : null}

          <button
            className="w-full rounded-2xl bg-indigo-500 px-5 py-3 text-base font-semibold text-white transition hover:bg-indigo-400 disabled:cursor-not-allowed disabled:bg-slate-600"
            disabled={isSubmitting}
            type="submit"
          >
            {isSubmitting ? "Checking..." : "Open dashboard"}
          </button>
        </form>
      </section>
    </main>
  );
}
