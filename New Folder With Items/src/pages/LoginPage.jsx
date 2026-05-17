import { useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { useDashboardAuth } from "../lib/auth/dashboardAuth";

function getRedirectTarget(location) {
  const from = location.state?.from;

  if (!from?.pathname || from.pathname === "/dashboard/login") {
    return "/dashboard/phone";
  }

  return `${from.pathname}${from.search || ""}${from.hash || ""}`;
}

export function LoginPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const auth = useDashboardAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const redirectTarget = getRedirectTarget(location);

  if (auth.isAuthenticated) {
    return <Navigate replace to={redirectTarget} />;
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setErrorMessage("");
    setIsSubmitting(true);

    const result = await auth.signIn(email, password);
    setIsSubmitting(false);

    if (!result.ok) {
      setErrorMessage(result.message);
      return;
    }

    navigate(redirectTarget, { replace: true });
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f5f7fb] px-4 py-10 text-[#151821]">
      <section className="w-full max-w-[420px] rounded-[8px] border border-slate-200 bg-white p-6 shadow-[0_24px_80px_rgba(15,23,42,0.12)] sm:p-8">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-indigo-600">
            ASAP Operations
          </p>
          <h1 className="mt-3 text-3xl font-semibold tracking-normal text-slate-950">
            Dashboard Login
          </h1>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            Sign in with the Supabase Auth user assigned to this dashboard.
          </p>
        </div>

        {auth.status === "configuration_error" || auth.status === "error" ? (
          <div className="mt-5 rounded-[6px] border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-800">
            {auth.message}
          </div>
        ) : null}

        <form className="mt-7 space-y-5" onSubmit={handleSubmit}>
          <label className="block" htmlFor="dashboard-email">
            <span className="text-sm font-semibold text-slate-700">Email</span>
            <input
              autoComplete="email"
              className="mt-2 h-12 w-full rounded-[6px] border border-slate-300 bg-white px-3 text-base text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100"
              id="dashboard-email"
              inputMode="email"
              onChange={(event) => setEmail(event.target.value)}
              placeholder="office@example.com"
              required
              type="email"
              value={email}
            />
          </label>

          <label className="block" htmlFor="dashboard-password">
            <span className="text-sm font-semibold text-slate-700">Password</span>
            <input
              autoComplete="current-password"
              className="mt-2 h-12 w-full rounded-[6px] border border-slate-300 bg-white px-3 text-base text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100"
              id="dashboard-password"
              onChange={(event) => setPassword(event.target.value)}
              required
              type="password"
              value={password}
            />
          </label>

          {errorMessage ? (
            <div className="rounded-[6px] border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
              {errorMessage}
            </div>
          ) : null}

          <button
            className="flex h-12 w-full items-center justify-center rounded-[6px] bg-indigo-600 px-4 text-sm font-semibold text-white transition hover:bg-indigo-700 focus:outline-none focus:ring-4 focus:ring-indigo-200 disabled:cursor-not-allowed disabled:bg-slate-400"
            disabled={isSubmitting || auth.isChecking || auth.status === "configuration_error"}
            type="submit"
          >
            {auth.isChecking ? "Checking session..." : isSubmitting ? "Signing in..." : "Sign In"}
          </button>
        </form>
      </section>
    </main>
  );
}
