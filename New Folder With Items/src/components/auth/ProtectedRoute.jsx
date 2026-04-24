import { Navigate, Outlet, useLocation } from "react-router-dom";
import { isAuthenticated } from "../../lib/auth/localAuth";

export function ProtectedRoute() {
  const location = useLocation();

  if (!isAuthenticated()) {
    return <Navigate replace to="/dashboard/login" state={{ from: location }} />;
  }

  return <Outlet />;
}
