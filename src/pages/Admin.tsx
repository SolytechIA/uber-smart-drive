import { useEffect, useMemo, useState } from "react";
import { Loader2, RefreshCw, Search } from "lucide-react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip as RTooltip,
  CartesianGrid,
  Legend,
} from "recharts";
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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface UserRow {
  id: string;
  email: string;
  nome: string | null;
  telefone: string | null;
  cidade: string | null;
  estado: string | null;
  sexo: string | null;
  ano_nascimento: number | null;
  plano: string;
  trial_expira_em: string | null;
  created_at: string;
  is_admin: boolean;
  ativo: boolean;
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

function daysSince(d: string | null) {
  if (!d) return null;
  const ms = Date.now() - new Date(d).getTime();
  return Math.max(0, Math.floor(ms / 86_400_000));
}

type EffectivePlan = "pro" | "trial" | "expired" | "inactive";

function effectivePlanOf(u: UserRow): EffectivePlan {
  if (u.ativo === false) return "inactive";
  if (u.plano === "pro") return "pro";
  if (u.plano === "expired") return "expired";
  const dl = daysLeft(u.trial_expira_em) ?? 0;
  return dl <= 0 ? "expired" : "trial";
}

function planBadge(u: UserRow): { label: string; cls: string } {
  const p = effectivePlanOf(u);
  if (p === "pro") return { label: "Pro ✓", cls: "bg-emerald-500/15 text-emerald-500 border-emerald-500/30" };
  if (p === "inactive") return { label: "Inativo", cls: "bg-muted text-muted-foreground border-border" };
  if (p === "trial") {
    const dl = daysLeft(u.trial_expira_em) ?? 0;
    return { label: `Trial (${dl}d)`, cls: "bg-sky-500/15 text-sky-500 border-sky-500/30" };
  }
  const since = daysSince(u.trial_expira_em);
  return {
    label: since !== null ? `Expirado há ${since}d` : "Expirado",
    cls: "bg-destructive/15 text-destructive border-destructive/30",
  };
}

type FilterTab = "all" | "trial" | "pro" | "expired";
type Months = 3 | 6 | 12;

const MONTH_LABELS = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

export default function Admin() {
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [lastAnalysis, setLastAnalysis] = useState<Record<string, string>>({});
  const [filter, setFilter] = useState<FilterTab>("all");
  const [search, setSearch] = useState("");
  const [months, setMonths] = useState<Months>(6);

  const load = async () => {
    setLoading(true);
    const [{ data, error }, { data: an }] = await Promise.all([
      supabase.rpc("admin_list_users"),
      supabase.from("analises_geradas").select("user_id, created_at").order("created_at", { ascending: false }),
    ]);
    if (error) toast.error(error.message);
    setUsers((data as UserRow[]) ?? []);
    const map: Record<string, string> = {};
    (an ?? []).forEach((r: any) => {
      if (!map[r.user_id]) map[r.user_id] = r.created_at;
    });
    setLastAnalysis(map);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const enriched = useMemo(
    () => users.map((u) => ({ ...u, effectivePlan: effectivePlanOf(u), dl: daysLeft(u.trial_expira_em) })),
    [users],
  );

  const stats = useMemo(() => {
    const total = enriched.length;
    const trialActive = enriched.filter((u) => u.effectivePlan === "trial").length;
    const pro = enriched.filter((u) => u.effectivePlan === "pro").length;
    const expired = enriched.filter((u) => u.effectivePlan === "expired").length;
    const conversionBase = pro + expired;
    const conversion = conversionBase > 0 ? (pro / conversionBase) * 100 : 0;
    const mrr = pro * PRO_PRICE;
    const arr = mrr * 12;
    const cutoff = Date.now() - 30 * 86_400_000;
    const churn = enriched.filter((u) => {
      if (u.effectivePlan !== "expired" && u.effectivePlan !== "inactive") return false;
      const t = u.trial_expira_em ? new Date(u.trial_expira_em).getTime() : 0;
      return t >= cutoff && t <= Date.now();
    }).length;
    return { total, trialActive, pro, expired, conversion, mrr, arr, churn };
  }, [enriched]);

  const chartData = useMemo(() => {
    const now = new Date();
    const buckets: { key: string; label: string; total: number; pro: number; trial: number; mrr: number }[] = [];
    for (let i = months - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      buckets.push({
        key: `${d.getFullYear()}-${d.getMonth()}`,
        label: `${MONTH_LABELS[d.getMonth()]}/${String(d.getFullYear()).slice(2)}`,
        total: 0,
        pro: 0,
        trial: 0,
        mrr: 0,
      });
    }
    const idxByKey = new Map(buckets.map((b, i) => [b.key, i]));
    enriched.forEach((u) => {
      const d = new Date(u.created_at);
      const k = `${d.getFullYear()}-${d.getMonth()}`;
      const idx = idxByKey.get(k);
      if (idx === undefined) return;
      buckets[idx].total += 1;
      if (u.effectivePlan === "pro") {
        buckets[idx].pro += 1;
        buckets[idx].mrr += PRO_PRICE;
      } else if (u.effectivePlan === "trial") {
        buckets[idx].trial += 1;
      }
    });
    return buckets;
  }, [enriched, months]);

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
    trialExpiry?: string | null,
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

  const fmtMoney = (n: number) =>
    `R$ ${n.toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

  return (
    <AppLayout>
      <TooltipProvider delayDuration={150}>
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

          {/* KPIs */}
          <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:overflow-visible sm:px-0">
            <div className="grid min-w-[860px] grid-cols-4 gap-3 sm:min-w-0 lg:grid-cols-4">
              <MetricCard label="Usuários cadastrados" value={stats.total} />
              <MetricCard label="Trials ativos" value={stats.trialActive} accent="text-sky-500" />
              <MetricCard label="Planos Pro ativos" value={stats.pro} accent="text-emerald-500" />
              <MetricCard label="Trials expirados" value={stats.expired} accent="text-destructive" />
            </div>
            <div className="mt-3 grid min-w-[860px] grid-cols-4 gap-3 sm:min-w-0 lg:grid-cols-4">
              <MetricCard label="MRR estimado" value={fmtMoney(stats.mrr)} accent="text-emerald-500" />
              <MetricCard label="Conversão Trial→Pro" value={`${stats.conversion.toFixed(1)}%`} />
              <MetricCard label="Churn (30d)" value={stats.churn} accent="text-amber-500" />
              <MetricCard label="ARR projetado" value={fmtMoney(stats.arr)} accent="text-emerald-500" />
            </div>
          </div>

          {/* Charts */}
          <Card className="p-5">
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <h2 className="font-display text-lg font-semibold">Métricas &amp; Evolução</h2>
              <div className="flex gap-1 rounded-full border border-border/60 bg-muted/30 p-1">
                {([3, 6, 12] as Months[]).map((m) => (
                  <button
                    key={m}
                    onClick={() => setMonths(m)}
                    className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                      months === m
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {m} meses
                  </button>
                ))}
              </div>
            </div>
            <div className="grid gap-6 lg:grid-cols-2">
              <div>
                <p className="mb-2 text-xs text-muted-foreground">Evolução de usuários</p>
                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="label" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                      <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} />
                      <RTooltip
                        contentStyle={{
                          background: "hsl(var(--popover))",
                          border: "1px solid hsl(var(--border))",
                          borderRadius: 8,
                          fontSize: 12,
                        }}
                      />
                      <Legend wrapperStyle={{ fontSize: 12 }} />
                      <Line type="monotone" dataKey="total" name="Total" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
                      <Line type="monotone" dataKey="pro" name="Pro" stroke="#10b981" strokeWidth={2} dot={false} />
                      <Line type="monotone" dataKey="trial" name="Trial" stroke="#0ea5e9" strokeWidth={2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
              <div>
                <p className="mb-2 text-xs text-muted-foreground">Receita mensal (MRR)</p>
                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData}>
                      <defs>
                        <linearGradient id="mrrGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#10b981" stopOpacity={0.95} />
                          <stop offset="100%" stopColor="#10b981" stopOpacity={0.45} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="label" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                      <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} />
                      <RTooltip
                        formatter={(v: number) => fmtMoney(v)}
                        contentStyle={{
                          background: "hsl(var(--popover))",
                          border: "1px solid hsl(var(--border))",
                          borderRadius: 8,
                          fontSize: 12,
                        }}
                      />
                      <Bar dataKey="mrr" name="MRR" fill="url(#mrrGrad)" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          </Card>

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
                      <TableHead>Cidade/UF</TableHead>
                      <TableHead>Celular</TableHead>
                      <TableHead>Última análise</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={10} className="py-10 text-center text-muted-foreground">
                          Nenhum usuário encontrado.
                        </TableCell>
                      </TableRow>
                    )}
                    {filtered.map((u) => {
                      const v = planBadge(u);
                      const cidadeUf = [u.cidade, u.estado].filter(Boolean).join(" / ") || "—";
                      const last = lastAnalysis[u.id];
                      const idade = u.ano_nascimento
                        ? new Date().getFullYear() - Number(u.ano_nascimento)
                        : null;
                      const row = (
                        <TableRow key={u.id} className="cursor-default">
                          <TableCell className="font-medium">{u.email}</TableCell>
                          <TableCell>{u.nome || "—"}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className={v.cls}>{v.label}</Badge>
                          </TableCell>
                          <TableCell>{formatDate(u.created_at)}</TableCell>
                          <TableCell>{formatDate(u.trial_expira_em)}</TableCell>
                          <TableCell>
                            {u.effectivePlan === "trial" && u.dl !== null ? `${u.dl}d` : "—"}
                          </TableCell>
                          <TableCell>{cidadeUf}</TableCell>
                          <TableCell>{u.telefone || "—"}</TableCell>
                          <TableCell>{formatDate(last ?? null)}</TableCell>
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
                                    new Date(Date.now() + 7 * 86_400_000).toISOString(),
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
                      return (
                        <Tooltip key={u.id}>
                          <TooltipTrigger asChild>{row}</TooltipTrigger>
                          <TooltipContent side="top" className="max-w-xs text-xs">
                            <div className="space-y-0.5">
                              <div><strong>Nome:</strong> {u.nome || "—"}</div>
                              <div><strong>Email:</strong> {u.email}</div>
                              <div><strong>Plano:</strong> {v.label}</div>
                              <div><strong>Cidade:</strong> {cidadeUf}</div>
                              <div><strong>Celular:</strong> {u.telefone || "—"}</div>
                              <div><strong>Sexo:</strong> {u.sexo || "—"}</div>
                              <div><strong>Idade:</strong> {idade ? `${idade} anos` : "—"}</div>
                            </div>
                          </TooltipContent>
                        </Tooltip>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </Card>
        </div>
      </TooltipProvider>
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
