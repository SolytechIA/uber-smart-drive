import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { AuthLayout } from "@/components/AuthLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

const schema = z.object({
  email: z.string().trim().email("E-mail inválido").max(255),
  senha: z.string().min(1, "Informe sua senha").max(72),
});

export default function Login() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ email: "", senha: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});

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
    const { data, error } = await supabase.auth.signInWithPassword({
      email: parsed.data.email,
      password: parsed.data.senha,
    });
    if (error) {
      setLoading(false);
      if (error.message.toLowerCase().includes("invalid")) {
        toast.error("E-mail ou senha incorretos.");
      } else if (error.message.toLowerCase().includes("confirm")) {
        toast.error("Confirme seu e-mail antes de entrar.");
      } else {
        toast.error(error.message);
      }
      return;
    }

    // Verificar se já tem veículo cadastrado
    const userId = data.user?.id;
    if (userId) {
      const { count } = await supabase
        .from("vehicles")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId);
      setLoading(false);
      navigate(count && count > 0 ? "/dashboard/operacional" : "/onboarding");
    } else {
      setLoading(false);
      navigate("/onboarding");
    }
  };

  return (
    <AuthLayout
      title="Entrar na sua conta"
      subtitle="Bem-vindo de volta!"
      footer={
        <div className="space-y-2">
          <div>
            <Link to="/recuperar-senha" className="text-primary hover:underline">
              Esqueci minha senha
            </Link>
          </div>
          <div>
            Não tem conta?{" "}
            <Link to="/cadastro" className="font-medium text-primary hover:underline">
              Criar conta grátis
            </Link>
          </div>
        </div>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <Label htmlFor="email">E-mail</Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            value={form.email}
            onChange={(e) => {
              setForm((f) => ({ ...f, email: e.target.value }));
              setErrors((er) => ({ ...er, email: "" }));
            }}
          />
          {errors.email && <p className="mt-1 text-xs text-destructive">{errors.email}</p>}
        </div>
        <div>
          <Label htmlFor="senha">Senha</Label>
          <Input
            id="senha"
            type="password"
            autoComplete="current-password"
            value={form.senha}
            onChange={(e) => {
              setForm((f) => ({ ...f, senha: e.target.value }));
              setErrors((er) => ({ ...er, senha: "" }));
            }}
          />
          {errors.senha && <p className="mt-1 text-xs text-destructive">{errors.senha}</p>}
        </div>
        <Button type="submit" variant="gradient" size="lg" className="w-full" disabled={loading}>
          {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Entrar
        </Button>
      </form>
    </AuthLayout>
  );
}
