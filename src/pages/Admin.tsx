import { useEffect, useMemo, useState } from "react";
import { Loader2, RefreshCw, Search, X, Copy, RotateCcw, ArrowUp, Ban, CalendarDays, CheckCircle2 } from "lucide-react";
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
import { Checkbox } from "@/components/ui/checkbox";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface UserRow {
  id: string;
  email: string;
  nome: string | null;
  telefone: string | null;
  telefone_verificado?: boolean | null;
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

const PROFILE_FIELD_LABELS: Record<string, string> = {
  telefone: "celular",
  cidade: "cidade",
  estado: "estado",
  sexo: "sexo",
  ano_nascimento: "ano de nascimento",
};

function profileCompleteness(u: UserRow) {
  const fields: (keyof UserRow)[] = ["telefone", "cidade", "estado", "sexo", "ano_nascimento"];
  const missing: string[] = [];
  let filled = 0;
  fields.forEach((f) => {
    const v = u[f];
    if (v !== null && v !== undefined && v !== "") filled += 1;
    else missing.push(PROFILE_FIELD_LABELS[f as string]);
  });
  const pct = (filled / fields.length) * 100;
  let color = "bg-destructive";
  if (filled >= 5) color = "bg-emerald-500";
  else if (filled >= 3) color = "bg-amber-500";
  return { filled, total: fields.length, pct, color, missing };
}

function initials(name: string | null | undefined, email: string) {
  const src = (name && name.trim()) || email;
  const parts = src.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return src.slice(0, 2).toUpperCase();
}

function avatarColor(p: EffectivePlan) {
  if (p === "pro") return "bg-emerald-500/20 text-emerald-500 ring-emerald-500/40";
  if (p === "trial") return "bg-sky-500/20 text-sky-500 ring-sky-500/40";
  return "bg-muted text-muted-foreground ring-border";
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
  const [stateFilter, setStateFilter] = useState<string>("all");
  const [trialExpiring, setTrialExpiring] = useState(false);
  const [missingPhone, setMissingPhone] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserRow | null>(null);

  const load = async () => {
    setLoading(true);
    const [{ data, error }, { data: an }] = await Promise.all([
      supabase.rpc("admin_list_users"),
      supabase.from("analises_geradas").select("user_id, created_at").order("created_at", { ascending: false }),
    ]);
    if (error) toast.error(error.message);
    const list = (data as UserRow[]) ?? [];
    setUsers(list);
    const map: Record<string, string> = {};
    (an ?? []).forEach((r: any) => {
      if (!map[r.user_id]) map[r.user_id] = r.created_at;
    });
    setLastAnalysis(map);
    setLoading(false);
    // keep selected user in sync after refresh
    setSelectedUser((prev) => (prev ? list.find((u) => u.id === prev.id) ?? null : null));
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

  const availableStates = useMemo(() => {
    const set = new Set<string>();
    users.forEach((u) => {
      if (u.estado) set.add(String(u.estado).toUpperCase());
    });
    return Array.from(set).sort();
  }, [users]);

  const advancedFiltersCount =
    (stateFilter !== "all" ? 1 : 0) + (trialExpiring ? 1 : 0) + (missingPhone ? 1 : 0);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return enriched.filter((u) => {
      if (filter !== "all" && u.effectivePlan !== filter) return false;
      if (q && !u.email.toLowerCase().includes(q)) return false;
      if (stateFilter !== "all" && String(u.estado || "").toUpperCase() !== stateFilter) return false;
      if (trialExpiring) {
        if (u.effectivePlan !== "trial") return false;
        const dl = u.dl ?? 999;
        if (dl > 3 || dl < 0) return false;
      }
      if (missingPhone && u.telefone && u.telefone.trim() !== "") return false;
      return true;
    });
  }, [enriched, filter, search, stateFilter, trialExpiring, missingPhone]);

  const updatePlan = async (
    userId: string,
    plano: "trial" | "pro" | "expired",
    trialExpiry?: string | null,
    closeDrawer = false,
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
    if (closeDrawer) setSelectedUser(null);
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
            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-2">
                  <Tabs value={filter} onValueChange={(v) => setFilter(v as FilterTab)}>
                    <TabsList>
                      <TabsTrigger value="all">Todos</TabsTrigger>
                      <TabsTrigger value="trial">Trial Ativo</TabsTrigger>
                      <TabsTrigger value="pro">Pro</TabsTrigger>
                      <TabsTrigger value="expired">Expirado</TabsTrigger>
                    </TabsList>
                  </Tabs>
                  {advancedFiltersCount > 0 && (
                    <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30">
                      {advancedFiltersCount} filtro{advancedFiltersCount > 1 ? "s" : ""} ativo{advancedFiltersCount > 1 ? "s" : ""}
                    </Badge>
                  )}
                </div>
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
              <div className="flex flex-wrap items-center gap-4 border-t border-border/60 pt-3">
                {availableStates.length > 0 && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">Estado:</span>
                    <Select value={stateFilter} onValueChange={setStateFilter}>
                      <SelectTrigger className="h-8 w-[120px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todos</SelectItem>
                        {availableStates.map((s) => (
                          <SelectItem key={s} value={s}>{s}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                <label className="flex cursor-pointer items-center gap-2 text-xs">
                  <Checkbox
                    checked={trialExpiring}
                    onCheckedChange={(v) => setTrialExpiring(Boolean(v))}
                  />
                  ⏰ Trial expirando em ≤ 3 dias
                </label>
                <label className="flex cursor-pointer items-center gap-2 text-xs">
                  <Checkbox
                    checked={missingPhone}
                    onCheckedChange={(v) => setMissingPhone(Boolean(v))}
                  />
                  📵 Sem celular cadastrado
                </label>
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
                      const pc = profileCompleteness(u);
                      return (
                        <TableRow
                          key={u.id}
                          className="cursor-pointer transition hover:bg-muted/40"
                          onClick={() => setSelectedUser(u)}
                        >
                          <TableCell className="font-medium">{u.email}</TableCell>
                          <TableCell>
                            <div className="space-y-1.5">
                              <div>{u.nome || "—"}</div>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <div
                                    className="h-[3px] w-20 overflow-hidden rounded-full bg-muted"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    <div
                                      className={`h-full ${pc.color} transition-all`}
                                      style={{ width: `${pc.pct}%` }}
                                    />
                                  </div>
                                </TooltipTrigger>
                                <TooltipContent side="top" className="text-xs">
                                  Perfil {Math.round(pc.pct)}% completo
                                  {pc.missing.length > 0 && ` — faltam: ${pc.missing.join(", ")}`}
                                </TooltipContent>
                              </Tooltip>
                            </div>
                          </TableCell>
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
                          <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
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
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </Card>
        </div>

        {/* User detail drawer */}
        <Sheet open={!!selectedUser} onOpenChange={(o) => !o && setSelectedUser(null)}>
          <SheetContent side="right" className="w-full overflow-y-auto p-0 sm:max-w-[420px]">
            {selectedUser && (
              <UserDetailPanel
                user={selectedUser}
                lastAnalysisAt={lastAnalysis[selectedUser.id] ?? null}
                onClose={() => setSelectedUser(null)}
                onAction={updatePlan}
              />
            )}
          </SheetContent>
        </Sheet>
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

function UserDetailPanel({
  user,
  lastAnalysisAt,
  onClose,
  onAction,
}: {
  user: UserRow;
  lastAnalysisAt: string | null;
  onClose: () => void;
  onAction: (
    userId: string,
    plano: "trial" | "pro" | "expired",
    trialExpiry?: string | null,
    closeDrawer?: boolean,
  ) => void;
}) {
  const plan = effectivePlanOf(user);
  const badge = planBadge(user);
  const idade = user.ano_nascimento ? new Date().getFullYear() - Number(user.ano_nascimento) : null;
  const diasCliente = daysSince(user.created_at) ?? 0;
  const phoneVerified = !!user.telefone_verificado;

  const copyEmail = async () => {
    try {
      await navigator.clipboard.writeText(user.email);
      toast.success("E-mail copiado");
    } catch {
      toast.error("Não foi possível copiar");
    }
  };

  const timeline: { icon: string; label: string; date: string }[] = [];
  if (plan === "pro") timeline.push({ icon: "✅", label: "Plano Pro ativo", date: formatDate(user.created_at) });
  if (user.trial_expira_em) timeline.push({ icon: "🔁", label: "Trial até", date: formatDate(user.trial_expira_em) });
  timeline.push({ icon: "📅", label: "Cadastro", date: formatDate(user.created_at) });
  const recentEvents = timeline.slice(0, 3);

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 border-b border-border/60 p-5">
        <div className="flex items-center gap-3">
          <div className={`flex h-12 w-12 items-center justify-center rounded-full ring-2 ${avatarColor(plan)} font-semibold`}>
            {initials(user.nome, user.email)}
          </div>
          <div>
            <p className="font-display text-base font-semibold leading-tight">{user.nome || "Sem nome"}</p>
            <div className="mt-1">
              <Badge variant="outline" className={badge.cls}>{badge.label}</Badge>
            </div>
          </div>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8">
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Identification */}
      <Section title="Identificação">
        <Row label="E-mail" value={user.email} />
        <Row
          label="Celular"
          value={
            <div className="flex items-center gap-2">
              <span>{user.telefone || "—"}</span>
              {user.telefone && (
                <Badge
                  variant="outline"
                  className={
                    phoneVerified
                      ? "bg-emerald-500/15 text-emerald-500 border-emerald-500/30"
                      : "bg-amber-500/15 text-amber-500 border-amber-500/30"
                  }
                >
                  {phoneVerified ? "Verificado ✓" : "Não verificado"}
                </Badge>
              )}
            </div>
          }
        />
        <Row label="Cidade / Estado" value={[user.cidade, user.estado].filter(Boolean).join(" / ") || "—"} />
        <Row label="Sexo" value={user.sexo || "—"} />
        <Row label="Idade" value={idade ? `${idade} anos` : "—"} />
      </Section>

      {/* Subscription */}
      <Section title="Assinatura">
        <Row label="Plano atual" value={badge.label} />
        <Row label="Cadastro" value={formatDate(user.created_at)} />
        <Row label="Vencimento trial" value={formatDate(user.trial_expira_em)} />
        <Row label="Dias como cliente" value={`${diasCliente} dias`} />
        <Row label="Última análise IA" value={formatDate(lastAnalysisAt)} />
      </Section>

      {/* Actions */}
      <Section title="Ações rápidas">
        <div className="space-y-2">
          <ActionButton
            icon={<Copy className="h-4 w-4" />}
            label="Copiar e-mail para followup"
            tip="Use para enviar followup manual quando o trial estiver expirando em menos de 3 dias"
            onClick={copyEmail}
          />
          <ActionButton
            icon={<RotateCcw className="h-4 w-4" />}
            label="Resetar Trial"
            tip="Reativa o período de trial por mais 7 dias"
            onClick={() =>
              onAction(user.id, "trial", new Date(Date.now() + 7 * 86_400_000).toISOString(), true)
            }
          />
          <ActionButton
            icon={<ArrowUp className="h-4 w-4" />}
            label="Ativar Pro"
            tip="Ativa o plano Pro manualmente sem cobrança"
            disabled={plan === "pro"}
            onClick={() => onAction(user.id, "pro", null, true)}
          />
          <ActionButton
            icon={<Ban className="h-4 w-4" />}
            label="Desativar conta"
            tip="Desativa o acesso do usuário à plataforma"
            disabled={plan === "expired"}
            danger
            onClick={() => onAction(user.id, "expired", null, true)}
          />
        </div>
      </Section>

      {/* Timeline */}
      <Section title="Histórico recente" last>
        <ul className="space-y-2">
          {recentEvents.map((e, i) => (
            <li key={i} className="flex items-center justify-between rounded-md border border-border/60 bg-muted/20 px-3 py-2 text-sm">
              <span className="flex items-center gap-2">
                <span>{e.icon}</span>
                <span>{e.label}</span>
              </span>
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <CalendarDays className="h-3 w-3" /> {e.date}
              </span>
            </li>
          ))}
        </ul>
      </Section>
    </div>
  );
}

function Section({ title, children, last }: { title: string; children: React.ReactNode; last?: boolean }) {
  return (
    <div className={`px-5 py-4 ${last ? "" : "border-b border-border/60"}`}>
      <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</p>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium">{value}</span>
    </div>
  );
}

function ActionButton({
  icon,
  label,
  tip,
  onClick,
  disabled,
  danger,
}: {
  icon: React.ReactNode;
  label: string;
  tip: string;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="outline"
          className={`w-full justify-start ${danger ? "border-destructive/40 text-destructive hover:bg-destructive/10" : ""}`}
          disabled={disabled}
          onClick={onClick}
        >
          <span className="mr-2">{icon}</span>
          {label}
        </Button>
      </TooltipTrigger>
      <TooltipContent side="left" className="max-w-[240px] text-xs">
        {tip}
      </TooltipContent>
    </Tooltip>
  );
}
