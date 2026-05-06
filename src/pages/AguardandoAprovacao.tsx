import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Clock, LogOut } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

const AguardandoAprovacao = () => {
  const { user, signOut } = useAuth();

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-primary/5 to-background p-4">
      <Card className="w-full max-w-md border-border/60 shadow-lg">
        <CardHeader className="text-center space-y-3">
          <div className="flex justify-center">
            <img src="/zuppa.png" alt="ZUPPA" className="h-16 w-16 rounded-xl object-contain shadow-md" />
          </div>
          <div>
            <CardTitle className="flex items-center justify-center gap-2 text-xl">
              <Clock className="h-5 w-5 text-amber-500" />
              Aguardando aprovação
            </CardTitle>
            <CardDescription className="mt-2">
              Sua conta foi criada com o e-mail <strong>{user?.email}</strong>, mas ainda
              precisa ser aprovada pelo administrador antes que você consiga acessar o sistema.
              Você será notificado quando a aprovação for concedida.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <Button variant="outline" className="w-full" onClick={() => signOut()}>
            <LogOut className="h-4 w-4 mr-1" /> Sair
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default AguardandoAprovacao;
