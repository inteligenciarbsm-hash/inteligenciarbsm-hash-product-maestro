import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export type UserProfile = {
  id: string;
  email: string;
  approved: boolean;
  approval_token: string;
  created_at: string;
};

/**
 * Lê o perfil do usuário logado pra checar se ele já foi aprovado pelo admin.
 * Quem não tiver perfil ainda (caso raro de race com o trigger) é tratado
 * como não-aprovado.
 */
export const useUserProfile = () => {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["user-profile", user?.id],
    queryFn: async (): Promise<UserProfile | null> => {
      if (!user) return null;
      const { data, error } = await supabase
        .from("user_profiles")
        .select("*")
        .eq("id", user.id)
        .maybeSingle();
      if (error) throw error;
      return (data as UserProfile | null) ?? null;
    },
    enabled: !!user,
    staleTime: 30_000,
    refetchInterval: 60_000,
  });
};
