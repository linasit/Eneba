import { Navigate, useLocation } from "react-router-dom";
import { ReactNode } from "react";
import { useAuth } from "../store/auth";

export default function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const loc = useLocation();
  if (loading) return null;
  return user ? (
    <>{children}</>
  ) : (
    <Navigate to="/login" replace state={{ from: loc.pathname }} />
  );
}
