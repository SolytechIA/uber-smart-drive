import { useEffect, useMemo, useState } from "react";
import { Loader2, Save, ShieldAlert, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const ESTADOS: { uf: string; nome: string }[] = [
  { uf: "AC", nome: "Acre" }, { uf: "AL", nome: "Alagoas" }, { uf: "AP", nome: "Amapá" },
  { uf: "AM", nome: "Amazonas" }, { uf: "BA", nome: "Bahia" }, { uf: "CE", nome: "Ceará" },
  { uf: "DF", nome: "Distrito Federal" }, { uf: "ES", nome: "Espírito Santo" }, { uf: "GO", nome: "Goiás" },
  { uf: "MA", nome: "Maranhão" }, { uf: "MT", nome: "Mato Grosso" }, { uf: "MS", nome: "Mato Grosso do Sul" },
  { uf: "MG", nome: "Minas Gerais" }, { uf: "PA", nome: "Pará" }, { uf: "PB", nome: "Paraíba" },
  { uf: "PR", nome: "Paraná" }, { uf: "PE", nome: "Pernambuco" }, { uf: "PI", nome: "Piauí" },
  { uf: "RJ", nome: "Rio de Janeiro" }, { uf: "RN", nome: "Rio Grande do Norte" }, { uf: "RS", nome: "Rio Grande do Sul" },
  { uf: "RO", nome: "Rondônia" }, { uf: "RR", nome: "Roraima" }, { uf: "SC", nome: "Santa Catarina" },
  { uf: "SP", nome: "São Paulo" }, { uf: "SE", nome: "Sergipe" }, { uf: "TO", nome: "Tocantins" },
];

function maskPhone(raw: string): string {
  const d = raw.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 2) return d.length ? `(${d}` : "";
  if (d.length <= 7) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

const CURRENT_YEAR = new Date().getFullYear();

export function PerfilTab() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [telefone, setTelefone] = useState("");
  const [telefoneOriginal, setTelefoneOriginal] = useState("");
  const [telefoneVerificado, setTelefoneVerificado] = useState(false);
  const [cidade, setCidade] = useState("");
  const [estado, setEstado] = useState<string>("");
  const [sexo, setSexo] = useState<string>("");
  const [anoNascimento, setAnoNascimento] = useState<string>("");

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("users")
        .select("telefone, telefone_verificado, cidade, estado, sexo, ano_nascimento")
        .eq("id", user.id)
        .maybeSingle();
      if (cancelled) return;
      if (data) {
        const tel = (data as any).telefone ?? "";
        setTelefone(maskPhone(tel));
        setTelefoneOriginal(tel);
        setTelefoneVerificado(!!(data as any).telefone_verificado);
        setCidade((data as any).cidade ?? "");
        setEstado((data as any).estado ?? "");
        setSexo((data as any).sexo ?? "");
        const a = (data as any).ano_nascimento;
        setAnoNascimento(a ? String(a) : "");
      }
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [user]);

  const idade = useMemo(() => {
    const y = Number(anoNascimento);
    if (!y || y < 1940 || y > 2006) return null;
    return CURRENT_YEAR - y;
  }, [anoNascimento]);

  const telefoneDigits = telefone.replace(/\D/g, "");
  const telefoneValido = telefoneDigits.length === 11;
  const telefoneMudou = telefoneDigits !== telefoneOriginal.replace(/\D/g, "");

  const onSave = async () => {
    if (!user) return;
    if (telefone && !telefoneValido) {
      toast.error("Celular inválido. Use o formato (XX) 9XXXX-XXXX");
      return;
    }
    if (anoNascimento) {
      const y = Number(anoNascimento);
      if (y < 1940 || y > 2006) {
        toast.error("Ano de nascimento deve estar entre 1940 e 2006");
        return;
      }
    }
    setSaving(true);
    const payload: any = {
      telefone: telefoneDigits || null,
      cidade: cidade.trim() || null,
      estado: estado || null,
      sexo: sexo || null,
      ano_nascimento: anoNascimento ? Number(anoNascimento) : null,
    };
    if (telefoneMudou) {
      payload.telefone_verificado = false;
      setTelefoneVerificado(false);
    }
    const { error } = await supabase.from("users").update(payload).eq("id", user.id);
    setSaving(false);
    if (error) {
      toast.error("Erro ao salvar perfil");
      return;
    }
    setTelefoneOriginal(telefoneDigits);
    toast.success("Perfil atualizado");
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Carregando…
      </div>
    );
  }

  return (
    <Card className="mt-6 p-6 sm:p-8">
      <div className="mb-6">
        <h2 className="font-display text-xl font-semibold">Meu Perfil</h2>
        <p className="text-sm text-muted-foreground">Dados pessoais e contato</p>
      </div>

      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        {/* Email */}
        <div className="md:col-span-2">
          <Label className="text-sm">
            E-mail
            <span className="ml-2 text-xs font-normal text-muted-foreground">
              (não editável — vinculado ao seu acesso)
            </span>
          </Label>
          <Input
            value={user?.email ?? ""}
            disabled
            className="mt-1.5 cursor-not-allowed bg-muted/40 text-muted-foreground"
          />
        </div>

        {/* Celular */}
        <div>
          <div className="flex items-center justify-between">
            <Label className="text-sm">Celular</Label>
            {telefoneDigits.length === 11 && (
              telefoneVerificado && !telefoneMudou ? (
                <Badge variant="outline" className="border-emerald-500/30 bg-emerald-500/15 text-emerald-500">
                  <ShieldCheck className="mr-1 h-3 w-3" /> Verificado
                </Badge>
              ) : (
                <Badge variant="outline" className="border-amber-500/30 bg-amber-500/15 text-amber-500">
                  <ShieldAlert className="mr-1 h-3 w-3" /> Não verificado
                </Badge>
              )
            )}
          </div>
          <Input
            value={telefone}
            onChange={(e) => setTelefone(maskPhone(e.target.value))}
            placeholder="(11) 91234-5678"
            inputMode="numeric"
            maxLength={16}
            className="mt-1.5"
          />
        </div>

        {/* Cidade */}
        <div>
          <Label className="text-sm">Cidade</Label>
          <Input
            value={cidade}
            onChange={(e) => setCidade(e.target.value)}
            placeholder="Ex: Porto Alegre"
            maxLength={80}
            className="mt-1.5"
          />
        </div>

        {/* Estado */}
        <div>
          <Label className="text-sm">Estado</Label>
          <Select value={estado} onValueChange={setEstado}>
            <SelectTrigger className="mt-1.5">
              <SelectValue placeholder="Selecione o estado" />
            </SelectTrigger>
            <SelectContent className="max-h-72">
              {ESTADOS.map((e) => (
                <SelectItem key={e.uf} value={e.uf}>
                  {e.uf} — {e.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Sexo */}
        <div>
          <Label className="text-sm">Sexo</Label>
          <Select value={sexo} onValueChange={setSexo}>
            <SelectTrigger className="mt-1.5">
              <SelectValue placeholder="Selecione" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="masculino">Masculino</SelectItem>
              <SelectItem value="feminino">Feminino</SelectItem>
              <SelectItem value="nao_informar">Prefiro não informar</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Ano de nascimento */}
        <div>
          <Label className="text-sm">Ano de nascimento</Label>
          <Input
            type="number"
            value={anoNascimento}
            onChange={(e) => setAnoNascimento(e.target.value.replace(/\D/g, "").slice(0, 4))}
            min={1940}
            max={2006}
            placeholder="Ex: 1985"
            className="mt-1.5"
          />
          {idade !== null && (
            <p className="mt-1 text-xs text-muted-foreground">{idade} anos</p>
          )}
        </div>
      </div>

      <div className="mt-8 flex justify-end border-t border-border/60 pt-6">
        <Button variant="gradient" onClick={onSave} disabled={saving}>
          {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
          Salvar perfil
        </Button>
      </div>
    </Card>
  );
}
