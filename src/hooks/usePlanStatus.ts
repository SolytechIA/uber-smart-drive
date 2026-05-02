import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export type PlanType = "trial" | "pro" | "expired";

export interface PlanStatus {
  loading: boolean;
  planType: PlanType;
  daysRemaining: number;
  isActive: boolean;
  isPro: boolean;
  isAdmin: boolean;
  trialExpiresAt: string | null;
  refresh: () => Promise<void>;
}

export function usePlanStatus(): PlanStatus {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [planType, setPlanType] = useState<PlanType>("trial");
  const [trialExpiresAt, setTrialExpiresAt] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  const load = async () => {
    if (!user) {
      setLoading(false);
      return;
    }
    const { data } = await supabase
      .from("users")
      .select("plano, trial_expira_em, is_admin")
      .eq("id", user.id)
      .maybeSingle();

    if (data) {
      let plano = (data.plano as PlanType) ?? "trial";
      const expiry = data.trial_expira_em as string | null;
      if (plano === "trial" && expiry && new Date(expiry).getTime() <= Date.now()) {
        plano = "expired";
      }
      setPlanType(plano);
      setTrialExpiresAt(expiry);
      setIsAdmin(!!data.is_admin);
    }
    setLoading(false);
  };

  useEffect(() => {
    setLoading(true);
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const daysRemaining = (() => {
    if (planType !== "trial" || !trialExpiresAt) return 0;
    const ms = new Date(trialExpiresAt).getTime() - Date.now();
    return Math.max(0, Math.ceil(ms / (1000 * 60 * 60 * 24)));
  })();

  const isPro = planType === "pro";
  const isActive = isPro || (planType === "trial" && daysRemaining > 0);

  return {
    loading,
    planType,
    daysRemaining,
    isActive,
    isPro,
    isAdmin,
    trialExpiresAt,
    refresh: load,
  };
}

export const MP_SUBSCRIBE_URL =
  "https://www.mercadopago.com.br/subscriptions/checkout?preapproval_plan_id=8a946d0ab11b4c4f943e6e7d338e7cdf";
