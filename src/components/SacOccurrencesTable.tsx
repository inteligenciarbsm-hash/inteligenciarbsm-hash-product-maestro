import { useEffect, useMemo, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ChevronDown,
  Download,
  FileText,
  Loader2,
  Search,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import SacOccurrenceDetail from "@/components/SacOccurrenceDetail";
import {
  calcularDiasEmAberto,
  derivarStatus,
  filtrarOcorrencias,
  gerarCsvOcorrencias,
  gerarHtmlOcorrencias,
  montarLinhasExportacao,
  ordenarOcorrencias,
  type OcorrenciaStatus,
  type SacFiltrosTabela,
  type SacOcorrencia,
  type SacOrdenacaoCampo,
} from "@/lib/sacAnalysis";
import { baixarDocumentoRnc } from "@/lib/rncDocument";

type SacOccurrencesTableProps = {
  /** Ocorrências já filtradas pelo painel de filtros do topo da página. */
  ocorrencias: SacOcorrencia[];
};

const PAGE_SIZE = 15;

const STATUS_LABEL: Record<OcorrenciaStatus, string> = {
  aberta: "Em andamento",
  atrasada: "Atrasada",
  critica: "Crítica",
  encerrada: "Encerrada",
};

const STATUS_VARIANT: Record<OcorrenciaStatus, "default" | "secondary" | "destructive"> = {
  aberta: "secondary",
  atrasada: "destructive",
  critica: "destructive",
  encerrada: "default",
};

const COLUNAS: { campo: SacOrdenacaoCampo; label: string }[] = [
  { campo: "data", label: "Data" },
  { campo: "produto", label: "Produto" },
  { campo: "fornecedor", label: "Fornecedor" },
  { campo: "criticidade", label: "Criticidade" },
];

const baixarArquivo = (conteudo: string, nomeArquivo: string, mimeType: string) => {
  const blob = new Blob([conteudo], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = nomeArquivo;
  link.click();
  URL.revokeObjectURL(url);
};

const SacOccurrencesTable = ({ ocorrencias }: SacOccurrencesTableProps) => {
  const [busca, setBusca] = useState("");
  const [ordenacao, setOrdenacao] = useState<{ campo: SacOrdenacaoCampo; direcao: "asc" | "desc" }>({
    campo: "data",
    direcao: "desc",
  });
  const [pagina, setPagina] = useState(1);
  const [selecionada, setSelecionada] = useState<SacOcorrencia | null>(null);
  const [detalheAberto, setDetalheAberto] = useState(false);
  const [gerandoWordId, setGerandoWordId] = useState<string | null>(null);

  const buscaFiltros: SacFiltrosTabela = useMemo(() => ({ busca: busca || undefined }), [busca]);

  const filtradas = useMemo(
    () => filtrarOcorrencias(ocorrencias, buscaFiltros),
    [ocorrencias, buscaFiltros]
  );

  const ordenadas = useMemo(
    () => ordenarOcorrencias(filtradas, ordenacao.campo, ordenacao.direcao),
    [filtradas, ordenacao]
  );

  const totalPaginas = Math.max(1, Math.ceil(ordenadas.length / PAGE_SIZE));

  useEffect(() => {
    setPagina(1);
  }, [busca, ocorrencias]);

  useEffect(() => {
    if (pagina > totalPaginas) setPagina(totalPaginas);
  }, [pagina, totalPaginas]);

  const visiveis = useMemo(
    () => ordenadas.slice((pagina - 1) * PAGE_SIZE, pagina * PAGE_SIZE),
    [ordenadas, pagina]
  );

  const alternarOrdenacao = (campo: SacOrdenacaoCampo) => {
    setOrdenacao((atual) =>
      atual.campo === campo
        ? { campo, direcao: atual.direcao === "asc" ? "desc" : "asc" }
        : { campo, direcao: "asc" }
    );
  };

  const exportar = (formato: "csv" | "excel") => {
    const linhas = montarLinhasExportacao(ordenadas);
    const dataHoje = new Date().toISOString().slice(0, 10);

    if (formato === "csv") {
      baixarArquivo(gerarCsvOcorrencias(linhas), `central-sac-${dataHoje}.csv`, "text/csv;charset=utf-8");
    } else {
      baixarArquivo(
        gerarHtmlOcorrencias(linhas),
        `central-sac-${dataHoje}.xls`,
        "application/vnd.ms-excel;charset=utf-8"
      );
    }
  };

  const abrirDetalhe = (o: SacOcorrencia) => {
    setSelecionada(o);
    setDetalheAberto(true);
  };

  const gerarWord = async (o: SacOcorrencia) => {
    setGerandoWordId(o.id);
    try {
      await baixarDocumentoRnc(o);
    } catch (err) {
      console.error("Falha ao gerar o Word do RNC:", err);
    } finally {
      setGerandoWordId(null);
    }
  };

  return (
    <>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <Input
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar por produto, fornecedor ou nº da ocorrência"
          className="w-full sm:w-80"
        />
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground hidden sm:inline">
            {ordenadas.length} {ordenadas.length === 1 ? "ocorrência" : "ocorrências"}
          </span>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="gap-1.5" disabled={ordenadas.length === 0}>
                <Download className="h-3.5 w-3.5" />
                Exportar
                <ChevronDown className="h-3.5 w-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => exportar("csv")}>Exportar CSV</DropdownMenuItem>
              <DropdownMenuItem onClick={() => exportar("excel")}>Exportar Excel</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {ordenadas.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 py-12 px-4 text-center border border-dashed rounded-lg">
          <Search className="h-9 w-9 text-muted-foreground/30" />
          <p className="text-sm font-medium text-foreground">Nenhuma ocorrência encontrada</p>
          <p className="text-xs text-muted-foreground max-w-sm">
            Ajuste a busca ou os filtros acima para ver outros resultados.
          </p>
        </div>
      ) : (
        <>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nº ocorrência</TableHead>
                {COLUNAS.map((c) => (
                  <TableHead key={c.campo}>
                    <button
                      onClick={() => alternarOrdenacao(c.campo)}
                      className="flex items-center gap-1 hover:text-foreground transition-colors"
                    >
                      {c.label}
                      {ordenacao.campo === c.campo ? (
                        ordenacao.direcao === "asc" ? (
                          <ArrowUp className="h-3.5 w-3.5" />
                        ) : (
                          <ArrowDown className="h-3.5 w-3.5" />
                        )
                      ) : (
                        <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground/40" />
                      )}
                    </button>
                  </TableHead>
                ))}
                <TableHead>Associado</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Dias em aberto</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visiveis.map((o) => {
                const status = derivarStatus(o);
                const dias = calcularDiasEmAberto(o);
                return (
                  <TableRow
                    key={o.id}
                    onClick={() => abrirDetalhe(o)}
                    className="cursor-pointer"
                  >
                    <TableCell className="font-medium">{o.num_ocorrencia}</TableCell>
                    <TableCell className="whitespace-nowrap text-muted-foreground">
                      {o.data_email ? o.data_email.split("-").reverse().join("/") : "—"}
                    </TableCell>
                    <TableCell className="max-w-[180px] truncate" title={o.produto ?? undefined}>
                      {o.produto ?? "—"}
                    </TableCell>
                    <TableCell className="max-w-[180px] truncate" title={o.fornecedor ?? undefined}>
                      {o.fornecedor ?? "—"}
                    </TableCell>
                    <TableCell>{o.criticidade ?? "—"}</TableCell>
                    <TableCell className="max-w-[140px] truncate" title={o.associado ?? undefined}>
                      {o.associado ?? "—"}
                    </TableCell>
                    <TableCell className="max-w-[140px] truncate" title={o.tipo_ocorrencia ?? undefined}>
                      {o.tipo_ocorrencia ?? "—"}
                    </TableCell>
                    <TableCell>
                      <Badge variant={STATUS_VARIANT[status]}>{STATUS_LABEL[status]}</Badge>
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      {dias !== null ? dias : status === "encerrada" ? `${o.dias_resolucao ?? "—"} (resolvida)` : "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-1.5"
                        disabled={gerandoWordId === o.id}
                        onClick={(e) => {
                          e.stopPropagation();
                          gerarWord(o);
                        }}
                      >
                        {gerandoWordId === o.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <FileText className="h-3.5 w-3.5" />
                        )}
                        Gerar Word
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>

          {totalPaginas > 1 && (
            <div className="flex items-center justify-between pt-2">
              <span className="text-xs text-muted-foreground">
                Página {pagina} de {totalPaginas}
              </span>
              <Pagination className="mx-0 w-auto">
                <PaginationContent>
                  <PaginationItem>
                    <PaginationPrevious
                      href="#"
                      onClick={(e) => {
                        e.preventDefault();
                        setPagina((p) => Math.max(1, p - 1));
                      }}
                      className={pagina === 1 ? "pointer-events-none opacity-50" : ""}
                    />
                  </PaginationItem>
                  <PaginationItem>
                    <PaginationNext
                      href="#"
                      onClick={(e) => {
                        e.preventDefault();
                        setPagina((p) => Math.min(totalPaginas, p + 1));
                      }}
                      className={pagina === totalPaginas ? "pointer-events-none opacity-50" : ""}
                    />
                  </PaginationItem>
                </PaginationContent>
              </Pagination>
            </div>
          )}
        </>
      )}

      <SacOccurrenceDetail
        ocorrencia={selecionada}
        open={detalheAberto}
        onOpenChange={setDetalheAberto}
      />
    </>
  );
};

export default SacOccurrencesTable;
