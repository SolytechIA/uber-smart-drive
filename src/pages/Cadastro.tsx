import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { z } from "zod";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AuthLayout } from "@/components/AuthLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";

const schema = z
  .object({
    nome: z.string().trim().min(2, "Informe seu nome").max(100),
    email: z.string().trim().email("E-mail inválido").max(255),
    telefone: z.string().trim().min(10, "Telefone inválido").max(20),
    cidade: z.string().trim().min(2, "Informe sua cidade").max(80),
    senha: z.string().min(8, "Senha deve ter ao menos 8 caracteres").max(72),
    confirmar: z.string(),
    aceite: z.literal(true, { errorMap: () => ({ message: "Você precisa aceitar a Política de Privacidade para continuar." }) }),
  })
  .refine((d) => d.senha === d.confirmar, {
    path: ["confirmar"],
    message: "As senhas não conferem",
  });

function maskPhone(v: string) {
  const d = v.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 10) {
    return d.replace(/(\d{2})(\d{0,4})(\d{0,4}).*/, (_, a, b, c) =>
      [a && `(${a}`, a.length === 2 ? ") " : "", b, c && `-${c}`].filter(Boolean).join("")
    );
  }
  return d.replace(/(\d{2})(\d{5})(\d{0,4}).*/, "($1) $2-$3");
}

export default function Cadastro() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    nome: "",
    email: "",
    telefone: "",
    cidade: "",
    senha: "",
    confirmar: "",
    aceite: false,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleChange = (k: string, v: string | boolean) => {
    setForm((f) => ({ ...f, [k]: v }));
    setErrors((e) => ({ ...e, [k]: "" }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = schema.safeParse(form);
    if (!parsed.success) {
      const errs: Record<string, string> = {};
      parsed.error.errors.forEach((er) => (errs[er.path[0] as string] = er.message));
      setErrors(errs);
      return;
    }

    setLoading(true);
    const { data: signUpData, error } = await supabase.auth.signUp({
      email: parsed.data.email,
      password: parsed.data.senha,
      options: {
        emailRedirectTo: `${window.location.origin}/login`,
        data: {
          nome: parsed.data.nome,
          telefone: parsed.data.telefone,
          cidade: parsed.data.cidade,
        },
      },
    });

    if (error) {
      setLoading(false);
      if (error.message.toLowerCase().includes("registered")) {
        toast.error("Este e-mail já está cadastrado.");
      } else {
        toast.error(error.message);
      }
      return;
    }

    // Persiste aceite de privacidade (se sessão já existe)
    if (signUpData.user?.id) {
      await supabase
        .from("users")
        .update({ aceite_privacidade: true, aceite_privacidade_em: new Date().toISOString() })
        .eq("id", signUpData.user.id);
    }
    setLoading(false);

    toast.success("Conta criada! Verifique seu e-mail para confirmar.");
    navigate("/login");
  };

  return (
    <AuthLayout
      title="Criar conta grátis"
      subtitle="7 dias grátis. Sem cartão de crédito."
      footer={
        <>
          Já tem conta?{" "}
          <Link to="/login" className="font-medium text-primary hover:underline">
            Entrar
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <Label htmlFor="nome">Nome completo</Label>
          <Input id="nome" value={form.nome} onChange={(e) => handleChange("nome", e.target.value)} />
          {errors.nome && <p className="mt-1 text-xs text-destructive">{errors.nome}</p>}
        </div>
        <div>
          <Label htmlFor="email">E-mail</Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            value={form.email}
            onChange={(e) => handleChange("email", e.target.value)}
          />
          {errors.email && <p className="mt-1 text-xs text-destructive">{errors.email}</p>}
          <div className="mt-2 flex items-start gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 p-2.5 text-xs text-amber-700 dark:text-amber-400">
            <span className="leading-none">⚠️</span>
            <p className="leading-snug">
              <strong>Importante:</strong> use o mesmo e-mail da sua conta Uber. Isso permitirá a sincronização automática das suas corridas em breve.
            </p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="telefone">Telefone</Label>
            <Input
              id="telefone"
              placeholder="(11) 91234-5678"
              value={form.telefone}
              onChange={(e) => handleChange("telefone", maskPhone(e.target.value))}
            />
            {errors.telefone && <p className="mt-1 text-xs text-destructive">{errors.telefone}</p>}
          </div>
          <div>
            <Label htmlFor="cidade">Cidade</Label>
            <Input id="cidade" value={form.cidade} onChange={(e) => handleChange("cidade", e.target.value)} />
            {errors.cidade && <p className="mt-1 text-xs text-destructive">{errors.cidade}</p>}
          </div>
        </div>
        <div>
          <Label htmlFor="senha">Senha</Label>
          <Input
            id="senha"
            type="password"
            autoComplete="new-password"
            value={form.senha}
            onChange={(e) => handleChange("senha", e.target.value)}
          />
          {errors.senha && <p className="mt-1 text-xs text-destructive">{errors.senha}</p>}
        </div>
        <div>
          <Label htmlFor="confirmar">Confirmar senha</Label>
          <Input
            id="confirmar"
            type="password"
            autoComplete="new-password"
            value={form.confirmar}
            onChange={(e) => handleChange("confirmar", e.target.value)}
          />
          {errors.confirmar && <p className="mt-1 text-xs text-destructive">{errors.confirmar}</p>}
        </div>
        <div className="flex items-start gap-2">
          <Checkbox
            id="aceite"
            checked={form.aceite}
            onCheckedChange={(v) => handleChange("aceite", v === true)}
            className="mt-0.5"
          />
          <Label htmlFor="aceite" className="text-xs font-normal leading-relaxed text-muted-foreground">
            Li e concordo com a{" "}
            <a href="/privacidade" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
              Política de Privacidade
            </a>
          </Label>
        </div>
        {errors.aceite && <p className="-mt-2 text-xs text-destructive">{errors.aceite}</p>}

        <Button type="submit" variant="gradient" size="lg" className="w-full" disabled={loading}>
          {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Criar conta grátis
        </Button>
      </form>
    </AuthLayout>
  );
}
