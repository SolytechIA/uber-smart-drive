import { useEffect, useState } from "react";
import { Plus, Trash2, Loader2, Clock, DollarSign } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { fmtBRL } from "@/lib/financeiro";

interface UberPasse {
  id: string;
  tipo: "tempo" | "ganhos";
  duracao_horas: number | null;
  teto_ganhos: number | null;
  valor_pago: number;
  iniciado_em: string;
  encerrado_em: string | null;
}

export function PassesUberSection() {
  const { user } = useAuth();
  const [passes, setPasses] = useState<UberPasse[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);

  // Form fields
  const [tipo, setTipo] = useState<"tempo" | "ganhos">("tempo");
  const [duracao, setDuracao] = useState("");
  const [teto, setTeto] = useState("");
  const [valor, setValor] = useState("");
  const [inicio, setInicio] = useState(() => {
    const d = new Date();
    d.setSeconds(0, 0);
    return format(d, "yyyy-MM-dd'T'HH:mm");
  });

  const load = async () => {
    if (!user) return;
    setLoading(true);
    const { data } = await supabase
      .from("uber_passes" as any)
      .select("*")
      .eq("user_id", user.id)
      .order("iniciado_em", { ascending: false });
    setPasses(((data as any) || []) as UberPasse[]);
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const reset = () => {
    setTipo("tempo");
    setDuracao("");
    setTeto("");
    setValor("");
    const d = new Date();
    d.setSeconds(0, 0);
    setInicio(format(d, "yyyy-MM-dd'T'HH:mm"));
    setShowForm(false);
  };

  const handleSave = async () => {
    if (!user) return;
    const valorNum = Number(valor.replace(",", "."));
    if (!valorNum || valorNum <= 0) return toast.error("Informe o valor pago");
    if (!inicio) return toast.error("Informe data de início");

    let duracaoNum: number | null = null;
    let tetoNum: number | null = null;
    let encerradoEm: string | null = null;

    if (tipo === "tempo") {
      duracaoNum = Number(duracao.replace(",", "."));
      if (!duracaoNum || duracaoNum <= 0) return toast.error("Informe a duração em horas");
      const ini = new Date(inicio);
      encerradoEm = new Date(ini.getTime() + duracaoNum * 3600 * 1000).toISOString();
    } else {
      tetoNum = Number(teto.replace(",", "."));
      if (!tetoNum || tetoNum <= 0) return toast.error("Informe o teto de ganhos");
    }

    setSaving(true);
    const { error } = await supabase.from("uber_passes" as any).insert({
      user_id: user.id,
      tipo,
      duracao_horas: duracaoNum,
      teto_ganhos: tetoNum,
      valor_pago: valorNum,
      iniciado_em: new Date(inicio).toISOString(),
      encerrado_em: encerradoEm,
    });
    setSaving(false);
    if (error) return toast.error("Erro ao salvar passe");
    toast.success("Passe lançado");
    reset();
    load();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Excluir este passe?")) return;
    const { error } = await supabase.from("uber_passes" as any).delete().eq("id", id);
    if (error) return toast.error("Erro ao excluir");
    setPasses((p) => p.filter((x) => x.id !== id));
  };

  return (
    <div className="rounded-lg border border-border/60 p-4 sm:p-6 space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h3 className="font-semibold flex items-center gap-2">🎫 Passe Uber</h3>
          <p className="text-xs text-muted-foreground">Lance cada passe comprado. O custo será rateado pelas corridas do período.</p>
        </div>
        {!showForm && (
          <Button size="sm" onClick={() => setShowForm(true)}>
            <Plus className="mr-1 h-4 w-4" /> Adicionar passe
          </Button>
        )}
      </div>

      {showForm && (
        <div className="rounded-md border border-border/60 bg-muted/30 p-4 space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label>Tipo do passe</Label>
              <Select value={tipo} onValueChange={(v) => setTipo(v as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="tempo">⏱ Passe por Tempo</SelectItem>
                  <SelectItem value="ganhos">💰 Passe por Ganhos</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {tipo === "tempo" ? (
              <div>
                <Label>Duração (horas)</Label>
                <Input type="number" placeholder="Ex: 24" value={duracao} onChange={(e) => setDuracao(e.target.value)} />
              </div>
            ) : (
              <div>
                <Label>Teto de ganhos (R$)</Label>
                <Input type="number" placeholder="Ex: 630,00" value={teto} onChange={(e) => setTeto(e.target.value)} />
              </div>
            )}

            <div>
              <Label>Valor pago (R$)</Label>
              <Input type="number" placeholder="Ex: 35,00" value={valor} onChange={(e) => setValor(e.target.value)} />
            </div>

            <div>
              <Label>{tipo === "tempo" ? "Data e hora de início" : "Data de início"}</Label>
              <Input
                type={tipo === "tempo" ? "datetime-local" : "date"}
                value={tipo === "tempo" ? inicio : inicio.slice(0, 10)}
                onChange={(e) =>
                  setInicio(tipo === "tempo" ? e.target.value : `${e.target.value}T00:00`)
                }
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" size="sm" onClick={reset}>Cancelar</Button>
            <Button size="sm" onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
              Salvar passe
            </Button>
          </div>
        </div>
      )}

      <div className="space-y-2">
        {loading ? (
          <p className="text-sm text-muted-foreground">Carregando…</p>
        ) : passes.length === 0 ? (
          <p className="text-sm text-muted-foreground italic">Nenhum passe lançado ainda.</p>
        ) : (
          passes.map((p) => (
            <div key={p.id} className="flex items-center justify-between gap-2 rounded-md border border-border/60 bg-card px-3 py-2 text-sm">
              <div className="flex items-center gap-2 min-w-0 flex-1">
                {p.tipo === "tempo" ? (
                  <Clock className="h-4 w-4 text-primary shrink-0" />
                ) : (
                  <DollarSign className="h-4 w-4 text-success shrink-0" />
                )}
                <span className="truncate">
                  {p.tipo === "tempo"
                    ? `${Number(p.duracao_horas)}h · ${fmtBRL(Number(p.valor_pago))} · ${format(new Date(p.iniciado_em), "dd/MM HH:mm")} → ${p.encerrado_em ? format(new Date(p.encerrado_em), "dd/MM HH:mm") : "—"}`
                    : `${fmtBRL(Number(p.teto_ganhos))} teto · ${fmtBRL(Number(p.valor_pago))} · ${format(new Date(p.iniciado_em), "dd/MM")}`}
                </span>
              </div>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleDelete(p.id)}>
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
