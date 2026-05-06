import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import NotFound from "./pages/NotFound.tsx";
import Pesquisas from "./pages/Pesquisas.tsx";
import Comparativo from "./pages/Comparativo.tsx";
import Auth from "./pages/Auth.tsx";
import AguardandoAprovacao from "./pages/AguardandoAprovacao.tsx";
import Aprovar from "./pages/Aprovar.tsx";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/" element={<Navigate to="/pesquisas" replace />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/aprovar" element={<Aprovar />} />
            <Route path="/aguardando-aprovacao" element={<AguardandoAprovacao />} />
            <Route
              path="/pesquisas"
              element={
                <ProtectedRoute>
                  <Pesquisas />
                </ProtectedRoute>
              }
            />
            <Route
              path="/comparativo"
              element={
                <ProtectedRoute>
                  <Comparativo />
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
