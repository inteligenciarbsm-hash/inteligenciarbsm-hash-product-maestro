// Funções puras de análise do módulo Central SAC.
// Sem React, sem Supabase, sem efeitos colaterais — só transformações de dados.

// ─── Tipos de domínio ─────────────────────────────────────────────────────────

export type OcorrenciaStatus = "aberta" | "atrasada" | "critica" | "encerrada";

export type SacOcorrencia = {
  id: string;
  num_ocorrencia: string;
  data_email: string | null;
  produto: string | null;
  fornecedor: string | null;
  associado: string | null;
  tipo_ocorrencia: string | null;
  criticidade: string | null;
  ocorrencia_descricao: string | null;
  lote: string | null;
  data_fabricacao: string | null;
  data_validade: string | null;
  // PII — presentes no banco, nunca exibidos no dashboard
  nome_consumidor: string | null;
  tel_consumidor: string | null;
  email_consumidor: string | null;
  endereco_consumidor: string | null;
  // Marcos de resolução
  fornecedor_comunicado_em: string | null;
  associado_comunicado_em: string | null;
  ressarcimento_em: string | null;
  rnc_finalizado_em: string | null;
  dias_resolucao: number | null;
  observacao: string | null;
  sincronizado_em: string;
};

export type SacSyncLog = {
  id: string;
  iniciado_em: string;
  finalizado_em: string | null;
  duracao_ms: number | null;
  status: "ok" | "parcial" | "falha";
  linhas_lidas: number;
  linhas_importadas: number;
  linhas_atualizadas: number;
  linhas_ignoradas: number;
  linhas_com_erro: number;
  erro: string | null;
};

export type SacConfig = {
  chave: string;
  valor: string | null;
  descricao: string | null;
  atualizado_em: string;
};

export type SacFiltros = {
  fornecedor?: string;
  produto?: string;
  criticidade?: string;
  dataInicio?: string; // "YYYY-MM-DD"
  dataFim?: string;   // "YYYY-MM-DD"
};

export type RankingItem = {
  label: string;
  count: number;
};

export type MesSerie = {
  mes: string; // "2026-03"
  total: number;
  encerradas: number;
  abertas: number;
};

export type SacKpis = {
  total: number;
  abertas: number;
  criticas: number;
  atrasadas: number;
  encerradas: number;
  tempoMedioResolucao: number | null;
  aguardandoFornecedor: number;
  aguardandoAssociado: number;
  aguardandoRessarcimento: number;
  dentroDoSla: number;
  foraDoSla: number;
};

export type AlertaNivel = "critico" | "atencao" | "info";

export type SacAlerta = {
  id: string;
  nivel: AlertaNivel;
  mensagem: string;
  num_ocorrencia: string;
};

export type SlaResult = {
  dentroDoSla: number;
  foraDoSla: number;
  percentualDentro: number;
};

// ─── Constante padrão de SLA ──────────────────────────────────────────────────
// O valor real vem de system_config ('sac.sla_dias_resolucao').
// Este default é usado quando a config não está disponível.

export const SLA_DIAS_DEFAULT = 30;

// ─── Status derivado ──────────────────────────────────────────────────────────

export function derivarStatus(
  o: SacOcorrencia,
  slaDias = SLA_DIAS_DEFAULT
): OcorrenciaStatus {
  if (o.rnc_finalizado_em) return "encerrada";

  const diasAberta = o.data_email
    ? Math.floor((Date.now() - new Date(o.data_email).getTime()) / 86_400_000)
    : 0;

  if (o.criticidade?.toLowerCase() === "alta") return "critica";
  if (diasAberta >= slaDias) return "atrasada";
  return "aberta";
}

// ─── KPIs agregados ───────────────────────────────────────────────────────────

export function calcularKpis(
  ocorrencias: SacOcorrencia[],
  slaDias = SLA_DIAS_DEFAULT
): SacKpis {
  let abertas = 0;
  let criticas = 0;
  let atrasadas = 0;
  let encerradas = 0;
  let aguardandoFornecedor = 0;
  let aguardandoAssociado = 0;
  let aguardandoRessarcimento = 0;
  let totalDiasResolucao = 0;
  let countResolvidas = 0;
  let dentroDoSla = 0;
  let foraDoSla = 0;

  for (const o of ocorrencias) {
    const status = derivarStatus(o, slaDias);

    if (status === "encerrada") {
      encerradas++;
    } else {
      abertas++;
      if (status === "critica") criticas++;
      if (status === "atrasada") atrasadas++;
    }

    if (!o.rnc_finalizado_em) {
      if (!o.fornecedor_comunicado_em) aguardandoFornecedor++;
      if (!o.associado_comunicado_em) aguardandoAssociado++;
      if (!o.ressarcimento_em) aguardandoRessarcimento++;
    }

    if (o.rnc_finalizado_em && o.dias_resolucao !== null) {
      totalDiasResolucao += o.dias_resolucao;
      countResolvidas++;
      if (o.dias_resolucao <= slaDias) dentroDoSla++;
      else foraDoSla++;
    }
  }

  return {
    total: ocorrencias.length,
    abertas,
    criticas,
    atrasadas,
    encerradas,
    tempoMedioResolucao:
      countResolvidas > 0
        ? Math.round(totalDiasResolucao / countResolvidas)
        : null,
    aguardandoFornecedor,
    aguardandoAssociado,
    aguardandoRessarcimento,
    dentroDoSla,
    foraDoSla,
  };
}

// ─── Rankings ─────────────────────────────────────────────────────────────────

function agruparPorCampo(
  ocorrencias: SacOcorrencia[],
  campo: keyof SacOcorrencia,
  top?: number
): RankingItem[] {
  const counts = new Map<string, number>();

  for (const o of ocorrencias) {
    const val = o[campo];
    if (val === null || val === undefined) continue;
    const label = String(val);
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }

  const sorted = Array.from(counts.entries())
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count);

  return top !== undefined ? sorted.slice(0, top) : sorted;
}

export const agruparPorFornecedor = (
  ocorrencias: SacOcorrencia[],
  top = 5
): RankingItem[] => agruparPorCampo(ocorrencias, "fornecedor", top);

export const agruparPorProduto = (
  ocorrencias: SacOcorrencia[],
  top = 5
): RankingItem[] => agruparPorCampo(ocorrencias, "produto", top);

export const agruparPorTipo = (
  ocorrencias: SacOcorrencia[]
): RankingItem[] => agruparPorCampo(ocorrencias, "tipo_ocorrencia");

export const agruparPorCriticidade = (
  ocorrencias: SacOcorrencia[]
): RankingItem[] => agruparPorCampo(ocorrencias, "criticidade");

// ─── Série temporal ───────────────────────────────────────────────────────────

export function agruparPorMes(ocorrencias: SacOcorrencia[]): MesSerie[] {
  const meses = new Map<string, { total: number; encerradas: number }>();

  for (const o of ocorrencias) {
    if (!o.data_email) continue;
    const mes = o.data_email.slice(0, 7);
    const entry = meses.get(mes) ?? { total: 0, encerradas: 0 };
    entry.total++;
    if (o.rnc_finalizado_em) entry.encerradas++;
    meses.set(mes, entry);
  }

  return Array.from(meses.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([mes, { total, encerradas }]) => ({
      mes,
      total,
      encerradas,
      abertas: total - encerradas,
    }));
}

// ─── SLA ──────────────────────────────────────────────────────────────────────

export function calcularSla(
  ocorrencias: SacOcorrencia[],
  slaDias = SLA_DIAS_DEFAULT
): SlaResult {
  const encerradas = ocorrencias.filter(
    (o) => o.rnc_finalizado_em && o.dias_resolucao !== null
  );
  const dentroDoSla = encerradas.filter(
    (o) => (o.dias_resolucao ?? Infinity) <= slaDias
  ).length;
  const foraDoSla = encerradas.length - dentroDoSla;
  const percentualDentro =
    encerradas.length > 0
      ? Math.round((dentroDoSla / encerradas.length) * 100)
      : 0;

  return { dentroDoSla, foraDoSla, percentualDentro };
}

// ─── Alertas ──────────────────────────────────────────────────────────────────

const ALERT_DIAS_CRITICA = 15;
const ALERT_DIAS_FORNECEDOR = 7;

export function gerarAlertas(
  ocorrencias: SacOcorrencia[],
  slaDias = SLA_DIAS_DEFAULT
): SacAlerta[] {
  const alertas: SacAlerta[] = [];

  for (const o of ocorrencias) {
    if (o.rnc_finalizado_em) continue;

    const diasAberta = o.data_email
      ? Math.floor((Date.now() - new Date(o.data_email).getTime()) / 86_400_000)
      : 0;
    const criticidadeAlta = o.criticidade?.toLowerCase() === "alta";

    if (criticidadeAlta && !o.fornecedor_comunicado_em && diasAberta >= ALERT_DIAS_FORNECEDOR) {
      alertas.push({
        id: `${o.num_ocorrencia}-critica-forn`,
        nivel: "critico",
        mensagem: `${o.num_ocorrencia} — Alta criticidade sem fornecedor comunicado (${diasAberta}d)`,
        num_ocorrencia: o.num_ocorrencia,
      });
    } else if (criticidadeAlta && diasAberta >= ALERT_DIAS_CRITICA) {
      alertas.push({
        id: `${o.num_ocorrencia}-critica-tempo`,
        nivel: "critico",
        mensagem: `${o.num_ocorrencia} — Alta criticidade aberta há ${diasAberta} dias`,
        num_ocorrencia: o.num_ocorrencia,
      });
    } else if (diasAberta >= slaDias) {
      alertas.push({
        id: `${o.num_ocorrencia}-atrasada`,
        nivel: "atencao",
        mensagem: `${o.num_ocorrencia} — Aberta há ${diasAberta} dias sem resolução`,
        num_ocorrencia: o.num_ocorrencia,
      });
    } else if (!o.fornecedor_comunicado_em && diasAberta >= ALERT_DIAS_FORNECEDOR) {
      alertas.push({
        id: `${o.num_ocorrencia}-forn`,
        nivel: "atencao",
        mensagem: `${o.num_ocorrencia} — Fornecedor não comunicado (${diasAberta}d)`,
        num_ocorrencia: o.num_ocorrencia,
      });
    }
  }

  const order: Record<AlertaNivel, number> = { critico: 0, atencao: 1, info: 2 };
  return alertas.sort((a, b) => order[a.nivel] - order[b.nivel]);
}

// ─── Score de saúde do SAC ──────────────────────────────────────────────────────
// Cálculo simples por penalidades (v1) — ponto de partida 100, descontado por
// sinais de risco. Não é estatisticamente rigoroso; existe para dar uma leitura
// rápida de "como estamos" ao gestor. Pode evoluir para um modelo mais formal
// (ex: pesos configuráveis via system_config) se a necessidade aparecer.

export type NivelSaude = "otimo" | "atencao" | "critico";

export type SacScoreSaude = {
  score: number; // 0-100
  nivel: NivelSaude;
};

const PESO_CRITICA = 8;
const PESO_ATRASADA = 5;
const PESO_AGUARDANDO_FORNECEDOR = 1.5;
const PESO_AGUARDANDO_RESSARCIMENTO = 1.5;
const PESO_FORA_SLA = 25; // aplicado sobre o percentual fora do SLA (0-1)

export function calcularScoreSaude(kpis: SacKpis): SacScoreSaude {
  const totalResolvidas = kpis.dentroDoSla + kpis.foraDoSla;
  const percentualForaSla = totalResolvidas > 0 ? kpis.foraDoSla / totalResolvidas : 0;

  const penalidade =
    kpis.criticas * PESO_CRITICA +
    kpis.atrasadas * PESO_ATRASADA +
    kpis.aguardandoFornecedor * PESO_AGUARDANDO_FORNECEDOR +
    kpis.aguardandoRessarcimento * PESO_AGUARDANDO_RESSARCIMENTO +
    percentualForaSla * PESO_FORA_SLA;

  const score = Math.max(0, Math.min(100, Math.round(100 - penalidade)));
  const nivel: NivelSaude = score >= 80 ? "otimo" : score >= 50 ? "atencao" : "critico";

  return { score, nivel };
}

// ─── Tendências (comparação com o mês anterior) ─────────────────────────────────

export type Tendencia = "subiu" | "desceu" | "estavel";

export type TendenciaIndicador = {
  tendencia: Tendencia;
  atual: number;
  anterior: number | null; // null = sem dados do mês anterior para comparar
  percentual: number | null;
};

const ESTAVEL_LIMIAR_PCT = 5; // variações abaixo disso são tratadas como estáveis

function compararValores(atual: number, anterior: number | null): TendenciaIndicador {
  if (anterior === null || anterior === 0) {
    return { tendencia: "estavel", atual, anterior, percentual: null };
  }

  const percentual = Math.round(((atual - anterior) / anterior) * 100);
  const tendencia: Tendencia =
    Math.abs(percentual) < ESTAVEL_LIMIAR_PCT
      ? "estavel"
      : percentual > 0
      ? "subiu"
      : "desceu";

  return { tendencia, atual, anterior, percentual };
}

export type SacTendencias = {
  novasOcorrencias: TendenciaIndicador;
  tempoMedioResolucao: TendenciaIndicador;
  criticasAbertas: TendenciaIndicador;
  slaPercentual: TendenciaIndicador;
};

function mesString(date: Date): string {
  return date.toISOString().slice(0, 7);
}

export function calcularTendencias(
  ocorrencias: SacOcorrencia[],
  slaDias = SLA_DIAS_DEFAULT,
  hoje = new Date()
): SacTendencias {
  const mesAtual = mesString(hoje);
  const mesAnteriorDate = new Date(hoje.getFullYear(), hoje.getMonth() - 1, 1);
  const mesAnterior = mesString(mesAnteriorDate);

  const doMes = (mes: string) =>
    ocorrencias.filter((o) => o.data_email?.startsWith(mes));

  const ocorrenciasMesAtual = doMes(mesAtual);
  const ocorrenciasMesAnterior = doMes(mesAnterior);
  const houveDadosAnteriores = ocorrenciasMesAnterior.length > 0;

  const kpisAtual = calcularKpis(ocorrenciasMesAtual, slaDias);
  const kpisAnterior = calcularKpis(ocorrenciasMesAnterior, slaDias);

  const slaAtual = calcularSla(ocorrenciasMesAtual, slaDias);
  const slaAnterior = calcularSla(ocorrenciasMesAnterior, slaDias);

  return {
    novasOcorrencias: compararValores(
      ocorrenciasMesAtual.length,
      houveDadosAnteriores ? ocorrenciasMesAnterior.length : null
    ),
    tempoMedioResolucao: compararValores(
      kpisAtual.tempoMedioResolucao ?? 0,
      houveDadosAnteriores ? kpisAnterior.tempoMedioResolucao : null
    ),
    criticasAbertas: compararValores(
      kpisAtual.criticas,
      houveDadosAnteriores ? kpisAnterior.criticas : null
    ),
    slaPercentual: compararValores(
      slaAtual.percentualDentro,
      houveDadosAnteriores ? slaAnterior.percentualDentro : null
    ),
  };
}

// ─── Resumo executivo ────────────────────────────────────────────────────────────

export function gerarResumoExecutivo(
  kpis: SacKpis,
  score: SacScoreSaude,
  tendencias: SacTendencias
): string {
  if (kpis.total === 0) {
    return "Nenhuma ocorrência sincronizada ainda — o resumo executivo será gerado assim que houver dados.";
  }

  const frases: string[] = [];

  // Situação geral
  const nivelTexto =
    score.nivel === "otimo"
      ? "está sob controle"
      : score.nivel === "atencao"
      ? "requer atenção"
      : "está em situação crítica";
  frases.push(`O SAC ${nivelTexto} nesta análise, com pontuação de saúde de ${score.score}/100.`);

  // Criticidade e atraso
  if (kpis.criticas > 0 || kpis.atrasadas > 0) {
    const partes: string[] = [];
    if (kpis.criticas > 0) {
      partes.push(`${kpis.criticas} ${kpis.criticas === 1 ? "ocorrência crítica" : "ocorrências críticas"} em aberto`);
    }
    if (kpis.atrasadas > 0) {
      partes.push(`${kpis.atrasadas} ${kpis.atrasadas === 1 ? "ocorrência atrasada" : "ocorrências atrasadas"} em relação ao prazo`);
    }
    frases.push(`Há ${partes.join(" e ")}.`);
  } else {
    frases.push("Não há ocorrências críticas ou atrasadas no momento.");
  }

  // Tendência de volume
  if (tendencias.novasOcorrencias.percentual !== null) {
    const dir =
      tendencias.novasOcorrencias.tendencia === "subiu"
        ? "aumentou"
        : tendencias.novasOcorrencias.tendencia === "desceu"
        ? "reduziu"
        : "manteve-se estável";
    frases.push(
      tendencias.novasOcorrencias.tendencia === "estavel"
        ? `O volume de novas ocorrências ${dir} em relação ao mês anterior.`
        : `O volume de novas ocorrências ${dir} ${Math.abs(tendencias.novasOcorrencias.percentual)}% em relação ao mês anterior.`
    );
  }

  // Pendências operacionais
  if (kpis.aguardandoFornecedor > 0 || kpis.aguardandoRessarcimento > 0) {
    const partes: string[] = [];
    if (kpis.aguardandoFornecedor > 0) {
      partes.push(`${kpis.aguardandoFornecedor} aguardando comunicação ao fornecedor`);
    }
    if (kpis.aguardandoRessarcimento > 0) {
      partes.push(`${kpis.aguardandoRessarcimento} aguardando ressarcimento`);
    }
    frases.push(`Pendências operacionais: ${partes.join(" e ")}.`);
  }

  return frases.join(" ");
}

// ─── Painel de prioridades — "O que precisa da sua atenção" ────────────────────

export type PrioridadeItem = {
  id: string;
  titulo: string;
  descricao: string;
  urgencia: "alta" | "media";
};

export function gerarPrioridades(
  ocorrencias: SacOcorrencia[],
  kpis: SacKpis,
  slaDias = SLA_DIAS_DEFAULT
): PrioridadeItem[] {
  const prioridades: PrioridadeItem[] = [];

  if (kpis.criticas > 0) {
    prioridades.push({
      id: "criticas",
      titulo: "Ocorrências críticas em aberto",
      descricao: `${kpis.criticas} ${kpis.criticas === 1 ? "ocorrência de alta criticidade está" : "ocorrências de alta criticidade estão"} em aberto e ${kpis.criticas === 1 ? "precisa" : "precisam"} de ação imediata.`,
      urgencia: "alta",
    });
  }

  const topFornecedor = agruparPorFornecedor(
    ocorrencias.filter((o) => !o.rnc_finalizado_em),
    1
  )[0];
  if (topFornecedor && topFornecedor.count > 1) {
    prioridades.push({
      id: "fornecedor-top",
      titulo: "Fornecedor concentrando ocorrências",
      descricao: `${topFornecedor.label} responde por ${topFornecedor.count} ocorrências em aberto — vale avaliar uma tratativa direta.`,
      urgencia: "media",
    });
  }

  if (kpis.aguardandoRessarcimento > 0) {
    prioridades.push({
      id: "ressarcimento",
      titulo: "Ressarcimentos pendentes",
      descricao: `${kpis.aguardandoRessarcimento} ${kpis.aguardandoRessarcimento === 1 ? "ocorrência aguarda" : "ocorrências aguardam"} ressarcimento ao consumidor.`,
      urgencia: kpis.aguardandoRessarcimento >= 3 ? "alta" : "media",
    });
  }

  if (kpis.atrasadas > 0) {
    prioridades.push({
      id: "atrasadas",
      titulo: "Ocorrências fora do prazo",
      descricao: `${kpis.atrasadas} ${kpis.atrasadas === 1 ? "ocorrência ultrapassou" : "ocorrências ultrapassaram"} o prazo de ${slaDias} dias sem resolução.`,
      urgencia: "alta",
    });
  }

  if (kpis.aguardandoFornecedor > 0) {
    prioridades.push({
      id: "aguardando-fornecedor",
      titulo: "Fornecedores não comunicados",
      descricao: `${kpis.aguardandoFornecedor} ${kpis.aguardandoFornecedor === 1 ? "ocorrência aberta ainda não teve" : "ocorrências abertas ainda não tiveram"} o fornecedor comunicado.`,
      urgencia: "media",
    });
  }

  const order: Record<PrioridadeItem["urgencia"], number> = { alta: 0, media: 1 };
  return prioridades.sort((a, b) => order[a.urgencia] - order[b.urgencia]);
}

// ─── Dias em aberto ──────────────────────────────────────────────────────────────
// Compartilhado pela tabela e pela exportação — evita recalcular a mesma
// diferença de datas em mais de um lugar.

export function calcularDiasEmAberto(o: SacOcorrencia): number | null {
  if (o.rnc_finalizado_em || !o.data_email) return null;
  return Math.floor((Date.now() - new Date(o.data_email).getTime()) / 86_400_000);
}

// ─── Filtros da tabela operacional ────────────────────────────────────────────────

export type PeriodoPreset = "todos" | "7d" | "30d" | "mes-atual" | "mes-anterior";

export type SacFiltrosTabela = {
  busca?: string;
  periodo?: PeriodoPreset;
  produto?: string;
  fornecedor?: string;
  criticidade?: string;
  tipoOcorrencia?: string;
  status?: OcorrenciaStatus;
};

export function calcularIntervaloPeriodo(
  preset: PeriodoPreset | undefined,
  hoje = new Date()
): { inicio: string | null; fim: string | null } {
  const fim = hoje.toISOString().slice(0, 10);

  switch (preset) {
    case "7d": {
      const inicio = new Date(hoje.getTime() - 7 * 86_400_000).toISOString().slice(0, 10);
      return { inicio, fim };
    }
    case "30d": {
      const inicio = new Date(hoje.getTime() - 30 * 86_400_000).toISOString().slice(0, 10);
      return { inicio, fim };
    }
    case "mes-atual": {
      const inicio = new Date(hoje.getFullYear(), hoje.getMonth(), 1).toISOString().slice(0, 10);
      return { inicio, fim };
    }
    case "mes-anterior": {
      const inicio = new Date(hoje.getFullYear(), hoje.getMonth() - 1, 1);
      const fimAnterior = new Date(hoje.getFullYear(), hoje.getMonth(), 0);
      return { inicio: inicio.toISOString().slice(0, 10), fim: fimAnterior.toISOString().slice(0, 10) };
    }
    default:
      return { inicio: null, fim: null };
  }
}

function normalizarBusca(texto: string): string {
  return texto.trim().toLowerCase();
}

export function filtrarOcorrencias(
  ocorrencias: SacOcorrencia[],
  filtros: SacFiltrosTabela,
  slaDias = SLA_DIAS_DEFAULT
): SacOcorrencia[] {
  const { inicio, fim } = calcularIntervaloPeriodo(filtros.periodo);
  const busca = filtros.busca ? normalizarBusca(filtros.busca) : null;

  return ocorrencias.filter((o) => {
    if (filtros.produto && o.produto !== filtros.produto) return false;
    if (filtros.fornecedor && o.fornecedor !== filtros.fornecedor) return false;
    if (filtros.criticidade && o.criticidade !== filtros.criticidade) return false;
    if (filtros.tipoOcorrencia && o.tipo_ocorrencia !== filtros.tipoOcorrencia) return false;
    if (filtros.status && derivarStatus(o, slaDias) !== filtros.status) return false;

    if (inicio && (!o.data_email || o.data_email < inicio)) return false;
    if (fim && o.data_email && o.data_email > fim) return false;

    if (busca) {
      const alvo = [o.num_ocorrencia, o.produto, o.fornecedor]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      if (!alvo.includes(busca)) return false;
    }

    return true;
  });
}

// ─── Ordenação da tabela operacional ──────────────────────────────────────────────

export type SacOrdenacaoCampo = "data" | "criticidade" | "produto" | "fornecedor";
export type SacOrdenacaoDirecao = "asc" | "desc";

const ORDEM_CRITICIDADE: Record<string, number> = { alta: 0, média: 1, media: 1, baixa: 2 };

function compararCriticidade(a: string | null, b: string | null): number {
  const rankA = a ? ORDEM_CRITICIDADE[a.toLowerCase()] ?? 99 : 99;
  const rankB = b ? ORDEM_CRITICIDADE[b.toLowerCase()] ?? 99 : 99;
  return rankA - rankB;
}

export function ordenarOcorrencias(
  ocorrencias: SacOcorrencia[],
  campo: SacOrdenacaoCampo,
  direcao: SacOrdenacaoDirecao
): SacOcorrencia[] {
  const sinal = direcao === "asc" ? 1 : -1;

  const comparador: Record<SacOrdenacaoCampo, (a: SacOcorrencia, b: SacOcorrencia) => number> = {
    data: (a, b) => (a.data_email ?? "").localeCompare(b.data_email ?? ""),
    criticidade: (a, b) => compararCriticidade(a.criticidade, b.criticidade),
    produto: (a, b) => (a.produto ?? "").localeCompare(b.produto ?? ""),
    fornecedor: (a, b) => (a.fornecedor ?? "").localeCompare(b.fornecedor ?? ""),
  };

  return [...ocorrencias].sort((a, b) => sinal * comparador[campo](a, b));
}

// ─── Exportação (CSV / Excel) ──────────────────────────────────────────────────────
// Nunca inclui dados de consumidor (PII) — mesma regra aplicada ao dashboard.

export type LinhaExportacao = {
  numOcorrencia: string;
  data: string;
  produto: string;
  fornecedor: string;
  associado: string;
  tipo: string;
  criticidade: string;
  status: string;
  diasEmAberto: string;
};

const STATUS_LABEL_EXPORTACAO: Record<OcorrenciaStatus, string> = {
  aberta: "Em andamento",
  atrasada: "Atrasada",
  critica: "Crítica",
  encerrada: "Encerrada",
};

const formatarDataBr = (iso: string | null): string => {
  if (!iso) return "—";
  const [ano, mes, dia] = iso.split("-");
  return `${dia}/${mes}/${ano}`;
};

export function montarLinhasExportacao(
  ocorrencias: SacOcorrencia[],
  slaDias = SLA_DIAS_DEFAULT
): LinhaExportacao[] {
  return ocorrencias.map((o) => {
    const status = derivarStatus(o, slaDias);
    const dias = calcularDiasEmAberto(o);
    return {
      numOcorrencia: o.num_ocorrencia,
      data: formatarDataBr(o.data_email),
      produto: o.produto ?? "—",
      fornecedor: o.fornecedor ?? "—",
      associado: o.associado ?? "—",
      tipo: o.tipo_ocorrencia ?? "—",
      criticidade: o.criticidade ?? "—",
      status: STATUS_LABEL_EXPORTACAO[status],
      diasEmAberto: dias !== null ? String(dias) : "—",
    };
  });
}

const COLUNAS_EXPORTACAO: { chave: keyof LinhaExportacao; titulo: string }[] = [
  { chave: "numOcorrencia", titulo: "Nº da ocorrência" },
  { chave: "data", titulo: "Data" },
  { chave: "produto", titulo: "Produto" },
  { chave: "fornecedor", titulo: "Fornecedor" },
  { chave: "associado", titulo: "Associado" },
  { chave: "tipo", titulo: "Tipo de ocorrência" },
  { chave: "criticidade", titulo: "Criticidade" },
  { chave: "status", titulo: "Status" },
  { chave: "diasEmAberto", titulo: "Dias em aberto" },
];

function escaparCsv(valor: string): string {
  if (/[",\n;]/.test(valor)) {
    return `"${valor.replace(/"/g, '""')}"`;
  }
  return valor;
}

export function gerarCsvOcorrencias(linhas: LinhaExportacao[]): string {
  const cabecalho = COLUNAS_EXPORTACAO.map((c) => escaparCsv(c.titulo)).join(";");
  const corpo = linhas
    .map((linha) => COLUNAS_EXPORTACAO.map((c) => escaparCsv(linha[c.chave])).join(";"))
    .join("\n");
  return `${cabecalho}\n${corpo}`;
}

function escaparHtml(valor: string): string {
  return valor
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

// Gera uma tabela HTML — o Excel abre esse formato normalmente quando salvo
// com extensão .xls, sem exigir bibliotecas de geração de planilhas binárias.
export function gerarHtmlOcorrencias(linhas: LinhaExportacao[]): string {
  const cabecalho = COLUNAS_EXPORTACAO.map((c) => `<th>${escaparHtml(c.titulo)}</th>`).join("");
  const corpo = linhas
    .map(
      (linha) =>
        `<tr>${COLUNAS_EXPORTACAO.map((c) => `<td>${escaparHtml(linha[c.chave])}</td>`).join("")}</tr>`
    )
    .join("");

  return `<html><head><meta charset="UTF-8"></head><body><table border="1"><thead><tr>${cabecalho}</tr></thead><tbody>${corpo}</tbody></table></body></html>`;
}
