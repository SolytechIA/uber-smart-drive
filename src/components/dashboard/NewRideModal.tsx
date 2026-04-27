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

interface NewRideModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
  params: ClassifyParams;
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

export function NewRideModal({ open, onOpenChange, onSaved, params }: NewRideModalProps) {
  const { user } = useAuth();
  const [form, setForm] = useState<FormState>(makeInitial);
  const [saving, setSaving] = useState(false);
  const [resultado, setResultado] = useState<Classificacao | null>(null);

  useEffect(() => {
    if (!open) {
      setForm(makeInitial());
      setResultado(null);
    }
  }, [open]);

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
    const inicio = new Date(`${dia}T${form.horario_inicio}:00`);
    let fim = new Date(`${dia}T${form.horario_fim}:00`);
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
      user_id: user.id,
      plataforma: "Uber",
      fonte: "manual",
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
    const { error } = await supabase.from("rides").insert(payload);
    setSaving(false);

    if (error) {
      console.error("[NewRideModal] insert error:", error, "payload:", payload);
      toast.error(`Erro ao salvar: ${error.message}`);
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
          <DialogTitle className="font-display text-xl">Registrar Corrida Manualmente</DialogTitle>
          <DialogDescription>
            Informe os dados da corrida para registrar e classificar automaticamente.
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
                Salvar corrida
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
