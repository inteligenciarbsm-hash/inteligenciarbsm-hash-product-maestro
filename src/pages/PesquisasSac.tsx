import Pesquisas from "./Pesquisas";

const SAC_API = import.meta.env.VITE_SHEETS_SAC_API_URL as string | undefined;

/**
 * Página "Pesquisas do SAC" — reaproveita a lógica de Pesquisas apontando
 * pra planilha do SAC. O 2º filtro é "Qual a sua rede?" (em vez de Produto),
 * e o modo isolado por valor fica desligado (mostra tudo agregado, com
 * opção de filtrar por uma rede específica).
 */
const PesquisasSac = () => (
  <Pesquisas
    apiUrl={SAC_API}
    title="Pesquisas do SAC"
    subtitle="Indicadores das pesquisas do SAC — atualiza sozinho a cada minuto."
    subColumnFinder={(headers) =>
      headers.find((h) => /rede/i.test(h)) ?? null
    }
    subLabel="Qual a sua rede?"
    subAllLabel="Todas as redes"
    isolatedMode={false}
    showComparativoHint={false}
  />
);

export default PesquisasSac;
