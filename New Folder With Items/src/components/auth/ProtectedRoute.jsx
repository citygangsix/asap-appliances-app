import { Navigate, Outlet, useLocation } from "react-router-dom";
import { isAuthenticated } from "../../lib/auth/localAuth";

export function ProtectedRoute() {
  const location = useLocation();

  if (!isAuthenticated()) {
    return <Navigate replace to="/login" state={{ from: location }} />;
  }

  return <Outlet />;
}
