import { ReactNode, useEffect, useRef, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Logo } from "./Logo";

interface ProtectedRouteProps {
  children: ReactNode;
  requireVehicle?: boolean;
  requireAdmin?: boolean;
  /** If true (default for app pages), redirect users with expired trial to /planos */
  requireActivePlan?: boolean;
}

export function ProtectedRoute({
  children,
  requireVehicle = false,
  requireAdmin = false,
  requireActivePlan = true,
}: ProtectedRouteProps) {
  const { user, loading } = useAuth();
  const location = useLocation();
  const [checking, setChecking] = useState(requireVehicle || requireAdmin || requireActivePlan);
  const [hasVehicle, setHasVehicle] = useState<boolean | null>(null);
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [planExpired, setPlanExpired] = useState<boolean>(false);
  const checkedForUserId = useRef<string | null>(null);

  useEffect(() => {
    if (!user) return;
    if (!requireVehicle && !requireAdmin && !requireActivePlan) {
      setChecking(false);
      return;
    }
    if (checkedForUserId.current === user.id) return;
    checkedForUserId.current = user.id;

    (async () => {
      if (requireVehicle) {
        const { count } = await supabase
          .from("vehicles")
          .select("id", { count: "exact", head: true })
          .eq("user_id", user.id);
        setHasVehicle((count ?? 0) > 0);
      }
      if (requireAdmin || requireActivePlan) {
        const { data } = await supabase
          .from("users")
          .select("is_admin, plano, trial_expira_em")
          .eq("id", user.id)
          .maybeSingle();
        setIsAdmin(!!data?.is_admin);
        if (requireActivePlan && data) {
          const plano = data.plano as string;
          const expiry = data.trial_expira_em
            ? new Date(data.trial_expira_em).getTime()
            : null;
          const expired =
            plano === "expired" ||
            (plano === "trial" && expiry !== null && expiry <= Date.now());
          setPlanExpired(expired);
        }
      }
      setChecking(false);
    })();
  }, [user, requireVehicle, requireAdmin, requireActivePlan]);

  if (loading || (user && checking)) {
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

  if (requireActivePlan && planExpired && location.pathname !== "/planos") {
    return <Navigate to="/planos" replace />;
  }

  if (requireVehicle && hasVehicle === false) {
    return <Navigate to="/onboarding" replace />;
  }

  return <>{children}</>;
}
