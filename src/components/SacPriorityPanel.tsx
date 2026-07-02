import { CheckCircle2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { PrioridadeItem } from "@/lib/sacAnalysis";

type SacPriorityPanelProps = {
  prioridades: PrioridadeItem[];
};

const URGENCIA_CONFIG: Record<PrioridadeItem["urgencia"], { badgeVariant: "destructive" | "secondary"; label: string }> = {
  alta: { badgeVariant: "destructive", label: "Alta prioridade" },
  media: { badgeVariant: "secondary", label: "Média prioridade" },
};

const SacPriorityPanel = ({ prioridades }: SacPriorityPanelProps) => {
  if (prioridades.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-10 px-4 text-center">
        <CheckCircle2 className="h-9 w-9 text-emerald-500/60" />
        <p className="text-sm font-medium text-foreground">Nada exige sua atenção agora.</p>
        <p className="text-xs text-muted-foreground max-w-sm">
          Não há criticidades, atrasos ou pendências relevantes no momento.
        </p>
      </div>
    );
  }

  return (
    <ol className="space-y-2">
      {prioridades.map((item, i) => {
        const config = URGENCIA_CONFIG[item.urgencia];
        return (
          <li key={item.id} className="flex items-start gap-3 rounded-lg border border-border/70 p-3">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold text-muted-foreground">
              {i + 1}
            </span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-sm font-medium text-foreground">{item.titulo}</p>
                <Badge variant={config.badgeVariant} className="shrink-0">
                  {config.label}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground mt-0.5">{item.descricao}</p>
            </div>
          </li>
        );
      })}
    </ol>
  );
};

export default SacPriorityPanel;
