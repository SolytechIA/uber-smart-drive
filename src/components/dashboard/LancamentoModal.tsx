import { useEffect, useState } from "react";
import { format } from "date-fns";
import { CalendarIcon, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";
import { nowInTZ } from "@/lib/financeiro";

export type LancamentoTipo = "ganho" | "custo";

const CONTAS_GANHO = [
  "Ganhos Uber",
  "Ganhos 99",
  "Ganhos InDrive",
  "Gorjetas",
  "Particular",
  "Outros Ganhos",
];

const CONTAS_CUSTO = [
  "Taxa/Passe Uber",
  "Taxa/Passe 99",
  "Taxa/Passe InDrive",
  "Financiamento de Veículo",
  "Aluguel de Veículo",
  "Combustível",
  "Estacionamentos",
  "Pedágio",
  "IPVA",
  "Manutenção Veículo",
  "Seguro Veículo",
  "Lavagem/Higienização",
  "Plano Celular",
  "Despesas com Alimentação",
  "Outros Custos Diversos",
];

export interface LancamentoEditData {
  id: string;
  conta: string;
  descricao: string | null;
  valor: number;
  data: string;
}

interface LancamentoModalProps {
  open: boolean;
  tipo: LancamentoTipo;
  onOpenChange: (o: boolean) => void;
  onSaved?: () => void;
  defaultDate?: Date;
  editing?: LancamentoEditData | null;
}

export function LancamentoModal({ open, tipo, onOpenChange, onSaved, defaultDate, editing }: LancamentoModalProps) {
  const { user } = useAuth();
  const contas = tipo === "ganho" ? CONTAS_GANHO : CONTAS_CUSTO;
  const [data, setData] = useState<Date>(defaultDate ?? nowInTZ());
  const [conta, setConta] = useState<string>(contas[0]);
  const [descricao, setDescricao] = useState("");
  const [valor, setValor] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      if (editing) {
        setData(new Date(editing.data + "T12:00:00"));
        setConta(editing.conta);
        setDescricao(editing.descricao || "");
        setValor(String(editing.valor).replace(".", ","));
      } else {
        setData(defaultDate ?? nowInTZ());
        setConta(contas[0]);
        setDescricao("");
        setValor("");
      }
    }
  }, [open, tipo, defaultDate, editing]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    const v = parseFloat(valor.replace(",", "."));
    if (isNaN(v) || v <= 0) {
      toast.error("Informe um valor válido");
      return;
    }
    if (!conta) {
      toast.error("Selecione a conta");
      return;
    }
    setSaving(true);
    const payload = {
      tipo,
      conta,
      descricao: descricao.trim() || null,
      valor: v,
      data: format(data, "yyyy-MM-dd"),
    };
    const { error } = editing
      ? await supabase.from("lancamentos" as any).update(payload).eq("id", editing.id).eq("user_id", user.id)
      : await supabase.from("lancamentos" as any).insert({ ...payload, user_id: user.id });
    setSaving(false);
    if (error) {
      console.error("[LancamentoModal]", error);
      toast.error(`Erro ao salvar: ${error.message}`);
      return;
    }
    toast.success(editing ? "✅ Lançamento atualizado" : tipo === "ganho" ? "✅ Ganho lançado" : "✅ Custo lançado");
    onSaved?.();
    onOpenChange(false);
  };

  const titulo = editing ? "Editar Lançamento" : tipo === "ganho" ? "Lançar Ganho" : "Lançar Custo";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display text-xl">{titulo}</DialogTitle>
          <DialogDescription>
            {tipo === "ganho"
              ? "Registre um ganho avulso (gorjeta, particular, etc.)."
              : "Registre um custo avulso (combustível, taxa, manutenção, etc.)."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label>Data</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button type="button" variant="outline" className="w-full justify-start text-left font-normal">
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {format(data, "dd/MM/yyyy")}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={data}
                  onSelect={(d) => d && setData(d)}
                  initialFocus
                  className={cn("p-3 pointer-events-auto")}
                />
              </PopoverContent>
            </Popover>
          </div>

          <div className="space-y-1.5">
            <Label>{tipo === "ganho" ? "Conta de ganho" : "Conta de custo"}</Label>
            <Select value={conta} onValueChange={setConta}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {contas.map((c) => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="desc">Descrição (opcional)</Label>
            <Textarea
              id="desc"
              rows={2}
              maxLength={100}
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              placeholder="Detalhes sobre o lançamento"
            />
            <p className="text-[10px] text-muted-foreground">{descricao.length}/100</p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="val">Valor (R$)</Label>
            <Input
              id="val"
              inputMode="decimal"
              placeholder="0,00"
              value={valor}
              onChange={(e) => setValor(e.target.value)}
              required
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" variant="gradient" disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {tipo === "ganho" ? "Salvar ganho" : "Salvar custo"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
