// Módulo responsável por toda a geração de documentos Word da Central SAC.
// Fica 100% isolado da UI: componentes chamam só a função pública de cada
// documento (ex: baixarDocumentoRnc(ocorrencia)) e não precisam saber que
// existe docxtemplater, pizzip, fetch ou Blob por trás.
//
// Cada gerador segue o mesmo padrão — monta os dados a partir de
// SacOcorrencia, chama renderTemplate() com o template correspondente e
// dispara o download via baixarBlob(). Hoje só existe o RNC; novos
// documentos (ex: carta ao fornecedor, carta ao consumidor) reaproveitam a
// mesma base sem exigir mudança nos componentes que os chamam:
//
//   baixarDocumentoRnc()         — implementado
//   gerarDocumentoFornecedor()   — futuro: carta/relatório para o fornecedor
//   gerarDocumentoCarta()        — futuro: carta de resposta ao consumidor

import Docxtemplater from "docxtemplater";
import PizZip from "pizzip";
import type { SacOcorrencia } from "@/lib/sacAnalysis";

// ─── Infraestrutura comum a todos os geradores ────────────────────────────────

async function renderTemplate(
  templateUrl: string,
  dados: Record<string, string>
): Promise<Blob> {
  const res = await fetch(templateUrl);
  if (!res.ok) {
    throw new Error(`Não foi possível carregar o template (HTTP ${res.status}): ${templateUrl}`);
  }

  const arrayBuffer = await res.arrayBuffer();
  const zip = new PizZip(arrayBuffer);
  const doc = new Docxtemplater(zip, { paragraphLoop: true, linebreaks: true });

  doc.render(dados);

  return doc.toBlob({
    mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  });
}

function baixarBlob(blob: Blob, nomeArquivo: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = nomeArquivo;
  link.click();
  URL.revokeObjectURL(url);
}

const formatarData = (iso: string | null): string => {
  if (!iso) return "";
  const [ano, mes, dia] = iso.split("-");
  return `${dia}/${mes}/${ano}`;
};

// ─── RNC (Relatório de Não Conformidade) ──────────────────────────────────────

const RNC_TEMPLATE_URL = "/templates/rnc-template.docx";

// Mapa de tags do template → valor. Campos sem correspondente em
// SacOcorrencia (EAN, marca, e todos os campos de investigação do
// fornecedor) não têm tag no template — ficam em branco por design.
function montarDadosRnc(o: SacOcorrencia): Record<string, string> {
  return {
    numero_ocorrencia: o.num_ocorrencia ?? "",
    produto: o.produto ?? "",
    data_ocorrencia: formatarData(o.data_email),
    consumidor: o.nome_consumidor ?? "",
    fornecedor: o.fornecedor ?? "",
    local_origem: o.associado ?? "",
    data_fabricacao: formatarData(o.data_fabricacao),
    data_validade: formatarData(o.data_validade),
    lote: o.lote ?? "",
    descricao_ocorrencia: o.ocorrencia_descricao ?? "",
    observacoes: o.observacao ?? "",
  };
}

export async function baixarDocumentoRnc(ocorrencia: SacOcorrencia): Promise<void> {
  const blob = await renderTemplate(RNC_TEMPLATE_URL, montarDadosRnc(ocorrencia));
  baixarBlob(blob, `RNC_${ocorrencia.num_ocorrencia}.docx`);
}
