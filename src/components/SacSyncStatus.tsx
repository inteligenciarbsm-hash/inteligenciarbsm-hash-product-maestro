import { AlertCircle, CheckCircle2, RefreshCw, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useSacSync, useSacSyncStatus } from "@/hooks/useOcorrencias";

function formatRelativeTime(iso: string): string {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60_000);
  if (mins < 1) return "agora há pouco";
  if (mins < 60) return `há ${mins} min`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `há ${hrs}h`;
  return `há ${Math.floor(hrs / 24)}d`;
}

const STATUS_CONFIG = {
  ok: {
    Icon: CheckCircle2,
    iconClass: "text-emerald-500",
    badge: (
      <Badge className="text-[10px] px-1.5 py-0 bg-emerald-500/10 text-emerald-700 border-emerald-200">
        sincronizado
      </Badge>
    ),
  },
  parcial: {
    Icon: AlertCircle,
    iconClass: "text-amber-500",
    badge: (
      <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-amber-300 text-amber-600">
        parcial
      </Badge>
    ),
  },
  falha: {
    Icon: XCircle,
    iconClass: "text-destructive",
    badge: (
      <Badge variant="destructive" className="text-[10px] px-1.5 py-0">
        falha
      </Badge>
    ),
  },
} as const;

const SacSyncStatus = () => {
  const { data: syncLog, isLoading } = useSacSyncStatus();
  const { mutate: sincronizar, isPending } = useSacSync();

  const config = syncLog ? STATUS_CONFIG[syncLog.status] : null;

  return (
    <div className="flex items-center gap-3 flex-wrap">
      {isLoading ? (
        <Skeleton className="h-4 w-48" />
      ) : syncLog && config ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <config.Icon className={`h-4 w-4 shrink-0 ${config.iconClass}`} />
          <span>Último sync {formatRelativeTime(syncLog.iniciado_em)}</span>
          {config.badge}
          {syncLog.linhas_atualizadas > 0 && (
            <span className="text-xs hidden sm:inline">
              · {syncLog.linhas_atualizadas} ocorrências
            </span>
          )}
        </div>
      ) : (
        <span className="text-sm text-muted-foreground">Nunca sincronizado</span>
      )}

      <Button
        variant="outline"
        size="sm"
        onClick={() => sincronizar()}
        disabled={isPending}
        className="gap-1.5 h-8"
      >
        <RefreshCw className={`h-3.5 w-3.5 ${isPending ? "animate-spin" : ""}`} />
        {isPending ? "Atualizando…" : "Atualizar agora"}
      </Button>
    </div>
  );
};

export default SacSyncStatus;
