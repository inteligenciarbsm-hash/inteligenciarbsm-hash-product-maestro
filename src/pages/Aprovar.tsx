import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

type State =
  | { status: "loading" }
  | { status: "success"; email: string | null }
  | { status: "error"; message: string };

const Aprovar = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");
  const [state, setState] = useState<State>({ status: "loading" });

  useEffect(() => {
    if (!token) {
      setState({ status: "error", message: "Token de aprovação ausente." });
      return;
    }
    (async () => {
      const { data, error } = await supabase.rpc("approve_user_by_token", { p_token: token });
      if (error) {
        setState({ status: "error", message: error.message });
        return;
      }
      // RPC retorna o e-mail aprovado (string) ou null se token inválido
      if (!data) {
        setState({ status: "error", message: "Token inválido ou já utilizado." });
        return;
      }
      setState({ status: "success", email: String(data) });
    })();
  }, [token]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-primary/5 to-background p-4">
      <Card className="w-full max-w-md border-border/60 shadow-lg">
        <CardHeader className="text-center space-y-3">
          <div className="flex justify-center">
            <img src="/zuppa.png" alt="Marca Própria" className="h-16 w-16 rounded-xl object-contain shadow-md" />
          </div>
          {state.status === "loading" && (
            <>
              <CardTitle className="flex items-center justify-center gap-2 text-xl">
                <Loader2 className="h-5 w-5 animate-spin" /> Processando aprovação...
              </CardTitle>
            </>
          )}
          {state.status === "success" && (
            <>
              <CardTitle className="flex items-center justify-center gap-2 text-xl text-emerald-700">
                <CheckCircle2 className="h-6 w-6" /> Usuário aprovado
              </CardTitle>
              <CardDescription className="mt-2">
                A conta <strong>{state.email}</strong> foi liberada. Ele já pode entrar
                no sistema.
              </CardDescription>
            </>
          )}
          {state.status === "error" && (
            <>
              <CardTitle className="flex items-center justify-center gap-2 text-xl text-rose-700">
                <XCircle className="h-6 w-6" /> Falha na aprovação
              </CardTitle>
              <CardDescription className="mt-2">{state.message}</CardDescription>
            </>
          )}
        </CardHeader>
        <CardContent />
      </Card>
    </div>
  );
};

export default Aprovar;
