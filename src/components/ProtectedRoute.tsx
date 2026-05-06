import { Navigate } from "react-router-dom";
import { ReactNode } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useUserProfile } from "@/hooks/useUserProfile";

const ProtectedRoute = ({ children }: { children: ReactNode }) => {
  const { user, loading } = useAuth();
  const { data: profile, isLoading: profileLoading } = useUserProfile();

  if (loading || (user && profileLoading)) {
    return (
      <div className="min-h-screen flex items-center justify-center text-muted-foreground">
        Carregando...
      </div>
    );
  }

  if (!user) return <Navigate to="/auth" replace />;

  // Sem perfil ainda OU perfil não aprovado → tela de espera
  if (!profile || !profile.approved) {
    return <Navigate to="/aguardando-aprovacao" replace />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;
