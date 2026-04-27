import { ReactNode, useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Logo } from "./Logo";

interface ProtectedRouteProps {
  children: ReactNode;
  requireVehicle?: boolean;
  requireAdmin?: boolean;
}

export function ProtectedRoute({
  children,
  requireVehicle = false,
  requireAdmin = false,
}: ProtectedRouteProps) {
  const { user, loading } = useAuth();
  const location = useLocation();
  const [checking, setChecking] = useState(requireVehicle || requireAdmin);
  const [hasVehicle, setHasVehicle] = useState<boolean | null>(null);
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);

  useEffect(() => {
    if (!user) return;
    if (!requireVehicle && !requireAdmin) {
      setChecking(false);
      return;
    }
    (async () => {
      if (requireVehicle) {
        const { count } = await supabase
          .from("vehicles")
          .select("id", { count: "exact", head: true })
          .eq("user_id", user.id);
        setHasVehicle((count ?? 0) > 0);
      }
      if (requireAdmin) {
        const { data } = await supabase
          .from("users")
          .select("is_admin")
          .eq("id", user.id)
          .maybeSingle();
        setIsAdmin(!!data?.is_admin);
      }
      setChecking(false);
    })();
  }, [user, requireVehicle, requireAdmin]);

  if (loading || checking) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="animate-pulse">
          <Logo size="lg" />
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (requireAdmin && isAdmin === false) {
    return <Navigate to="/dashboard/operacional" replace />;
  }

  if (requireVehicle && hasVehicle === false) {
    return <Navigate to="/onboarding" replace />;
  }

  return <>{children}</>;
}
