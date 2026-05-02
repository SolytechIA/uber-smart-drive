import { useEffect, useMemo, useState } from "react";
import { Loader2, RefreshCw, Search } from "lucide-react";
import { AppLayout } from "@/components/AppLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface UserRow {
  id: string;
  email: string;
  nome: string | null;
  plano: string;
  trial_expira_em: string | null;
  created_at: string;
  is_admin: boolean;
}

const PRO_PRICE = 37;

function formatDate(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("pt-BR");
}

function daysLeft(d: string | null) {
  if (!d) return null;
  const ms = new Date(d).getTime() - Date.now();
  return Math.ceil(ms / 86_400_000);
}

function planVariant(plano: string, expiry: string | null): { label: string; cls: string } {
  if (plano === "pro") return { label: "Pro", cls: "bg-emerald-500/15 text-emerald-500" };
  if (plano === "expired") return { label: "Expirado", cls: "bg-destructive/15 text-destructive" };
  const dl = daysLeft(expiry) ?? 0;
  if (dl <= 0) return { label: "Expirado", cls: "bg-destructive/15 text-destructive" };
  return { label: "Trial", cls: "bg-amber-500/15 text-amber-600 dark:text-amber-400" };
}

type FilterTab = "all" | "trial" | "pro" | "expired";

export default function Admin() {
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [filter, setFilter] = useState<FilterTab>("all");
  const [search, setSearch] = useState("");

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase.rpc("admin_list_users");
    if (error) toast.error(error.message);
    setUsers((data as UserRow[]) ?? []);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const enriched = useMemo(
    () =>
      users.map((u) => {
        const dl = daysLeft(u.trial_expira_em);
        const effectivePlan =
          u.plano === "trial" && dl !== null && dl <= 0 ? "expired" : u.plano;
        return { ...u, effectivePlan, dl };
      }),
    [users]
  );

  const stats = useMemo(() => {
    const total = enriched.length;
    const trialActive = enriched.filter((u) => u.effectivePlan === "trial").length;
    const pro = enriched.filter((u) => u.effectivePlan === "pro").length;
    const expired = enriched.filter((u) => u.effectivePlan === "expired").length;
    const conversionBase = pro + expired;
    const conversion = conversionBase > 0 ? (pro / conversionBase) * 100 : 0;
    const mrr = pro * PRO_PRICE;
    return { total, trialActive, pro, expired, conversion, mrr };
  }, [enriched]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return enriched.filter((u) => {
      if (filter !== "all" && u.effectivePlan !== filter) return false;
      if (q && !u.email.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [enriched, filter, search]);

  const updatePlan = async (
    userId: string,
    plano: "trial" | "pro" | "expired",
    trialExpiry?: string | null
  ) => {
    const { error } = await supabase.rpc("admin_update_user_plan", {
      target_user_id: userId,
      new_plano: plano,
      new_trial_expiry: trialExpiry ?? null,
    });
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Plano atualizado");
    load();
  };

  return (
    <AppLayout>
      <div className="mx-auto max-w-7xl space-y-6 px-4 py-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-display text-2xl font-bold">Painel Administrativo</h1>
            <p className="text-sm text-muted-foreground">Gestão de usuários e planos</p>
          </div>
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Atualizar
          </Button>
        </div>

        {/* Metrics */}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
          <MetricCard label="Usuários" value={stats.total} />
          <MetricCard label="Trial ativo" value={stats.trialActive} accent="text-amber-500" />
          <MetricCard label="Pro" value={stats.pro} accent="text-emerald-500" />
          <MetricCard label="Trials expirados" value={stats.expired} accent="text-destructive" />
          <MetricCard
            label="Conversão Trial→Pro"
            value={`${stats.conversion.toFixed(1)}%`}
          />
          <MetricCard
            label="MRR estimado"
            value={`R$ ${stats.mrr.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`}
            accent="text-primary"
          />
        </div>

        {/* Filters */}
        <Card className="p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <Tabs value={filter} onValueChange={(v) => setFilter(v as FilterTab)}>
              <TabsList>
                <TabsTrigger value="all">Todos</TabsTrigger>
                <TabsTrigger value="trial">Trial Ativo</TabsTrigger>
                <TabsTrigger value="pro">Pro</TabsTrigger>
                <TabsTrigger value="expired">Expirado</TabsTrigger>
              </TabsList>
            </Tabs>
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar por e-mail"
                className="pl-8"
              />
            </div>
          </div>
        </Card>

        {/* Table */}
        <Card className="overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Email</TableHead>
                    <TableHead>Nome</TableHead>
                    <TableHead>Plano</TableHead>
                    <TableHead>Cadastro</TableHead>
                    <TableHead>Trial expiry</TableHead>
                    <TableHead>Dias restantes</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7} className="py-10 text-center text-muted-foreground">
                        Nenhum usuário encontrado.
                      </TableCell>
                    </TableRow>
                  )}
                  {filtered.map((u) => {
                    const v = planVariant(u.effectivePlan, u.trial_expira_em);
                    return (
                      <TableRow key={u.id}>
                        <TableCell className="font-medium">{u.email}</TableCell>
                        <TableCell>{u.nome || "—"}</TableCell>
                        <TableCell>
                          <Badge className={`${v.cls} hover:${v.cls}`}>{v.label}</Badge>
                        </TableCell>
                        <TableCell>{formatDate(u.created_at)}</TableCell>
                        <TableCell>{formatDate(u.trial_expira_em)}</TableCell>
                        <TableCell>
                          {u.effectivePlan === "trial" && u.dl !== null ? `${u.dl}d` : "—"}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex flex-wrap justify-end gap-1">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => updatePlan(u.id, "pro")}
                              disabled={u.effectivePlan === "pro"}
                            >
                              Ativar Pro
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() =>
                                updatePlan(
                                  u.id,
                                  "trial",
                                  new Date(Date.now() + 7 * 86_400_000).toISOString()
                                )
                              }
                            >
                              Resetar Trial
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => updatePlan(u.id, "expired")}
                              disabled={u.effectivePlan === "expired"}
                            >
                              Desativar
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </Card>
      </div>
    </AppLayout>
  );
}

function MetricCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: string | number;
  accent?: string;
}) {
  return (
    <Card className="p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`mt-1 text-2xl font-bold ${accent ?? ""}`}>{value}</p>
    </Card>
  );
}
