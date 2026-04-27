import { Link } from "react-router-dom";
import { Construction, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Logo } from "@/components/Logo";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useAuth } from "@/contexts/AuthContext";

interface PlaceholderProps {
  title: string;
  description: string;
}

export function Placeholder({ title, description }: PlaceholderProps) {
  const { signOut, user } = useAuth();
  return (
    <div className="relative min-h-screen bg-background">
      <div className="pointer-events-none absolute inset-0 dark:[background:var(--gradient-bg)]" />
      <header className="relative z-10 flex items-center justify-between border-b border-border/40 p-4">
        <Link to="/">
          <Logo />
        </Link>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          {user && (
            <Button variant="ghost" size="sm" onClick={signOut}>
              <LogOut className="mr-2 h-4 w-4" />
              Sair
            </Button>
          )}
        </div>
      </header>
      <main className="relative z-10 flex min-h-[calc(100vh-72px)] items-center justify-center p-4">
        <Card className="w-full max-w-md p-8 text-center shadow-card animate-fade-in">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full gradient-bg-soft">
            <Construction className="h-7 w-7 text-primary" />
          </div>
          <h1 className="font-display text-2xl font-bold">{title}</h1>
          <p className="mt-2 text-sm text-muted-foreground">{description}</p>
          <p className="mt-4 text-xs text-muted-foreground">
            Esta tela será construída na próxima fase do projeto.
          </p>
        </Card>
      </main>
    </div>
  );
}
