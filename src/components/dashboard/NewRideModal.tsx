import { useEffect, useState } from "react";
import { format } from "date-fns";
import { CalendarIcon, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import {
  classifyRide,
  classificacaoColor,
  classificacaoLabel,
  type Classificacao,
  type ClassifyParams,
} from "@/lib/rideClassification";
import { cn } from "@/lib/utils";

export interface EditingRide {
  id: string;
  data_corrida: string | null;
  horario_inicio: string | null;
  horario_fim: string | null;
  valor_bruto: number | null;
  km_passageiro: number | null;
  km_deslocamento: number | null;
  rua_origem: string | null;
  bairro_origem: string | null;
  rua_destino: string | null;
  bairro_destino: string | null;
  observacao: string | null;
}

interface NewRideModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
  params: ClassifyParams;
  editing?: EditingRide | null;
}

interface FormState {
  data_corrida: Date;
  horario_inicio: string;
  horario_fim: string;
  valor_bruto: string;
  km_passageiro: string;
  km_deslocamento: string;
  rua_origem: string;
  bairro_origem: string;
  rua_destino: string;
  bairro_destino: string;
  observacao: string;
}

const makeInitial = (): FormState => ({
  data_corrida: new Date(),
  horario_inicio: "",
  horario_fim: "",
  valor_bruto: "",
  km_passageiro: "",
  km_deslocamento: "",
  rua_origem: "",
  bairro_origem: "",
  rua_destino: "",
  bairro_destino: "",
  observacao: "",
});

const toTimeStr = (iso: string | null) => {
  if (!iso) return "";
  // Converte instante UTC para horário de SP (HH:mm)
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "America/Sao_Paulo",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date(iso));
  const h = parts.find((p) => p.type === "hour")?.value ?? "00";
  const m = parts.find((p) => p.type === "minute")?.value ?? "00";
  return `${h}:${m}`;
};

const numToStr = (n: number | null | undefined) => {
  if (n === null || n === undefined) return "";
  return String(n).replace(".", ",");
};

/** Converte uma data (yyyy-MM-dd) e hora (HH:mm) interpretada em SP para um Date UTC. */
const spWallToUTC = (dateYmd: string, timeHm: string): Date => {
  // Usamos uma data de referência em UTC para descobrir o offset de SP naquele momento
  const refUTC = new Date(`${dateYmd}T${timeHm}:00Z`);
  const sp = new Date(refUTC.toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
  const offsetMin = (sp.getTime() - refUTC.getTime()) / 60000; // negativo (-180 normalmente)
  return new Date(refUTC.getTime() - offsetMin * 60000);
};

const fromEditing = (e: EditingRide): FormState => {
  const dia = e.data_corrida ? new Date(`${e.data_corrida}T12:00:00`) : new Date();
  return {
    data_corrida: dia,
    horario_inicio: toTimeStr(e.horario_inicio),
    horario_fim: toTimeStr(e.horario_fim),
    valor_bruto: numToStr(e.valor_bruto),
    km_passageiro: numToStr(e.km_passageiro),
    km_deslocamento: numToStr(e.km_deslocamento),
    rua_origem: e.rua_origem || "",
    bairro_origem: e.bairro_origem || "",
    rua_destino: e.rua_destino || "",
    bairro_destino: e.bairro_destino || "",
    observacao: e.observacao || "",
  };
};

export function NewRideModal({ open, onOpenChange, onSaved, params, editing }: NewRideModalProps) {
  const { user } = useAuth();
  const [form, setForm] = useState<FormState>(makeInitial);
  const [saving, setSaving] = useState(false);
  const [resultado, setResultado] = useState<Classificacao | null>(null);

  const isEdit = !!editing;

  useEffect(() => {
    if (open) {
      setForm(editing ? fromEditing(editing) : makeInitial());
      setResultado(null);
    }
  }, [open, editing]);

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setForm((f) => ({ ...f, [k]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    const valor = parseFloat(form.valor_bruto.replace(",", "."));
    const kmPax = parseFloat(form.km_passageiro.replace(",", "."));
    const kmDesl = parseFloat(form.km_deslocamento.replace(",", ".")) || 0;
    if (!form.horario_inicio || !form.horario_fim || isNaN(valor) || isNaN(kmPax)) {
      toast.error("Preencha horários, valor e km com passageiro");
      return;
    }
    if (!form.bairro_origem.trim() || !form.bairro_destino.trim()) {
      toast.error("Preencha bairro de origem e bairro de destino");
      return;
    }

    const dia = format(form.data_corrida, "yyyy-MM-dd");
    // Interpreta HH:mm como horário de SP e converte para instante UTC
    const inicio = spWallToUTC(dia, form.horario_inicio);
    let fim = spWallToUTC(dia, form.horario_fim);
    if (fim < inicio) fim = new Date(fim.getTime() + 24 * 60 * 60 * 1000);
    const duracao = Math.round((fim.getTime() - inicio.getTime()) / 60000);
    const kmTotal = kmPax + kmDesl;
    const rPorKm = kmTotal > 0 ? valor / kmTotal : 0;

    const classificacao = classifyRide(
      { valor_bruto: valor, km_passageiro: kmPax, km_deslocamento: kmDesl },
      params,
    );

    setSaving(true);
    const payload = {
      data_corrida: dia,
      horario_inicio: inicio.toISOString(),
      horario_fim: fim.toISOString(),
      duracao_minutos: duracao,
      valor_bruto: valor,
      valor_liquido: valor,
      km_passageiro: kmPax,
      km_deslocamento: kmDesl,
      km_total: kmTotal,
      r_por_km_real: rPorKm,
      ganho_real_corrida: valor,
      rua_origem: form.rua_origem.trim() || null,
      bairro_origem: form.bairro_origem.trim(),
      rua_destino: form.rua_destino.trim() || null,
      bairro_destino: form.bairro_destino.trim(),
      observacao: form.observacao.trim() || null,
      classificacao,
    };

    let error;
    if (isEdit && editing) {
      ({ error } = await supabase.from("rides").update(payload).eq("id", editing.id));
    } else {
      ({ error } = await supabase.from("rides").insert({
        ...payload,
        user_id: user.id,
        plataforma: "Uber",
        fonte: "manual",
      }));
    }
    setSaving(false);

    if (error) {
      console.error("[NewRideModal] save error:", error, "payload:", payload);
      toast.error(`Erro ao salvar: ${error.message}`);
      return;
    }

    if (isEdit) {
      toast.success("Corrida atualizada com sucesso!");
      onSaved();
      onOpenChange(false);
      return;
    }

    setResultado(classificacao);
    setTimeout(() => {
      onSaved();
      onOpenChange(false);
    }, 1400);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display text-xl">
            {isEdit ? "Editar Corrida" : "Registrar Corrida Manualmente"}
          </DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Atualize os dados da corrida. A classificação será recalculada automaticamente."
              : "Informe os dados da corrida para registrar e classificar automaticamente."}
          </DialogDescription>
        </DialogHeader>

        {resultado ? (
          <div className="flex flex-col items-center justify-center py-8 animate-fade-in">
            <div
              className={cn(
                "rounded-2xl border-2 px-8 py-6 text-center text-2xl font-bold animate-slide-up",
                classificacaoColor[resultado],
              )}
            >
              {classificacaoLabel[resultado]}
            </div>
            <p className="mt-4 text-sm text-muted-foreground">Corrida registrada com sucesso</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label>Data da corrida</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    className={cn("w-full justify-start text-left font-normal")}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {format(form.data_corrida, "dd/MM/yyyy")}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={form.data_corrida}
                    onSelect={(d) => d && set("data_corrida", d)}
                    disabled={(date) => date > new Date()}
                    initialFocus
                    className={cn("p-3 pointer-events-auto")}
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="hi">Horário início</Label>
                <Input id="hi" type="time" value={form.horario_inicio} onChange={(e) => set("horario_inicio", e.target.value)} required />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="hf">Horário fim</Label>
                <Input id="hf" type="time" value={form.horario_fim} onChange={(e) => set("horario_fim", e.target.value)} required />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="valor">Valor recebido (R$)</Label>
              <Input id="valor" inputMode="decimal" placeholder="0,00" value={form.valor_bruto} onChange={(e) => set("valor_bruto", e.target.value)} required />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="kmp">Km com passageiro</Label>
                <Input id="kmp" inputMode="decimal" placeholder="0,0" value={form.km_passageiro} onChange={(e) => set("km_passageiro", e.target.value)} required />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="kmd">Km de deslocamento</Label>
                <Input id="kmd" inputMode="decimal" placeholder="0,0" value={form.km_deslocamento} onChange={(e) => set("km_deslocamento", e.target.value)} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="ro">Rua/Av. de origem</Label>
                <Input id="ro" placeholder="Opcional" value={form.rua_origem} onChange={(e) => set("rua_origem", e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="bo">Bairro de origem *</Label>
                <Input id="bo" value={form.bairro_origem} onChange={(e) => set("bairro_origem", e.target.value)} required />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="rd">Rua/Av. de destino</Label>
                <Input id="rd" placeholder="Opcional" value={form.rua_destino} onChange={(e) => set("rua_destino", e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="bd">Bairro de destino *</Label>
                <Input id="bd" value={form.bairro_destino} onChange={(e) => set("bairro_destino", e.target.value)} required />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="obs">Observação (opcional)</Label>
              <Textarea id="obs" rows={2} value={form.observacao} onChange={(e) => set("observacao", e.target.value)} />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button type="submit" variant="gradient" disabled={saving}>
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isEdit ? "Salvar alterações" : "Salvar corrida"}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
