import { lazy, Suspense } from "react";
import { Loader2 } from "lucide-react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import Index from "./pages/Index";
const Cadastro = lazy(() => import("./pages/Cadastro"));
const Login = lazy(() => import("./pages/Login"));
const RecuperarSenha = lazy(() => import("./pages/RecuperarSenha"));
const RedefinirSenha = lazy(() => import("./pages/RedefinirSenha"));
const Onboarding = lazy(() => import("./pages/Onboarding"));
const DashboardOperacional = lazy(() => import("./pages/DashboardOperacional"));
const DashboardFinanceiro = lazy(() => import("./pages/DashboardFinanceiro"));
const Configuracoes = lazy(() => import("./pages/Configuracoes"));
const Relatorios = lazy(() => import("./pages/Relatorios"));
const GraficosFinanceiros = lazy(() => import("./pages/GraficosFinanceiros"));
const GraficosPerformance = lazy(() => import("./pages/GraficosPerformance"));
const AnaliseIA = lazy(() => import("./pages/AnaliseIA"));
const Admin = lazy(() => import("./pages/Admin"));
const Planos = lazy(() => import("./pages/Planos"));
const Privacidade = lazy(() => import("./pages/Privacidade"));
const NotFound = lazy(() => import("./pages/NotFound"));

const queryClient = new QueryClient();

// Cada tela é baixada só quando o motorista a abre (app inicial bem mais leve no 4G)
const PageLoader = () => (
  <div className="flex min-h-screen items-center justify-center">
    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" aria-label="Carregando" />
  </div>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Suspense fallback={<PageLoader />}>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/cadastro" element={<Cadastro />} />
            <Route path="/login" element={<Login />} />
            <Route path="/recuperar-senha" element={<RecuperarSenha />} />
            <Route path="/redefinir-senha" element={<RedefinirSenha />} />
            <Route path="/privacidade" element={<Privacidade />} />

            <Route
              path="/planos"
              element={
                <ProtectedRoute requireActivePlan={false}>
                  <Planos />
                </ProtectedRoute>
              }
            />
            <Route
              path="/onboarding"
              element={
                <ProtectedRoute>
                  <Onboarding />
                </ProtectedRoute>
              }
            />
            <Route
              path="/dashboard/operacional"
              element={
                <ProtectedRoute requireVehicle>
                  <DashboardOperacional />
                </ProtectedRoute>
              }
            />
            <Route
              path="/dashboard/financeiro"
              element={
                <ProtectedRoute requireVehicle>
                  <DashboardFinanceiro />
                </ProtectedRoute>
              }
            />
            <Route
              path="/dashboard/painel-de-cards"
              element={
                <ProtectedRoute requireVehicle>
                  <Relatorios />
                </ProtectedRoute>
              }
            />
            <Route
              path="/dashboard/graficos-financeiros"
              element={
                <ProtectedRoute requireVehicle>
                  <GraficosFinanceiros />
                </ProtectedRoute>
              }
            />
            <Route
              path="/dashboard/graficos-performance"
              element={
                <ProtectedRoute requireVehicle>
                  <GraficosPerformance />
                </ProtectedRoute>
              }
            />
            {/* Redireciona a rota antiga */}
            <Route path="/relatorios" element={<Navigate to="/dashboard/painel-de-cards" replace />} />
            <Route
              path="/analise-ia"
              element={
                <ProtectedRoute requireVehicle>
                  <AnaliseIA />
                </ProtectedRoute>
              }
            />
            <Route
              path="/configuracoes"
              element={
                <ProtectedRoute requireVehicle>
                  <Configuracoes />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin"
              element={
                <ProtectedRoute requireAdmin>
                  <Admin />
                </ProtectedRoute>
              }
            />

            <Route path="*" element={<NotFound />} />
          </Routes>
          </Suspense>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
