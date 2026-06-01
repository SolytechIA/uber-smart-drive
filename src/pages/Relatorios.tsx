import { useEffect, useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import {
  JornadaRecord,
  Ride,
  UberPasse,
  Vehicle,
} from "@/lib/financeiro";
import { RelatorioKpiPanel } from "@/components/RelatorioKpiPanel";

export default function Relatorios() {
  const { user } = useAuth();
  const [rides, setRides] = useState<Ride[]>([]);
  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [jornadas, setJornadas] = useState<JornadaRecord[]>([]);
  const [passes, setPasses] = useState<UberPasse[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    let cancel = false;
    (async () => {
      setLoading(true);
      const [rRes, vRes, jRes, pRes] = await Promise.all([
        supabase
          .from("rides")
          .select(
            "id,data_corrida,horario_inicio,horario_fim,valor_bruto,km_passageiro,km_deslocamento,km_total,duracao_minutos,classificacao,bairro_origem,bairro_destino",
          )
          .eq("user_id", user.id)
          .order("horario_inicio", { ascending: false })
          .limit(5000),
        supabase.from("vehicles").select("*").eq("user_id", user.id).maybeSingle(),
        supabase.from("jornadas").select("*").eq("user_id", user.id),
        supabase.from("uber_passes" as any).select("*").eq("user_id", user.id).limit(500),
      ]);
      if (cancel) return;
      setRides(((rRes.data as any[]) || []) as Ride[]);
      setVehicle((vRes.data as Vehicle) || null);
      setJornadas(((jRes.data as any[]) || []) as JornadaRecord[]);
      setPasses(((pRes.data as any[]) || []) as UberPasse[]);
      setLoading(false);
    })();
    return () => {
      cancel = true;
    };
  }, [user]);

  return (
    <AppLayout>
      <div className="container mx-auto max-w-7xl space-y-6 p-4 md:p-6">
        <header className="space-y-1">
          <h1 className="text-2xl font-bold md:text-3xl">Painel de Cards</h1>
          <p className="text-sm text-muted-foreground">
            KPIs consolidados por período — escolha o filtro acima e veja todos os indicadores atualizados.
          </p>
        </header>

        {loading ? (
          <p className="py-12 text-center text-sm text-muted-foreground">Carregando…</p>
        ) : (
          <RelatorioKpiPanel rides={rides} vehicle={vehicle} jornadas={jornadas} passes={passes} />
        )}
      </div>
    </AppLayout>
  );
}
