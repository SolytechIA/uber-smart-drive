import { useCallback, useEffect, useRef, useState } from "react";
import { Play, Square } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { format } from "date-fns";
import { nowInTZ } from "@/lib/financeiro";
import { toast } from "sonner";

interface Jornada {
  id: string;
  data_jornada: string;
  inicio: string;
  fim: string | null;
  duracao_minutos: number | null;
}

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function formatHM(totalMinutes: number): string {
  const h = Math.floor(totalMinutes / 60);
  const m = Math.floor(totalMinutes % 60);
  return `${h}h ${m}min`;
}

export function JornadaTimer({ onChange }: { onChange?: () => void }) {
  const { user } = useAuth();
  const [active, setActive] = useState<Jornada | null>(null);
  const [todayJornadas, setTodayJornadas] = useState<Jornada[]>([]);
  const [tick, setTick] = useState(0);
  const [busy, setBusy] = useState(false);
  const todayStr = useRef(format(nowInTZ(), "yyyy-MM-dd")).current;

  const reload = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from("jornadas" as any)
      .select("*")
      .eq("user_id", user.id)
      .eq("data_jornada", todayStr)
      .order("inicio", { ascending: true });
    const list = ((data as any) || []) as Jornada[];
    setTodayJornadas(list);
    setActive(list.find((j) => !j.fim) || null);
  }, [user, todayStr]);

  useEffect(() => {
    reload();
  }, [reload]);

  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, [active]);

  const elapsedSec = active ? Math.max(0, (Date.now() - new Date(active.inicio).getTime()) / 1000) : 0;

  const totalMinutesToday = todayJornadas.reduce((sum, j) => {
    if (j.fim) return sum + (Number(j.duracao_minutos) || 0);
    return sum + (Date.now() - new Date(j.inicio).getTime()) / 60000;
  }, 0);

  const handleStart = async () => {
    if (!user || busy) return;
    setBusy(true);
    const { error } = await supabase.from("jornadas" as any).insert({
      user_id: user.id,
      data_jornada: todayStr,
      inicio: new Date().toISOString(),
    } as any);
    setBusy(false);
    if (error) {
      toast.error("Não foi possível iniciar a jornada");
      return;
    }
    toast.success("Jornada iniciada");
    await reload();
    onChange?.();
  };

  const handleStop = async () => {
    if (!user || !active || busy) return;
    setBusy(true);
    const { error } = await supabase
      .from("jornadas" as any)
      .update({ fim: new Date().toISOString() } as any)
      .eq("id", active.id);
    setBusy(false);
    if (error) {
      toast.error("Não foi possível encerrar a jornada");
      return;
    }
    toast.success("Jornada encerrada");
    await reload();
    onChange?.();
  };

  // suppress unused tick warning
  void tick;

  return (
    <Card className="mb-6 p-5 sm:p-6">
      <div className="flex flex-col items-center gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col items-center sm:items-start">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Cronômetro de jornada</p>
          {active ? (
            <p className="font-display text-3xl font-bold tabular-nums sm:text-4xl">{formatDuration(elapsedSec)}</p>
          ) : (
            <p className="font-display text-2xl font-bold text-muted-foreground sm:text-3xl">Parado</p>
          )}
          <p className="mt-1 text-sm text-muted-foreground">
            Jornada de hoje: <strong className="text-foreground">{formatHM(totalMinutesToday)}</strong>
          </p>
        </div>
        {active ? (
          <Button
            size="lg"
            onClick={handleStop}
            disabled={busy}
            className="h-14 min-w-[200px] bg-red-600 text-white hover:bg-red-700"
          >
            <Square className="mr-2 h-5 w-5 fill-current" />
            Encerrar Jornada
          </Button>
        ) : (
          <Button
            size="lg"
            onClick={handleStart}
            disabled={busy}
            className="h-14 min-w-[200px] bg-green-600 text-white hover:bg-green-700"
          >
            <Play className="mr-2 h-5 w-5 fill-current" />
            Iniciar Jornada
          </Button>
        )}
      </div>
    </Card>
  );
}
