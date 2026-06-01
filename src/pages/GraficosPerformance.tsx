import { useEffect, useMemo, useState } from "react";
import { format, parseISO, eachDayOfInterval } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Inbox } from "lucide-react";
import {
  ResponsiveContainer,
  BarChart, Bar,
  LineChart, Line,
  XAxis, YAxis, CartesianGrid, Cell, Legend,
  ReferenceLine,
  Tooltip as RTooltip,
} from "recharts";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PeriodFilter, getPeriodRange, type Periodo } from "@/components/PeriodFilter";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { fmtBRL } from "@/lib/financeiro";

interface RideRow {
  id: string;
  data_corrida: string | null;
  horario_inicio: string | null;
  horario_fim: string | null;
  duracao_minutos: number | null;
  valor_bruto: number | null;
  km_passageiro: number | null;
  km_deslocamento: number | null;
  km_total: number | null;
  classificacao: string | null;
  bairro_origem: string | null;
}

function rideDateKey(r: RideRow): string | null {
  return r.data_corrida ?? (r.horario_inicio ? r.horario_inicio.slice(0, 10) : null);
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
      <Inbox className="h-10 w-10 mb-2 opacity-50" />
      <p className="text-sm">Nenhum dado para este período</p>
    </div>
  );
}

const tooltipStyle = {
  background: "hsl(var(--card))",
  border: "1px solid hsl(var(--border))",
  borderRadius: 8,
  fontSize: 12,
};

// gradient red→green
function colorForRatio(ratio: number): string {
  // 0 = red, 1 = green
  const r = Math.round(239 + (16 - 239) * ratio);
  const g = Math.round(68 + (185 - 68) * ratio);
  const b = Math.round(68 + (129 - 68) * ratio);
  return `rgb(${r},${g},${b})`;
}

const DAY_LABELS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

export default function GraficosPerformance() {
  const { user } = useAuth();
  const [periodo, setPeriodo] = useState<Periodo>("mes");
  const [custom, setCustom] = useState<{ from: Date; to: Date } | undefined>();
  const [rides, setRides] = useState<RideRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    (async () => {
      setLoading(true);
      const { data } = await supabase.from("rides")
        .select("id,data_corrida,horario_inicio,horario_fim,duracao_minutos,valor_bruto,km_passageiro,km_deslocamento,km_total,classificacao,bairro_origem")
        .eq("user_id", user.id).limit(5000);
      setRides((data as RideRow[]) || []);
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

  // R$/hora por faixa horária
  const rPorHoraFaixa = useMemo(() => {
    const buckets: Record<number, { valor: number; minutos: number }> = {};
    for (let h = 6; h <= 23; h++) buckets[h] = { valor: 0, minutos: 0 };
    for (const r of ridesIn) {
      if (!r.horario_inicio) continue;
      const h = new Date(r.horario_inicio).getHours();
      if (buckets[h] === undefined) continue;
      buckets[h].valor += Number(r.valor_bruto || 0);
      buckets[h].minutos += Number(r.duracao_minutos || 0);
    }
    const arr = Object.entries(buckets).map(([h, v]) => ({
      hora: `${h.padStart(2, "0")}h`,
      rPorHora: v.minutos > 0 ? (v.valor / (v.minutos / 60)) : 0,
    }));
    const max = Math.max(...arr.map(a => a.rPorHora), 0.0001);
    return arr.map(a => ({ ...a, color: colorForRatio(a.rPorHora / max), isMax: a.rPorHora === max && max > 0 }));
  }, [ridesIn]);

  // R$/km por dia da semana
  const rPorKmSemana = useMemo(() => {
    const buckets: Record<number, { valor: number; km: number }> = {};
    for (let i = 0; i < 7; i++) buckets[i] = { valor: 0, km: 0 };
    for (const r of ridesIn) {
      const d = rideDateKey(r); if (!d) continue;
      const dow = parseISO(d).getDay();
      buckets[dow].valor += Number(r.valor_bruto || 0);
      buckets[dow].km += Number(r.km_total || (Number(r.km_passageiro || 0) + Number(r.km_deslocamento || 0)));
    }
    // Order: Mon-Sun
    const order = [1,2,3,4,5,6,0];
    const arr = order.map(i => ({
      dia: DAY_LABELS[i],
      rPorKm: buckets[i].km > 0 ? buckets[i].valor / buckets[i].km : 0,
    }));
    const max = Math.max(...arr.map(a => a.rPorKm), 0.0001);
    return arr.map(a => ({ ...a, isMax: a.rPorKm === max && max > 0 }));
  }, [ridesIn]);

  // Classificação por dia
  const classifPorDia = useMemo(() => {
    const map: Record<string, { label: string; BOA: number; MEDIA: number; RUIM: number }> = {};
    for (const r of ridesIn) {
      const d = rideDateKey(r); if (!d) continue;
      if (!map[d]) map[d] = { label: format(parseISO(d), "dd/MM", { locale: ptBR }), BOA: 0, MEDIA: 0, RUIM: 0 };
      const c = (r.classificacao || "").toUpperCase();
      if (c === "BOA") map[d].BOA += 1;
      else if (c === "MEDIA" || c === "MÉDIA") map[d].MEDIA += 1;
      else if (c === "RUIM") map[d].RUIM += 1;
    }
    return Object.entries(map).sort((a,b) => a[0].localeCompare(b[0])).map(([_, v]) => v);
  }, [ridesIn]);

  // Km rodado vs Km passageiro por dia
  const kmPorDia = useMemo(() => {
    const map: Record<string, { label: string; total: number; passageiro: number }> = {};
    for (const r of ridesIn) {
      const d = rideDateKey(r); if (!d) continue;
      if (!map[d]) map[d] = { label: format(parseISO(d), "dd/MM", { locale: ptBR }), total: 0, passageiro: 0 };
      const passageiro = Number(r.km_passageiro || 0);
      const desloc = Number(r.km_deslocamento || 0);
      map[d].total += Number(r.km_total || (passageiro + desloc));
      map[d].passageiro += passageiro;
    }
    return Object.entries(map).sort((a,b) => a[0].localeCompare(b[0])).map(([_, v]) => v);
  }, [ridesIn]);

  // Top 10 bairros origem
  const topBairros = useMemo(() => {
    const map: Record<string, number> = {};
    for (const r of ridesIn) {
      const b = (r.bairro_origem || "").trim();
      if (!b) continue;
      map[b] = (map[b] || 0) + 1;
    }
    return Object.entries(map).sort((a,b) => b[1] - a[1]).slice(0, 10).map(([bairro, qtd]) => ({ bairro, qtd }));
  }, [ridesIn]);

  // % corridas boas por dia
  const pctBoasPorDia = useMemo(() => {
    const map: Record<string, { boas: number; total: number }> = {};
    for (const r of ridesIn) {
      const d = rideDateKey(r); if (!d) continue;
      if (!map[d]) map[d] = { boas: 0, total: 0 };
      map[d].total += 1;
      if ((r.classificacao || "").toUpperCase() === "BOA") map[d].boas += 1;
    }
    return Object.entries(map).sort((a,b) => a[0].localeCompare(b[0])).map(([d, v]) => ({
      label: format(parseISO(d), "dd/MM", { locale: ptBR }),
      pct: v.total > 0 ? (v.boas / v.total) * 100 : 0,
    }));
  }, [ridesIn]);

  const hasAny = ridesIn.length > 0;

  return (
    <AppLayout>
      <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-display font-bold">Gráficos de Performance</h1>
          <p className="text-muted-foreground text-sm mt-1">Produtividade, eficiência operacional e qualidade das corridas.</p>
        </div>

        <PeriodFilter periodo={periodo} custom={custom} onChange={(p, c) => { setPeriodo(p); if (c) setCustom(c); }} />

        {loading ? (
          <Card><CardContent className="py-12 text-center text-muted-foreground">Carregando…</CardContent></Card>
        ) : !hasAny ? (
          <Card><CardContent><EmptyState /></CardContent></Card>
        ) : (
          <div className="space-y-6">
            <Card>
              <CardHeader><CardTitle className="text-base">⏰ R$/hora por faixa horária do dia</CardTitle></CardHeader>
              <CardContent>
                <div className="h-72 w-full">
                  <ResponsiveContainer>
                    <BarChart data={rPorHoraFaixa}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="hora" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                      <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} tickFormatter={(v) => `R$${Math.round(v)}`} />
                      <RTooltip contentStyle={tooltipStyle} formatter={(v: number) => fmtBRL(v)} />
                      <Bar dataKey="rPorHora" radius={[4,4,0,0]}>
                        {rPorHoraFaixa.map((e, i) => (
                          <Cell key={i} fill={e.color} stroke={e.isMax ? "#fff" : undefined} strokeWidth={e.isMax ? 2 : 0} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-base">📅 R$/km por dia da semana</CardTitle></CardHeader>
              <CardContent>
                <div className="h-72 w-full">
                  <ResponsiveContainer>
                    <BarChart data={rPorKmSemana}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="dia" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                      <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} tickFormatter={(v) => `R$${v.toFixed(1)}`} />
                      <RTooltip contentStyle={tooltipStyle} formatter={(v: number) => fmtBRL(v)} />
                      <Bar dataKey="rPorKm" radius={[4,4,0,0]}>
                        {rPorKmSemana.map((e, i) => (
                          <Cell key={i} fill={e.isMax ? "#10b981" : "#3b82f6"} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-base">🏆 Classificação das corridas (BOA/MÉDIA/RUIM)</CardTitle></CardHeader>
              <CardContent>
                {classifPorDia.length === 0 ? <EmptyState /> : (
                  <div className="h-72 w-full">
                    <ResponsiveContainer>
                      <BarChart data={classifPorDia}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis dataKey="label" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                        <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                        <RTooltip contentStyle={tooltipStyle} />
                        <Legend wrapperStyle={{ fontSize: 12 }} />
                        <Bar name="BOA" dataKey="BOA" stackId="a" fill="#10b981" />
                        <Bar name="MÉDIA" dataKey="MEDIA" stackId="a" fill="#f59e0b" />
                        <Bar name="RUIM" dataKey="RUIM" stackId="a" fill="#ef4444" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-base">🗺 Km rodado vs Km com passageiro</CardTitle></CardHeader>
              <CardContent>
                {kmPorDia.length === 0 ? <EmptyState /> : (
                  <div className="h-72 w-full">
                    <ResponsiveContainer>
                      <BarChart data={kmPorDia}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis dataKey="label" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                        <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} tickFormatter={(v) => `${v}km`} />
                        <RTooltip contentStyle={tooltipStyle} formatter={(v: number) => `${v.toFixed(1)} km`} />
                        <Legend wrapperStyle={{ fontSize: 12 }} />
                        <Bar name="Km Total" dataKey="total" fill="#94a3b8" radius={[4,4,0,0]} />
                        <Bar name="Km Passageiro" dataKey="passageiro" fill="#10b981" radius={[4,4,0,0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-base">📍 Top 10 bairros de origem</CardTitle></CardHeader>
              <CardContent>
                {topBairros.length === 0 ? <EmptyState /> : (
                  <div className="w-full" style={{ height: Math.max(200, topBairros.length * 36) }}>
                    <ResponsiveContainer>
                      <BarChart data={topBairros} layout="vertical" margin={{ left: 30, right: 40 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
                        <XAxis type="number" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                        <YAxis type="category" dataKey="bairro" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} width={110} />
                        <RTooltip contentStyle={tooltipStyle} formatter={(v: number) => `${v} corridas`} />
                        <Bar dataKey="qtd" fill="#8b5cf6" radius={[0,4,4,0]} label={{ position: "right", fill: "hsl(var(--foreground))", fontSize: 11 }} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-base">📉 Evolução do % de corridas boas</CardTitle></CardHeader>
              <CardContent>
                {pctBoasPorDia.length === 0 ? <EmptyState /> : (
                  <div className="h-72 w-full">
                    <ResponsiveContainer>
                      <LineChart data={pctBoasPorDia}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis dataKey="label" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                        <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} tickFormatter={(v) => `${v}%`} />
                        <RTooltip contentStyle={tooltipStyle} formatter={(v: number) => `${v.toFixed(1)}%`} />
                        <ReferenceLine y={70} stroke="#10b981" strokeDasharray="6 4" label={{ value: "Meta 70%", fill: "#10b981", fontSize: 10, position: "right" }} />
                        <Line type="monotone" dataKey="pct" stroke="#3b82f6" strokeWidth={2} dot={{ r: 3 }} />
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
