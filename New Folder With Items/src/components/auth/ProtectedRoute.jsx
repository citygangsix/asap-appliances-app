import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useDashboardAuth } from "../../lib/auth/dashboardAuth";

function DashboardAuthStatusPage({ title, message }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f5f7fb] px-4 py-10 text-[#151821]">
      <section className="w-full max-w-[460px] rounded-[8px] border border-slate-200 bg-white p-6 shadow-[0_24px_80px_rgba(15,23,42,0.12)] sm:p-8">
        <p className="text-sm font-semibold uppercase tracking-[0.24em] text-indigo-600">
          ASAP Operations
        </p>
        <h1 className="mt-3 text-2xl font-semibold tracking-normal text-slate-950">
          {title}
        </h1>
        <p className="mt-3 text-sm leading-6 text-slate-600">{message}</p>
      </section>
    </main>
  );
}

export function ProtectedRoute() {
  const location = useLocation();
  const auth = useDashboardAuth();

  if (auth.isChecking) {
    return (
      <DashboardAuthStatusPage
        message="Checking the saved Supabase session."
        title="Opening Dashboard"
      />
    );
  }

  if (auth.status === "configuration_error" || auth.status === "error") {
    return (
      <DashboardAuthStatusPage
        message={auth.message}
        title="Dashboard Auth Unavailable"
      />
    );
  }

  if (!auth.isAuthenticated) {
    return <Navigate replace to="/dashboard/login" state={{ from: location }} />;
  }

  return <Outlet />;
}
