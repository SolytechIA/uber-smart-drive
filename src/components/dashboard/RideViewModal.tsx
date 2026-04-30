import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Pencil } from "lucide-react";
import {
  classificacaoColor,
  classificacaoLabel,
  type Classificacao,
} from "@/lib/rideClassification";
import { cn } from "@/lib/utils";

export interface ViewRide {
  id: string;
  data_corrida: string | null;
  horario_inicio: string | null;
  horario_fim: string | null;
  duracao_minutos: number | null;
  valor_bruto: number | null;
  custo_combustivel_corrida: number | null;
  ganho_real_corrida: number | null;
  km_passageiro: number | null;
  km_deslocamento: number | null;
  rua_origem: string | null;
  bairro_origem: string | null;
  rua_destino: string | null;
  bairro_destino: string | null;
  classificacao: string | null;
  observacao: string | null;
}

interface Props {
  ride: ViewRide | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onEdit: () => void;
}

const fmtBRL = (n: number | null | undefined) =>
  Number(n || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const fmtKm = (n: number | null | undefined) =>
  `${Number(n || 0).toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} km`;

const fmtHora = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" })
    : "--:--";

const fmtData = (data: string | null, iso: string | null) => {
  if (data) {
    const [y, m, d] = data.split("-");
    return `${d}/${m}/${y}`;
  }
  if (iso) return new Date(iso).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
  return "—";
};

export function RideViewModal({ ride, open, onOpenChange, onEdit }: Props) {
  if (!ride) return null;
  const c = (ride.classificacao as Classificacao) || "MEDIA";
  const kmPax = Number(ride.km_passageiro || 0);
  const kmDesl = Number(ride.km_deslocamento || 0);
  const kmTotal = kmPax + kmDesl;
  const valorBruto = Number(ride.valor_bruto || 0);
  const custoComb = Number(ride.custo_combustivel_corrida || 0);
  const ganhoReal = ride.ganho_real_corrida != null ? Number(ride.ganho_real_corrida) : valorBruto - custoComb;
  const rPorKm = kmTotal > 0 ? valorBruto / kmTotal : 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display text-xl flex items-center gap-2">
            Detalhes da corrida
            <Badge variant="outline" className={cn("text-[10px]", classificacaoColor[c])}>
              {classificacaoLabel[c]}
            </Badge>
          </DialogTitle>
          <DialogDescription>
            {fmtData(ride.data_corrida, ride.horario_inicio)} · {fmtHora(ride.horario_inicio)} → {fmtHora(ride.horario_fim)} · {ride.duracao_minutos ?? 0} min
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 text-sm">
          <section className="rounded-lg border border-border/60 bg-secondary/30 p-3">
            <h3 className="mb-2 text-xs font-semibold uppercase text-muted-foreground">Valores</h3>
            <div className="grid grid-cols-3 gap-2">
              <Stat label="Ganho bruto" value={fmtBRL(valorBruto)} />
              <Stat label="Combustível" value={fmtBRL(custoComb)} />
              <Stat label="Ganho real" value={fmtBRL(ganhoReal)} highlight={ganhoReal >= 0 ? "good" : "bad"} />
            </div>
          </section>

          <section className="rounded-lg border border-border/60 bg-secondary/30 p-3">
            <h3 className="mb-2 text-xs font-semibold uppercase text-muted-foreground">Percurso</h3>
            <div className="space-y-1">
              <p>
                <span className="text-muted-foreground">Origem:</span>{" "}
                <strong>{ride.rua_origem || "—"}</strong>
                {ride.bairro_origem ? <span className="text-muted-foreground"> · {ride.bairro_origem}</span> : null}
              </p>
              <p>
                <span className="text-muted-foreground">Destino:</span>{" "}
                <strong>{ride.rua_destino || "—"}</strong>
                {ride.bairro_destino ? <span className="text-muted-foreground"> · {ride.bairro_destino}</span> : null}
              </p>
            </div>
          </section>

          <section className="rounded-lg border border-border/60 bg-secondary/30 p-3">
            <h3 className="mb-2 text-xs font-semibold uppercase text-muted-foreground">Métricas</h3>
            <div className="grid grid-cols-4 gap-2">
              <Stat label="Km passageiro" value={fmtKm(kmPax)} />
              <Stat label="Km deslocamento" value={fmtKm(kmDesl)} />
              <Stat label="Km total" value={fmtKm(kmTotal)} />
              <Stat label="R$ / km" value={`R$ ${rPorKm.toFixed(2).replace(".", ",")}`} />
            </div>
          </section>

          {ride.observacao && (
            <section className="rounded-lg border border-border/60 bg-secondary/30 p-3">
              <h3 className="mb-1 text-xs font-semibold uppercase text-muted-foreground">Observação</h3>
              <p className="whitespace-pre-line">{ride.observacao}</p>
            </section>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
          <Button variant="gradient" onClick={onEdit}>
            <Pencil className="mr-2 h-4 w-4" /> Editar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Stat({ label, value, highlight }: { label: string; value: string; highlight?: "good" | "bad" }) {
  return (
    <div>
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p
        className={cn(
          "font-semibold tabular-nums",
          highlight === "good" && "text-emerald-600 dark:text-emerald-400",
          highlight === "bad" && "text-destructive",
        )}
      >
        {value}
      </p>
    </div>
  );
}
