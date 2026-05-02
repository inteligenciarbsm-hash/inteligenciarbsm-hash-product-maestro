import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables, TablesInsert, TablesUpdate } from "@/integrations/supabase/types";
import { useAuth } from "@/contexts/AuthContext";

export type Ticket = Tables<"tickets">;
export type TicketInput = Omit<TablesInsert<"tickets">, "user_id" | "id" | "created_at" | "updated_at">;

export const TICKET_CATEGORIES = [
  { value: "defeito", label: "Defeito" },
  { value: "embalagem", label: "Embalagem" },
  { value: "falta_item", label: "Falta de item" },
  { value: "duvida", label: "Dúvida" },
  { value: "sugestao", label: "Sugestão" },
  { value: "outros", label: "Outros" },
] as const;

export const TICKET_PRIORITIES = [
  { value: "baixa", label: "Baixa" },
  { value: "media", label: "Média" },
  { value: "alta", label: "Alta" },
] as const;

export const TICKET_STATUSES = [
  { value: "aberto", label: "Aberto" },
  { value: "em_andamento", label: "Em andamento" },
  { value: "resolvido", label: "Resolvido" },
  { value: "cancelado", label: "Cancelado" },
] as const;

const TICKETS_KEY = ["tickets"] as const;

export const useTickets = (statusFilter?: string) => {
  return useQuery({
    queryKey: [...TICKETS_KEY, statusFilter ?? "all"],
    queryFn: async (): Promise<Ticket[]> => {
      let query = supabase.from("tickets").select("*").order("created_at", { ascending: false });
      if (statusFilter && statusFilter !== "all") {
        query = query.eq("status", statusFilter);
      }
      const { data, error } = await query;
      if (error) throw error;
      return data ?? [];
    },
  });
};

export const useCreateTicket = () => {
  const qc = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (input: TicketInput) => {
      if (!user) throw new Error("Não autenticado");
      const { data, error } = await supabase
        .from("tickets")
        .insert({ ...input, user_id: user.id })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: TICKETS_KEY }),
  });
};

export const useUpdateTicket = () => {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: TablesUpdate<"tickets"> }) => {
      const { data, error } = await supabase
        .from("tickets")
        .update(patch)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: TICKETS_KEY }),
  });
};

export const useDeleteTicket = () => {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("tickets").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: TICKETS_KEY }),
  });
};
