import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { AuthLayout } from "@/components/AuthLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

const schema = z
  .object({
    senha: z.string().min(8, "Senha deve ter ao menos 8 caracteres").max(72),
    confirmar: z.string(),
  })
  .refine((d) => d.senha === d.confirmar, {
    path: ["confirmar"],
    message: "As senhas não conferem",
  });

export default function RedefinirSenha() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ senha: "", confirmar: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    // Supabase processes the recovery hash automatically and emits PASSWORD_RECOVERY
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") setReady(true);
    });
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setReady(true);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

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
    const { error } = await supabase.auth.updateUser({ password: parsed.data.senha });
    setLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Senha atualizada com sucesso!");
    navigate("/dashboard/operacional");
  };

  return (
    <AuthLayout title="Redefinir senha" subtitle="Crie uma nova senha para sua conta.">
      {!ready ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="senha">Nova senha</Label>
            <Input
              id="senha"
              type="password"
              autoComplete="new-password"
              value={form.senha}
              onChange={(e) => {
                setForm((f) => ({ ...f, senha: e.target.value }));
                setErrors((er) => ({ ...er, senha: "" }));
              }}
            />
            {errors.senha && <p className="mt-1 text-xs text-destructive">{errors.senha}</p>}
          </div>
          <div>
            <Label htmlFor="confirmar">Confirmar nova senha</Label>
            <Input
              id="confirmar"
              type="password"
              autoComplete="new-password"
              value={form.confirmar}
              onChange={(e) => {
                setForm((f) => ({ ...f, confirmar: e.target.value }));
                setErrors((er) => ({ ...er, confirmar: "" }));
              }}
            />
            {errors.confirmar && <p className="mt-1 text-xs text-destructive">{errors.confirmar}</p>}
          </div>
          <Button type="submit" variant="gradient" size="lg" className="w-full" disabled={loading}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Atualizar senha
          </Button>
        </form>
      )}
    </AuthLayout>
  );
}
