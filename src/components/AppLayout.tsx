import { ReactNode, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  Activity,
  BarChart3,
  Brain,
  ChevronLeft,
  DollarSign,
  Gauge,
  LayoutGrid,
  LogOut,
  Menu,
  Settings,
  Shield,
  TrendingUp,
} from "lucide-react";
import { Logo } from "./Logo";
import { ThemeToggle } from "./ThemeToggle";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { TrialBanner } from "./TrialBanner";
import { OnlineIndicator } from "./OnlineIndicator";
import { useAuth } from "@/contexts/AuthContext";
import { usePlanStatus } from "@/hooks/usePlanStatus";
import { cn } from "@/lib/utils";

interface NavItem {
  to: string;
  label: string;
  icon: typeof Activity;
}

const baseNavItems: NavItem[] = [
  { to: "/dashboard/operacional", label: "Operacional", icon: Activity },
  { to: "/dashboard/financeiro", label: "Financeiro", icon: DollarSign },
  { to: "/dashboard/graficos-financeiros", label: "Gráficos Financeiros", icon: TrendingUp },
  { to: "/dashboard/painel-de-cards", label: "Painel de Cards", icon: LayoutGrid },
  { to: "/dashboard/graficos-performance", label: "Gráficos de Performance", icon: Gauge },
  { to: "/analise-ia", label: "Análise IA", icon: Brain },
  { to: "/configuracoes", label: "Config.", icon: Settings },
];

export function AppLayout({ children }: { children: ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const { user, signOut } = useAuth();
  const { planType, daysRemaining, isAdmin } = usePlanStatus();
  const navigate = useNavigate();
  const location = useLocation();

  const isActive = (to: string) =>
    location.pathname === to || location.pathname.startsWith(to + "/");

  const navItems: NavItem[] = [
    ...baseNavItems,
    ...(isAdmin ? [{ to: "/admin", label: "Admin", icon: Shield } as NavItem] : []),
  ];

  const handleSignOut = async () => {
    await signOut();
    navigate("/login", { replace: true });
  };

  return (
    <div className="min-h-screen bg-background">
      <TrialBanner />
      <OnlineIndicator />
      {/* Desktop Sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-30 hidden flex-col border-r border-border/60 bg-card transition-all duration-200 md:flex",
          collapsed ? "w-[60px]" : "w-[240px]",
        )}
      >
        <div className="flex h-16 items-center justify-between border-b border-border/60 px-3">
          {!collapsed && <Logo size="sm" />}
          {collapsed && (
            <div className="mx-auto rounded-lg gradient-bg p-1.5 shadow-glow">
              <Activity className="h-5 w-5 text-primary-foreground" strokeWidth={2.5} />
            </div>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0"
            onClick={() => setCollapsed((c) => !c)}
            aria-label={collapsed ? "Expandir" : "Recolher"}
          >
            {collapsed ? <Menu className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </Button>
        </div>

        <nav className="flex-1 space-y-1 p-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.to);
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors",
                  active
                    ? "gradient-bg text-primary-foreground shadow-glow"
                    : "text-muted-foreground hover:bg-secondary hover:text-foreground",
                  collapsed && "justify-center px-2",
                )}
                title={collapsed ? item.label : undefined}
              >
                <Icon className="h-5 w-5 shrink-0" />
                {!collapsed && <span className="truncate">{item.label}</span>}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-border/60 p-3">
          {!collapsed ? (
            <div className="space-y-2">
              <div className="px-2">
                <p className="truncate text-sm font-medium">{user?.email}</p>
                {planType === "pro" && (
                  <Badge className="mt-1 bg-emerald-500/15 text-emerald-500 hover:bg-emerald-500/15">
                    Plano Pro ✓
                  </Badge>
                )}
                {planType === "trial" && (
                  <Badge className="mt-1 bg-amber-500/15 text-amber-600 hover:bg-amber-500/15 dark:text-amber-400">
                    Trial • {daysRemaining} {daysRemaining === 1 ? "dia restante" : "dias restantes"}
                  </Badge>
                )}
                {planType === "expired" && (
                  <Link to="/planos">
                    <Badge className="mt-1 bg-destructive/15 text-destructive hover:bg-destructive/20">
                      Trial expirado
                    </Badge>
                  </Link>
                )}
              </div>
              {/* Admin agora aparece como item de menu (visível só para admin) */}
              <div className="flex items-center gap-2">
                <ThemeToggle />
                <Button
                  variant="ghost"
                  size="sm"
                  className="flex-1 justify-start text-muted-foreground"
                  onClick={handleSignOut}
                >
                  <LogOut className="mr-2 h-4 w-4" /> Sair
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2">
              {isAdmin && (
                <Link to="/admin" title="Admin">
                  <Button variant="ghost" size="icon" className="h-9 w-9">
                    <Shield className="h-4 w-4" />
                  </Button>
                </Link>
              )}
              <ThemeToggle />
              <Button variant="ghost" size="icon" className="h-9 w-9" onClick={handleSignOut}>
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>
      </aside>

      {/* Mobile header */}
      <header className="sticky top-0 z-20 flex h-14 items-center justify-between border-b border-border/60 bg-card/95 px-4 backdrop-blur md:hidden">
        <Logo size="sm" />
        <div className="flex items-center gap-1">
          <ThemeToggle />
          <Button variant="ghost" size="icon" onClick={handleSignOut} aria-label="Sair">
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </header>

      {/* Main content */}
      <main
        className={cn(
          "min-h-screen pb-20 transition-all duration-200 md:pb-0",
          collapsed ? "md:pl-[60px]" : "md:pl-[240px]",
        )}
      >
        {children}
      </main>

      {/* Mobile bottom nav */}
      <nav className="fixed inset-x-0 bottom-0 z-30 flex h-16 items-center justify-around border-t border-border/60 bg-card/95 backdrop-blur md:hidden">
        {[...navItems, ...(isAdmin ? [{ to: "/admin", label: "Admin", icon: Shield } as NavItem] : [])].map((item) => {
          const Icon = item.icon;
          const active = isActive(item.to);
          return (
            <Link
              key={item.to}
              to={item.to}
              className={cn(
                "flex flex-1 flex-col items-center justify-center gap-0.5 px-1 py-1 text-[10px] font-medium transition-colors",
                active ? "text-primary" : "text-muted-foreground",
              )}
            >
              <Icon className={cn("h-5 w-5", active && "drop-shadow-[0_0_6px_hsl(var(--primary))]")} />
              <span className="truncate">{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
