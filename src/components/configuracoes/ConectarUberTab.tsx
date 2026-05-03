import { useEffect, useState } from "react";
import { Loader2, Save, ChevronDown } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

export function ConectarUberTab() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [cookie, setCookie] = useState("");
  const [status, setStatus] = useState<"active" | "inactive" | "error">("inactive");
  const [ultimo, setUltimo] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("uber_connections" as any)
        .select("status, ultima_sincronizacao")
        .eq("user_id", user.id)
        .maybeSingle();
      if (cancelled) return;
      if (data) {
        setStatus(((data as any).status as "active" | "inactive" | "error") || "inactive");
        setUltimo((data as any).ultima_sincronizacao ?? null);
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  const handleSave = async () => {
    if (!user) return;
    if (!cookie.trim()) {
      toast.error("Cole o cookie antes de salvar");
      return;
    }
    setSaving(true);
    const { error } = await supabase.from("uber_connections" as any).upsert(
      {
        user_id: user.id,
        uber_cookie: cookie.trim(),
        status: "active",
      },
      { onConflict: "user_id" },
    );
    setSaving(false);
    if (error) return toast.error("Erro ao salvar conexão");
    setStatus("active");
    setCookie("");
    toast.success("Conta Uber conectada");
  };

  const handleDisconnect = async () => {
    if (!user) return;
    setSaving(true);
    const { error } = await supabase
      .from("uber_connections" as any)
      .update({ status: "inactive", uber_cookie: null })
      .eq("user_id", user.id);
    setSaving(false);
    if (error) return toast.error("Erro ao desconectar");
    setStatus("inactive");
    toast.success("Conta Uber desconectada");
  };

  if (loading) {
    return (
      <Card className="mt-6 flex items-center justify-center p-12 text-muted-foreground">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Carregando…
      </Card>
    );
  }

  const conectado = status === "active";

  return (
    <div className="mt-6 space-y-4">
      <Card className="p-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-display text-lg font-semibold">Status da conexão</h3>
            {conectado && ultimo && (
              <p className="mt-1 text-xs text-muted-foreground">
                Última sincronização: {new Date(ultimo).toLocaleString("pt-BR")}
              </p>
            )}
          </div>
          {conectado ? (
            <Badge className="bg-emerald-500/15 text-emerald-500 hover:bg-emerald-500/15">Conectado ✓</Badge>
          ) : (
            <Badge variant="outline">Não conectado</Badge>
          )}
        </div>
        {conectado && (
          <Button variant="outline" className="mt-4" onClick={handleDisconnect} disabled={saving}>
            Desconectar
          </Button>
        )}
      </Card>

      <Card className="p-6">
        <Accordion type="single" collapsible defaultValue="howto">
          <AccordionItem value="howto" className="border-0">
            <AccordionTrigger className="py-0 hover:no-underline">
              <span className="font-display text-base font-semibold">
                🔗 Como conectar sua conta Uber
              </span>
              <ChevronDown className="hidden" />
            </AccordionTrigger>
            <AccordionContent>
              <ol className="mt-4 list-decimal space-y-2 pl-5 text-sm text-muted-foreground">
                <li>No computador, acesse <strong>drivers.uber.com</strong> e faça login</li>
                <li>Pressione <strong>F12</strong> para abrir as ferramentas do desenvolvedor</li>
                <li>Clique na aba <strong>Application</strong> (ou <strong>Armazenamento</strong>)</li>
                <li>No menu lateral, clique em <strong>Cookies → https://drivers.uber.com</strong></li>
                <li>Localize o cookie chamado <strong>sid</strong> ou <strong>uber_token</strong></li>
                <li>Copie o valor completo do cookie</li>
                <li>Cole o valor no campo abaixo e clique em <strong>Salvar</strong></li>
              </ol>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </Card>

      <Card className="p-6">
        <Label htmlFor="uber-cookie">Cookie de sessão Uber</Label>
        <Textarea
          id="uber-cookie"
          value={cookie}
          onChange={(e) => setCookie(e.target.value)}
          placeholder="Cole aqui o valor do cookie de sessão..."
          rows={4}
          className="mt-2 font-mono text-xs"
        />
        <p className="mt-2 text-xs text-destructive">
          ⚠️ Nunca compartilhe este cookie com ninguém além do Drive IA. Ele dá acesso à sua conta Uber.
        </p>
        <Button variant="gradient" className="mt-4" onClick={handleSave} disabled={saving}>
          {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
          Salvar e conectar
        </Button>
      </Card>

      <Card className="border-primary/30 bg-primary/5 p-6">
        <h4 className="font-display text-base font-semibold">🤖 Como funciona a sincronização automática</h4>
        <p className="mt-2 text-sm text-muted-foreground">
          Após conectar sua conta Uber, nosso sistema verifica automaticamente suas corridas a cada
          5 minutos e as adiciona ao seu painel sem que você precise fazer nada. A sincronização é
          segura e seus dados nunca são compartilhados.
        </p>
      </Card>
    </div>
  );
}
