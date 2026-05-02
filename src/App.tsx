import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import Index from "./pages/Index";
import Cadastro from "./pages/Cadastro";
import Login from "./pages/Login";
import RecuperarSenha from "./pages/RecuperarSenha";
import RedefinirSenha from "./pages/RedefinirSenha";
import Onboarding from "./pages/Onboarding";
import DashboardOperacional from "./pages/DashboardOperacional";
import DashboardFinanceiro from "./pages/DashboardFinanceiro";
import Configuracoes from "./pages/Configuracoes";
import Relatorios from "./pages/Relatorios";
import AnaliseIA from "./pages/AnaliseIA";
import ConectarUber from "./pages/ConectarUber";
import Admin from "./pages/Admin";
import Planos from "./pages/Planos";
import Privacidade from "./pages/Privacidade";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
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
              path="/relatorios"
              element={
                <ProtectedRoute requireVehicle>
                  <Relatorios />
                </ProtectedRoute>
              }
            />
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
              path="/configuracoes/conectar-uber"
              element={
                <ProtectedRoute requireVehicle>
                  <ConectarUber />
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
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
