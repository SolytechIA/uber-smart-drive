import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, CheckCircle2, ExternalLink, Lock, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

export default function ConectarUber() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [autorizo, setAutorizo] = useState(false);
  const [conectado, setConectado] = useState(false);
  const [ultimoSync, setUltimoSync] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("users")
        .select("uber_conectado, uber_ultimo_sync")
        .eq("id", user.id)
        .maybeSingle();
      if (cancelled) return;
      setConectado(!!data?.uber_conectado);
      setUltimoSync(data?.uber_ultimo_sync ?? null);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  const handleConectar = async () => {
    if (!user || !autorizo) return;
    setSaving(true);
    // Abre Uber em nova aba para o motorista fazer login
    window.open("https://drivers.uber.com/", "_blank", "noopener,noreferrer");
    const now = new Date().toISOString();
    const { error } = await supabase
      .from("users")
      .update({ uber_conectado: true, uber_ultimo_sync: now })
      .eq("id", user.id);
    setSaving(false);
    if (error) {
      toast.error("Erro ao salvar conexão");
      return;
    }
    setConectado(true);
    setUltimoSync(now);
    toast.success("Conta Uber marcada como conectada");
  };

  const handleDesconectar = async () => {
    if (!user) return;
    setSaving(true);
    const { error } = await supabase
      .from("users")
      .update({ uber_conectado: false })
      .eq("id", user.id);
    setSaving(false);
    if (error) return toast.error("Erro ao desconectar");
    setConectado(false);
    toast.success("Conta Uber desconectada");
  };

  return (
    <AppLayout>
      <div className="mx-auto max-w-2xl px-4 py-8">
        <Button asChild variant="ghost" size="sm" className="mb-4">
          <Link to="/configuracoes">
            <ArrowLeft className="mr-2 h-4 w-4" /> Voltar
          </Link>
        </Button>

        <Card className="p-6 sm:p-8 animate-fade-in">
          <div className="flex flex-col items-center text-center">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl gradient-bg shadow-glow">
              <span className="font-display text-2xl font-bold text-primary-foreground">U</span>
            </div>
            <h1 className="font-display text-2xl font-bold sm:text-3xl">
              {conectado ? "Conta Uber conectada" : "Conecte sua conta Uber"}
            </h1>
            <p className="mt-3 max-w-md text-sm text-muted-foreground">
              Ao conectar, suas corridas serão sincronizadas automaticamente a cada 5 minutos.
              Você autoriza o Drive IA a acessar seu histórico de corridas e ganhos exclusivamente
              para gerar análises e relatórios para seu uso pessoal, em conformidade com a LGPD.
            </p>
          </div>

          {loading ? (
            <div className="mt-8 flex items-center justify-center text-muted-foreground">
              <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Carregando…
            </div>
          ) : conectado ? (
            <div className="mt-8 space-y-4">
              <div className="flex items-center gap-3 rounded-lg border border-success/30 bg-success/10 p-4">
                <CheckCircle2 className="h-6 w-6 shrink-0 text-success" />
                <div className="flex-1 text-sm">
                  <p className="font-medium">Conexão ativa</p>
                  {ultimoSync && (
                    <p className="text-xs text-muted-foreground">
                      Último sync: {new Date(ultimoSync).toLocaleString("pt-BR")}
                    </p>
                  )}
                </div>
              </div>
              <Button
                variant="outline"
                className="w-full"
                onClick={handleDesconectar}
                disabled={saving}
              >
                Desconectar conta Uber
              </Button>
              <Button
                variant="gradient"
                className="w-full"
                onClick={() => navigate("/dashboard/operacional")}
              >
                Ir para o Dashboard
              </Button>
            </div>
          ) : (
            <div className="mt-8 space-y-4">
              <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-border bg-secondary/40 p-4 transition-colors hover:bg-secondary/60">
                <Checkbox
                  checked={autorizo}
                  onCheckedChange={(v) => setAutorizo(v === true)}
                  className="mt-0.5"
                />
                <span className="text-sm leading-relaxed">
                  Autorizo o Drive IA a acessar meus dados de corridas e ganhos da Uber para
                  análise pessoal
                </span>
              </label>

              <Button
                variant="gradient"
                size="lg"
                className="w-full"
                disabled={!autorizo || saving}
                onClick={handleConectar}
              >
                {saving ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <ExternalLink className="mr-2 h-4 w-4" />
                )}
                Conectar com Uber
              </Button>

              <div className="flex items-center justify-center gap-2 rounded-lg bg-secondary/40 p-3 text-xs text-muted-foreground">
                <Lock className="h-3.5 w-3.5" />
                Seus dados são criptografados e nunca compartilhados com terceiros
              </div>
            </div>
          )}

          <div className="mt-6 flex justify-center">
            <Badge variant="outline" className="text-xs">
              Em breve — OAuth Oficial Uber
            </Badge>
          </div>
          <p className="mt-2 text-center text-xs text-muted-foreground">
            A integração oficial via OAuth está em processo de aprovação pela Uber.
          </p>
        </Card>
      </div>
    </AppLayout>
  );
}
