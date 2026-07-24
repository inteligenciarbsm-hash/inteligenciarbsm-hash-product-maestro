import { Filter, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { PeriodoPreset, SacFiltrosTabela } from "@/lib/sacAnalysis";

// Sentinela usado pelos Selects — Radix não aceita value="" nos itens.
const TODOS = "__todos__";

const PERIODO_OPTIONS: { value: PeriodoPreset; label: string }[] = [
  { value: "todos", label: "Todo o período" },
  { value: "7d", label: "Últimos 7 dias" },
  { value: "30d", label: "Últimos 30 dias" },
  { value: "mes-atual", label: "Este mês" },
  { value: "mes-anterior", label: "Mês anterior" },
];

const STATUS_OPTIONS: { value: NonNullable<SacFiltrosTabela["status"]>; label: string }[] = [
  { value: "aberto", label: "Aberto" },
  { value: "finalizado", label: "Finalizado" },
];

type SacFiltersPanelProps = {
  filtros: SacFiltrosTabela;
  opcoes: {
    produtos: string[];
    fornecedores: string[];
    associados: string[];
    criticidades: string[];
    tipos: string[];
  };
  onChange: (patch: Partial<SacFiltrosTabela>) => void;
  onLimpar: () => void;
};

const temFiltroAtivo = (filtros: SacFiltrosTabela): boolean =>
  Boolean(
    (filtros.periodo && filtros.periodo !== "todos") ||
      filtros.produto ||
      filtros.fornecedor ||
      filtros.associado ||
      filtros.criticidade ||
      filtros.tipoOcorrencia ||
      filtros.status
  );

const SacFiltersPanel = ({ filtros, opcoes, onChange, onLimpar }: SacFiltersPanelProps) => {
  const ativos = temFiltroAtivo(filtros);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          Filtros
        </CardTitle>
        {ativos && (
          <Button variant="ghost" size="sm" onClick={onLimpar} className="gap-1.5 h-8 text-muted-foreground">
            <X className="h-3.5 w-3.5" />
            Limpar filtros
          </Button>
        )}
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-7 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="sac-filtro-periodo">Período</Label>
            <Select
              value={filtros.periodo ?? "todos"}
              onValueChange={(v) => onChange({ periodo: v as PeriodoPreset })}
            >
              <SelectTrigger id="sac-filtro-periodo">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PERIODO_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="sac-filtro-fornecedor">Fornecedor</Label>
            <Select
              value={filtros.fornecedor ?? TODOS}
              onValueChange={(v) => onChange({ fornecedor: v === TODOS ? undefined : v })}
            >
              <SelectTrigger id="sac-filtro-fornecedor">
                <SelectValue placeholder="Todos os fornecedores" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={TODOS}>Todos os fornecedores</SelectItem>
                {opcoes.fornecedores.map((v) => (
                  <SelectItem key={v} value={v}>
                    {v}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="sac-filtro-socio">Sócio</Label>
            <Select
              value={filtros.associado ?? TODOS}
              onValueChange={(v) => onChange({ associado: v === TODOS ? undefined : v })}
            >
              <SelectTrigger id="sac-filtro-socio">
                <SelectValue placeholder="Todos os sócios" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={TODOS}>Todos os sócios</SelectItem>
                {opcoes.associados.map((v) => (
                  <SelectItem key={v} value={v}>
                    {v}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="sac-filtro-produto">Produto</Label>
            <Select
              value={filtros.produto ?? TODOS}
              onValueChange={(v) => onChange({ produto: v === TODOS ? undefined : v })}
            >
              <SelectTrigger id="sac-filtro-produto">
                <SelectValue placeholder="Todos os produtos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={TODOS}>Todos os produtos</SelectItem>
                {opcoes.produtos.map((v) => (
                  <SelectItem key={v} value={v}>
                    {v}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="sac-filtro-criticidade">Criticidade</Label>
            <Select
              value={filtros.criticidade ?? TODOS}
              onValueChange={(v) => onChange({ criticidade: v === TODOS ? undefined : v })}
            >
              <SelectTrigger id="sac-filtro-criticidade">
                <SelectValue placeholder="Todas as criticidades" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={TODOS}>Todas as criticidades</SelectItem>
                {opcoes.criticidades.map((v) => (
                  <SelectItem key={v} value={v}>
                    {v}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="sac-filtro-tipo">Tipo de ocorrência</Label>
            <Select
              value={filtros.tipoOcorrencia ?? TODOS}
              onValueChange={(v) => onChange({ tipoOcorrencia: v === TODOS ? undefined : v })}
            >
              <SelectTrigger id="sac-filtro-tipo">
                <SelectValue placeholder="Todos os tipos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={TODOS}>Todos os tipos</SelectItem>
                {opcoes.tipos.map((v) => (
                  <SelectItem key={v} value={v}>
                    {v}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="sac-filtro-status">Status</Label>
            <Select
              value={filtros.status ?? TODOS}
              onValueChange={(v) => onChange({ status: v === TODOS ? undefined : (v as SacFiltrosTabela["status"]) })}
            >
              <SelectTrigger id="sac-filtro-status">
                <SelectValue placeholder="Todos os status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={TODOS}>Todos os status</SelectItem>
                {STATUS_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default SacFiltersPanel;
