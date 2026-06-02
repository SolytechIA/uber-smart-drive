import { useEffect, useMemo, useState } from "react";
import { eachDayOfInterval, format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Inbox } from "lucide-react";
import {
  ResponsiveContainer,
  LineChart, Line,
  BarChart, Bar,
  AreaChart, Area,
  PieChart, Pie, Cell, Legend,
  XAxis, YAxis, CartesianGrid,
  Tooltip as RTooltip,
} from "recharts";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PeriodFilter, getPeriodRange, type Periodo } from "@/components/PeriodFilter";
import { ChartTooltip } from "@/components/ChartTooltip";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { fmtBRL } from "@/lib/financeiro";
import { plataformaColor } from "@/lib/plataformas";

interface RideRow {
  id: string;
  data_corrida: string | null;
  horario_inicio: string | null;
  valor_bruto: number | null;
  plataforma: string | null;
  km_total: number | null;
}

interface LancRow {
  id: string;
  tipo: "ganho" | "custo";
  conta: string;
  valor: number;
  data: string;
}

const COST_PALETTE = ["#ef4444", "#f97316", "#f59e0b", "#dc2626", "#ea580c", "#c2410c", "#b91c1c", "#9a3412", "#7c2d12", "#fb923c"];

const CONTA_TO_PLAT: Record<string, string> = {
  "Ganhos Uber": "Uber",
  "Ganhos 99": "99",
  "Ganhos InDrive": "InDrive",
  "Particular": "Particular",
  "Gorjetas": "Outras",
  "Outras Receitas Diversas": "Outras",
  "Transfers": "Outras",
};

function rideDateKey(r: RideRow): string | null {
  return r.data_corrida ?? (r.horario_inicio ? r.horario_inicio.slice(0, 10) : null);
}

function EmptyState({ msg = "Nenhum dado para este período" }: { msg?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
      <Inbox className="h-10 w-10 mb-2 opacity-50" />
      <p className="text-sm">{msg}</p>
    </div>
  );
}

const tooltipStyle = {
  background: "hsl(var(--card))",
  border: "1px solid hsl(var(--border))",
  borderRadius: 8,
  fontSize: 12,
};

export default function GraficosFinanceiros() {
  const { user } = useAuth();
  const [periodo, setPeriodo] = useState<Periodo>("mes");
  const [custom, setCustom] = useState<{ from: Date; to: Date } | undefined>();
  const [rides, setRides] = useState<RideRow[]>([]);
  const [lancs, setLancs] = useState<LancRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    (async () => {
      setLoading(true);
      const [r, l] = await Promise.all([
        supabase.from("rides")
          .select("id,data_corrida,horario_inicio,valor_bruto,plataforma,km_total")
          .eq("user_id", user.id).limit(5000),
        supabase.from("lancamentos" as any)
          .select("id,tipo,conta,valor,data")
          .eq("user_id", user.id).limit(5000),
      ]);
      setRides((r.data as RideRow[]) || []);
      setLancs((l.data as any[] as LancRow[]) || []);
      setLoading(false);
    })();
  }, [user]);

  const range = useMemo(() => getPeriodRange(periodo, custom), [periodo, custom]);
  const fromStr = format(range.from, "yyyy-MM-dd");
  const toStr = format(range.to, "yyyy-MM-dd");

  const ridesIn = useMemo(
    () => rides.filter((r) => { const d = rideDateKey(r); return d && d >= fromStr && d <= toStr; }),
    [rides, fromStr, toStr],
  );
  const lancsIn = useMemo(
    () => lancs.filter((l) => l.data >= fromStr && l.data <= toStr),
    [lancs, fromStr, toStr],
  );

  // Series por dia + cumulativo (com forward-fill em dias sem movimento)
  const daySeries = useMemo(() => {
    let actualFrom = range.from;
    let actualTo = range.to;
    if (periodo === "acumulado") {
      const dates = [...ridesIn.map(r => rideDateKey(r)!), ...lancsIn.map(l => l.data)].filter(Boolean).sort();
      if (dates.length) {
        actualFrom = parseISO(dates[0]);
        actualTo = parseISO(dates[dates.length - 1]);
      } else {
        return [];
      }
    }
    const days = eachDayOfInterval({ start: actualFrom, end: actualTo });
    const aggregateByMonth = days.length > 90;
    const bucketKey = (dateStr: string) => aggregateByMonth ? dateStr.slice(0, 7) : dateStr;
    const bucketLabel = (key: string) =>
      aggregateByMonth ? key : format(parseISO(key), "dd/MM", { locale: ptBR });

    const map: Record<string, { key: string; label: string; bruto: number; custo: number; liquido: number }> = {};
    if (aggregateByMonth) {
      for (const d of days) {
        const k = format(d, "yyyy-MM");
        if (!map[k]) map[k] = { key: k, label: k, bruto: 0, custo: 0, liquido: 0 };
      }
    } else {
      for (const d of days) {
        const k = format(d, "yyyy-MM-dd");
        map[k] = { key: k, label: format(d, "dd/MM", { locale: ptBR }), bruto: 0, custo: 0, liquido: 0 };
      }
    }
    for (const r of ridesIn) {
      const d = rideDateKey(r); if (!d) continue;
      const k = bucketKey(d);
      if (!map[k]) map[k] = { key: k, label: bucketLabel(k), bruto: 0, custo: 0, liquido: 0 };
      map[k].bruto += Number(r.valor_bruto || 0);
    }
    for (const l of lancsIn) {
      const k = bucketKey(l.data);
      if (!map[k]) map[k] = { key: k, label: bucketLabel(k), bruto: 0, custo: 0, liquido: 0 };
      if (l.tipo === "ganho") map[k].bruto += Number(l.valor);
      else map[k].custo += Number(l.valor);
    }
    const sorted = Object.values(map).sort((a, b) => a.key.localeCompare(b.key));
    // cumulative + forward fill
    let cBruto = 0, cCusto = 0;
    return sorted.map((v) => {
      cBruto += v.bruto;
      cCusto += v.custo;
      return {
        ...v,
        liquido: v.bruto - v.custo,
        brutoAcum: cBruto,
        custoAcum: cCusto,
        liquidoAcum: cBruto - cCusto,
      };
    });
  }, [range, ridesIn, lancsIn, periodo]);

  // Ganhos por plataforma
  const ganhosPorPlat = useMemo(() => {
    const map: Record<string, number> = {};
    for (const r of ridesIn) {
      const p = r.plataforma || "Outras";
      map[p] = (map[p] || 0) + Number(r.valor_bruto || 0);
    }
    for (const l of lancsIn.filter(x => x.tipo === "ganho")) {
      const p = CONTA_TO_PLAT[l.conta] || "Outras";
      map[p] = (map[p] || 0) + Number(l.valor);
    }
    const total = Object.values(map).reduce((a,b) => a+b, 0);
    return Object.entries(map)
      .filter(([_,v]) => v > 0)
      .sort((a, b) => b[1] - a[1])
      .map(([name, value]) => ({
        name, value, pct: total > 0 ? (value/total)*100 : 0, color: plataformaColor(name),
      }));
  }, [ridesIn, lancsIn]);

  // Custos por conta
  const custosPorConta = useMemo(() => {
    const map: Record<string, number> = {};
    for (const l of lancsIn.filter(x => x.tipo === "custo")) {
      map[l.conta] = (map[l.conta] || 0) + Number(l.valor);
    }
    const total = Object.values(map).reduce((a,b) => a+b, 0);
    return Object.entries(map)
      .filter(([_,v]) => v > 0)
      .sort((a, b) => b[1] - a[1])
      .map(([name, value], i) => ({
        name, value, pct: total > 0 ? (value/total)*100 : 0, color: COST_PALETTE[i % COST_PALETTE.length],
      }));
  }, [lancsIn]);

  // Ticket médio por plataforma
  const ticketPorPlat = useMemo(() => {
    const map: Record<string, { total: number; n: number }> = {};
    for (const r of ridesIn) {
      const p = r.plataforma || "Outras";
      if (!map[p]) map[p] = { total: 0, n: 0 };
      map[p].total += Number(r.valor_bruto || 0);
      map[p].n += 1;
    }
    return Object.entries(map).filter(([_,v]) => v.n > 0).map(([name, v]) => ({
      name, ticket: v.total / v.n, color: plataformaColor(name),
    })).sort((a,b) => b.ticket - a.ticket);
  }, [ridesIn]);

  const combVsBrutoData = useMemo(() => {
    const combByDay: Record<string, number> = {};
    for (const l of lancsIn) {
      if (l.tipo === "custo" && l.conta === "Combustível") {
        combByDay[l.data] = (combByDay[l.data] || 0) + Number(l.valor);
      }
    }
    const brutoByDay: Record<string, number> = {};
    for (const r of ridesIn) {
      const d = rideDateKey(r); if (!d) continue;
      brutoByDay[d] = (brutoByDay[d] || 0) + Number(r.valor_bruto || 0);
    }
    for (const l of lancsIn.filter(x => x.tipo === "ganho")) {
      brutoByDay[l.data] = (brutoByDay[l.data] || 0) + Number(l.valor);
    }
    const allDates = [...new Set([...Object.keys(combByDay), ...Object.keys(brutoByDay)])].sort();
    return allDates.map(d => ({
      label: format(parseISO(d), "dd/MM", { locale: ptBR }),
      combustivel: combByDay[d] || 0,
      bruto: brutoByDay[d] || 0,
    }));
  }, [ridesIn, lancsIn]);

  const hasAny = ridesIn.length > 0 || lancsIn.length > 0;

  return (
    <AppLayout>
      <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-display font-bold">Gráficos Financeiros</h1>
          <p className="text-muted-foreground text-sm mt-1">Visualizações analíticas de ganhos, custos e lucro líquido.</p>
        </div>

        <PeriodFilter periodo={periodo} custom={custom} onChange={(p, c) => { setPeriodo(p); setCustom(c); }} />

        {loading ? (
          <Card><CardContent className="py-12 text-center text-muted-foreground">Carregando…</CardContent></Card>
        ) : !hasAny ? (
          <Card><CardContent><EmptyState /></CardContent></Card>
        ) : (
          <div className="space-y-6">
            <Card>
              <CardHeader><CardTitle className="text-base">📈 Evolução do Resultado Financeiro (acumulado)</CardTitle></CardHeader>
              <CardContent>
                {daySeries.length === 0 ? <EmptyState /> : (
                  <div className="h-72 w-full">
                    <ResponsiveContainer>
                      <LineChart data={daySeries}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis dataKey="label" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                        <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} tickFormatter={(v) => `R$${v}`} />
                        <RTooltip content={<ChartTooltip formatter={(v) => fmtBRL(v)} />} />
                        <Legend wrapperStyle={{ fontSize: 12 }} />
                        <Line type="monotone" name="Receita Bruta" dataKey="brutoAcum" stroke="#10b981" strokeWidth={2} dot={false} />
                        <Line type="monotone" name="Despesa Total" dataKey="custoAcum" stroke="#ef4444" strokeWidth={2} dot={false} />
                        <Line type="monotone" name="Resultado Líquido" dataKey="liquidoAcum" stroke="#3b82f6" strokeWidth={2} dot={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                )}
                <p className="text-xs text-muted-foreground mt-2">Valores acumulados ao longo do período — dias sem movimentação mantêm o último valor.</p>
              </CardContent>
            </Card>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader><CardTitle className="text-base">🍩 Composição de Receita por Plataforma</CardTitle></CardHeader>
                <CardContent>
                  {ganhosPorPlat.length === 0 ? <EmptyState /> : (
                    <>
                      <div className="h-64 w-full">
                        <ResponsiveContainer>
                          <PieChart>
                            <Pie data={ganhosPorPlat} dataKey="value" nameKey="name" innerRadius={50} outerRadius={90} paddingAngle={2}>
                              {ganhosPorPlat.map((e, i) => <Cell key={i} fill={e.color} />)}
                            </Pie>
                            <RTooltip content={<ChartTooltip formatter={(v) => fmtBRL(v)} />} />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                      <ul className="mt-3 space-y-1 text-xs">
                        {ganhosPorPlat.map(e => (
                          <li key={e.name} className="flex items-center gap-2">
                            <span className="inline-block w-3 h-3 rounded-sm" style={{ background: e.color }} />
                            <span className="flex-1 truncate">{e.name}</span>
                            <span className="tabular-nums">{fmtBRL(e.value)}</span>
                            <span className="text-muted-foreground tabular-nums">{e.pct.toFixed(1)}%</span>
                          </li>
                        ))}
                      </ul>
                    </>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle className="text-base">🍩 Composição de Despesas por Conta</CardTitle></CardHeader>
                <CardContent>
                  {custosPorConta.length === 0 ? <EmptyState /> : (
                    <>
                      <div className="h-64 w-full">
                        <ResponsiveContainer>
                          <PieChart>
                            <Pie data={custosPorConta} dataKey="value" nameKey="name" innerRadius={50} outerRadius={90} paddingAngle={2}>
                              {custosPorConta.map((e, i) => <Cell key={i} fill={e.color} />)}
                            </Pie>
                            <RTooltip content={<ChartTooltip formatter={(v) => fmtBRL(v)} />} />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                      <ul className="mt-3 space-y-1 text-xs">
                        {custosPorConta.map(e => (
                          <li key={e.name} className="flex items-center gap-2">
                            <span className="inline-block w-3 h-3 rounded-sm" style={{ background: e.color }} />
                            <span className="flex-1 truncate">{e.name}</span>
                            <span className="tabular-nums">{fmtBRL(e.value)}</span>
                            <span className="text-muted-foreground tabular-nums">{e.pct.toFixed(1)}%</span>
                          </li>
                        ))}
                      </ul>
                    </>
                  )}
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader><CardTitle className="text-base">📊 Receita vs Despesa vs Resultado Líquido (acumulado)</CardTitle></CardHeader>
              <CardContent>
                {daySeries.length === 0 ? <EmptyState /> : (
                  <div className="h-72 w-full">
                    <ResponsiveContainer>
                      <AreaChart data={daySeries}>
                        <defs>
                          <linearGradient id="gradBruto" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#10b981" stopOpacity={0.4} />
                            <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
                          </linearGradient>
                          <linearGradient id="gradCusto" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#ef4444" stopOpacity={0.35} />
                            <stop offset="100%" stopColor="#ef4444" stopOpacity={0} />
                          </linearGradient>
                          <linearGradient id="gradLiq" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.35} />
                            <stop offset="100%" stopColor="#3b82f6" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis dataKey="label" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                        <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} tickFormatter={(v) => `R$${v}`} />
                        <RTooltip content={<ChartTooltip formatter={(v) => fmtBRL(v)} />} />
                        <Legend wrapperStyle={{ fontSize: 12 }} />
                        <Area type="monotone" name="Receita Bruta" dataKey="brutoAcum" stroke="#10b981" strokeWidth={2} fill="url(#gradBruto)" />
                        <Area type="monotone" name="Despesa Total" dataKey="custoAcum" stroke="#ef4444" strokeWidth={2} fill="url(#gradCusto)" />
                        <Area type="monotone" name="Resultado Líquido" dataKey="liquidoAcum" stroke="#3b82f6" strokeWidth={2} fill="url(#gradLiq)" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                )}
                <p className="text-xs text-muted-foreground mt-2">Visão acumulada otimizada para leitura no celular.</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-base">🎯 Ticket Médio por Plataforma</CardTitle></CardHeader>
              <CardContent>
                {ticketPorPlat.length === 0 ? <EmptyState /> : (
                  <div className="w-full" style={{ height: Math.max(180, ticketPorPlat.length * 50) }}>
                    <ResponsiveContainer>
                      <BarChart data={ticketPorPlat} layout="vertical" margin={{ left: 20, right: 60 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
                        <XAxis type="number" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} tickFormatter={(v) => `R$${v}`} />
                        <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} width={80} />
                        <RTooltip content={<ChartTooltip formatter={(v) => fmtBRL(v)} />} />
                        <Bar dataKey="ticket" radius={[0,4,4,0]} label={{ position: "right", formatter: (v: number) => fmtBRL(v), fill: "hsl(var(--foreground))", fontSize: 11 }}>
                          {ticketPorPlat.map((e, i) => <Cell key={i} fill={e.color} />)}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-base">⛽ Custo de Combustível vs Receita Bruta</CardTitle></CardHeader>
              <CardContent>
                {combVsBrutoData.length === 0 ? <EmptyState /> : (
                  <div className="h-72 w-full">
                    <ResponsiveContainer>
                      <LineChart data={combVsBrutoData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis dataKey="label" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                        <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} tickFormatter={(v) => `R$${v}`} />
                        <RTooltip content={<ChartTooltip formatter={(v) => fmtBRL(v)} />} />
                        <Legend wrapperStyle={{ fontSize: 12 }} />
                        <Line name="Combustível" type="monotone" dataKey="combustivel" stroke="#ef4444" strokeWidth={2} strokeDasharray="5 5" dot={false} />
                        <Line name="Receita Bruta" type="monotone" dataKey="bruto" stroke="#10b981" strokeWidth={2} dot={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
