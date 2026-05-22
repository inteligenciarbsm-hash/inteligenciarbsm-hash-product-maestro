import Pesquisas from "./Pesquisas";

const SAC_API = import.meta.env.VITE_SHEETS_SAC_API_URL as string | undefined;

/**
 * Página "Pesquisas do SAC" — reaproveita toda a lógica de Pesquisas,
 * apontando pra uma planilha diferente (fonte do SAC).
 */
const PesquisasSac = () => (
  <Pesquisas
    apiUrl={SAC_API}
    title="Pesquisas do SAC"
    subtitle="Indicadores das pesquisas do SAC — atualiza sozinho a cada minuto."
  />
);

export default PesquisasSac;
