import { Check, Circle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { calcularDiasEmAberto, derivarStatus, type SacOcorrencia } from "@/lib/sacAnalysis";
import { cn } from "@/lib/utils";

type SacOccurrenceDetailProps = {
  ocorrencia: SacOcorrencia | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

const STATUS_LABEL = {
  aberta: "Em andamento",
  atrasada: "Atrasada",
  critica: "Crítica",
  encerrada: "Encerrada",
} as const;

const STATUS_VARIANT = {
  aberta: "secondary",
  atrasada: "destructive",
  critica: "destructive",
  encerrada: "default",
} as const;

const formatarData = (iso: string | null): string => {
  if (!iso) return "—";
  const [ano, mes, dia] = iso.split("-");
  return `${dia}/${mes}/${ano}`;
};

const Campo = ({ label, valor }: { label: string; valor: string | null }) => (
  <div>
    <dt className="text-xs text-muted-foreground">{label}</dt>
    <dd className="text-sm text-foreground mt-0.5">{valor || "—"}</dd>
  </div>
);

type EtapaTimeline = { label: string; data: string | null };

const Timeline = ({ etapas }: { etapas: EtapaTimeline[] }) => (
  <ol className="space-y-3">
    {etapas.map((etapa, i) => {
      const concluida = Boolean(etapa.data);
      return (
        <li key={i} className="flex items-start gap-3">
          <span
            className={cn(
              "flex h-5 w-5 shrink-0 items-center justify-center rounded-full mt-0.5",
              concluida ? "bg-emerald-500/15 text-emerald-600" : "bg-muted text-muted-foreground/50"
            )}
          >
            {concluida ? <Check className="h-3 w-3" /> : <Circle className="h-2 w-2 fill-current" />}
          </span>
          <div>
            <p className={cn("text-sm", concluida ? "text-foreground font-medium" : "text-muted-foreground")}>
              {etapa.label}
            </p>
            <p className="text-xs text-muted-foreground">{formatarData(etapa.data)}</p>
          </div>
        </li>
      );
    })}
  </ol>
);

const SacOccurrenceDetail = ({ ocorrencia, open, onOpenChange }: SacOccurrenceDetailProps) => {
  if (!ocorrencia) return null;

  const status = derivarStatus(ocorrencia);
  const dias = calcularDiasEmAberto(ocorrencia);

  const etapas: EtapaTimeline[] = [
    { label: "Ocorrência registrada", data: ocorrencia.data_email },
    { label: "Fornecedor comunicado", data: ocorrencia.fornecedor_comunicado_em },
    { label: "Associado comunicado", data: ocorrencia.associado_comunicado_em },
    { label: "Ressarcimento realizado", data: ocorrencia.ressarcimento_em },
    { label: "RNC finalizado", data: ocorrencia.rnc_finalizado_em },
  ];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <div className="flex items-center gap-2 flex-wrap">
            <SheetTitle>{ocorrencia.num_ocorrencia}</SheetTitle>
            <Badge variant={STATUS_VARIANT[status]}>{STATUS_LABEL[status]}</Badge>
            {ocorrencia.criticidade && <Badge variant="outline">{ocorrencia.criticidade}</Badge>}
          </div>
          <SheetDescription>
            {status === "encerrada"
              ? `Resolvida em ${ocorrencia.dias_resolucao ?? "—"} dias`
              : dias !== null
              ? `Em aberto há ${dias} ${dias === 1 ? "dia" : "dias"}`
              : "Visualização somente leitura"}
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          <section className="space-y-3">
            <h3 className="text-sm font-semibold text-foreground">Produto</h3>
            <dl className="grid grid-cols-2 gap-4">
              <Campo label="Produto" valor={ocorrencia.produto} />
              <Campo label="Lote" valor={ocorrencia.lote} />
              <Campo label="Data de fabricação" valor={formatarData(ocorrencia.data_fabricacao)} />
              <Campo label="Data de validade" valor={formatarData(ocorrencia.data_validade)} />
            </dl>
          </section>

          <section className="space-y-3 border-t border-border/60 pt-4">
            <h3 className="text-sm font-semibold text-foreground">Fornecedor e associado</h3>
            <dl className="grid grid-cols-2 gap-4">
              <Campo label="Fornecedor" valor={ocorrencia.fornecedor} />
              <Campo label="Associado" valor={ocorrencia.associado} />
            </dl>
          </section>

          <section className="space-y-3 border-t border-border/60 pt-4">
            <h3 className="text-sm font-semibold text-foreground">Ocorrência</h3>
            <dl className="grid grid-cols-2 gap-4">
              <Campo label="Tipo" valor={ocorrencia.tipo_ocorrencia} />
              <Campo label="Criticidade" valor={ocorrencia.criticidade} />
            </dl>
            <Campo label="Descrição" valor={ocorrencia.ocorrencia_descricao} />
            {ocorrencia.observacao && <Campo label="Observação" valor={ocorrencia.observacao} />}
          </section>

          <section className="space-y-3 border-t border-border/60 pt-4">
            <h3 className="text-sm font-semibold text-foreground">Timeline do atendimento</h3>
            <Timeline etapas={etapas} />
          </section>

          <p className="text-xs text-muted-foreground border-t border-border/60 pt-4">
            Dados do consumidor não são exibidos nesta visualização, conforme política de proteção
            de dados do projeto.
          </p>
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default SacOccurrenceDetail;
