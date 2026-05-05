import { Link } from "react-router-dom";
import { AlertTriangle, X } from "lucide-react";
import { useState } from "react";
import { usePlanStatus } from "@/hooks/usePlanStatus";
import { Button } from "./ui/button";

export function TrialBanner() {
  const { planType, daysRemaining } = usePlanStatus();
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;
  if (planType !== "trial" || daysRemaining > 3 || daysRemaining <= 0) return null;

  return (
    <div className="sticky top-0 z-40 border-b border-amber-500/30 bg-amber-500/15 px-3 py-2 text-amber-900 backdrop-blur dark:text-amber-200">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-2 text-xs sm:text-sm">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span>
            Seu período grátis expira em <strong>{daysRemaining}</strong> {daysRemaining === 1 ? "dia" : "dias"}.
          </span>
        </div>
        <div className="flex items-center gap-1">
          <Link to="/planos">
            <Button size="sm" className="h-7 bg-amber-500 text-white hover:bg-amber-600">Assinar agora</Button>
          </Link>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setDismissed(true)} aria-label="Fechar">
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}
