import { Link } from "react-router-dom";
import { Logo } from "@/components/Logo";

export default function Privacidade() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border/40">
        <div className="mx-auto flex h-16 max-w-4xl items-center justify-between px-4">
          <Link to="/"><Logo size="sm" /></Link>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-16">
        <h1 className="font-display text-3xl font-bold">Política de Privacidade</h1>
        <p className="mt-4 text-muted-foreground">
          Em breve disponibilizaremos a versão completa da nossa Política de Privacidade.
          Para qualquer dúvida sobre tratamento de dados, entre em contato:{" "}
          <a className="text-primary hover:underline" href="mailto:contato.solytech@gmail.com">
            contato.solytech@gmail.com
          </a>.
        </p>
      </main>
    </div>
  );
}
