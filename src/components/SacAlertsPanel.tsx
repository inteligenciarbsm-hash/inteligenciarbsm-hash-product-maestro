import { AlertTriangle, CheckCircle2, Info, OctagonAlert } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { AlertaNivel, SacAlerta } from "@/lib/sacAnalysis";

type SacAlertsPanelProps = {
  alertas: SacAlerta[];
};

const NIVEL_CONFIG: Record<
  AlertaNivel,
  { icon: React.ElementType; iconClass: string; badgeVariant: "destructive" | "secondary" | "outline"; label: string }
> = {
  critico: {
    icon: OctagonAlert,
    iconClass: "text-destructive",
    badgeVariant: "destructive",
    label: "Crítico",
  },
  atencao: {
    icon: AlertTriangle,
    iconClass: "text-amber-600",
    badgeVariant: "secondary",
    label: "Atenção",
  },
  info: {
    icon: Info,
    iconClass: "text-muted-foreground",
    badgeVariant: "outline",
    label: "Info",
  },
};

// Evita rolagem excessiva na visão executiva — casos adicionais aparecerão
// na tabela completa quando ela for implementada (fase de tabela/filtros).
const MAX_ALERTAS_VISIVEIS = 6;

const SacAlertsPanel = ({ alertas }: SacAlertsPanelProps) => {
  if (alertas.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-10 px-4 text-center">
        <CheckCircle2 className="h-9 w-9 text-emerald-500/60" />
        <p className="text-sm font-medium text-foreground">Nenhuma pendência crítica no momento.</p>
        <p className="text-xs text-muted-foreground max-w-sm">
          Todas as ocorrências estão dentro do prazo e sem alertas de comunicação pendente.
        </p>
      </div>
    );
  }

  const visiveis = alertas.slice(0, MAX_ALERTAS_VISIVEIS);
  const restantes = alertas.length - visiveis.length;

  return (
    <div className="space-y-2">
      {visiveis.map((alerta) => {
        const config = NIVEL_CONFIG[alerta.nivel];
        return (
          <div
            key={alerta.id}
            className="flex items-start gap-3 rounded-lg border border-border/70 p-3"
          >
            <config.icon className={`h-4 w-4 shrink-0 mt-0.5 ${config.iconClass}`} />
            <p className="text-sm text-foreground flex-1">{alerta.mensagem}</p>
            <Badge variant={config.badgeVariant} className="shrink-0">
              {config.label}
            </Badge>
          </div>
        );
      })}

      {restantes > 0 && (
        <p className="text-xs text-muted-foreground text-center pt-1">
          + {restantes} {restantes === 1 ? "outro caso precisa" : "outros casos precisam"} de atenção.
        </p>
      )}
    </div>
  );
};

export default SacAlertsPanel;
