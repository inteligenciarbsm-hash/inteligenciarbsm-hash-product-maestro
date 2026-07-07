import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { log } from "./logger.ts";
import { findHeaderRow, transformRows } from "./mapper.ts";
import { insertSyncLog, upsertOcorrencias } from "./repository.ts";
import { fetchSheetValues } from "./sheets.ts";

Deno.serve(async (_req: Request): Promise<Response> => {
  const inicio = Date.now();
  const iniciadoEm = new Date().toISOString();

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  log("INFO", "sync-sac iniciado");

  // Contadores acumulados para o log de falha no catch
  let linhasLidas = 0;
  let linhasIgnoradas = 0;
  let linhasComErro = 0;

  try {
    // ── 1. Validar credenciais ────────────────────────────────────────────────

    const sheetId = Deno.env.get("GOOGLE_SHEET_ID");
    const sheetGid = Deno.env.get("GOOGLE_SHEET_GID") || undefined;

    if (!sheetId) {
      throw new Error(
        "Secret não configurado: GOOGLE_SHEET_ID. " +
          "Execute: supabase secrets set GOOGLE_SHEET_ID=<id-da-planilha>"
      );
    }

    // ── 2. Ler planilha do Google Sheets ──────────────────────────────────────

    const values = await fetchSheetValues(sheetId, sheetGid);

    // ── 3. Localizar cabeçalho e transformar linhas ───────────────────────────

    const syncTs = iniciadoEm;
    const headerRowIndex = findHeaderRow(values);
    const result = transformRows(values, headerRowIndex, syncTs);

    linhasLidas = result.linhasLidas;
    linhasIgnoradas = result.linhasIgnoradas;
    linhasComErro = result.linhasComErro;

    log("INFO", "Transformação concluída", {
      linhas_lidas: linhasLidas,
      linhas_ignoradas: linhasIgnoradas,
      linhas_com_erro: linhasComErro,
      linhas_importadas: result.ocorrencias.length,
    });

    // ── 4. Persistir no banco ─────────────────────────────────────────────────

    const linhasAtualizadas = await upsertOcorrencias(supabase, result.ocorrencias);

    // ── 5. Registrar log ──────────────────────────────────────────────────────

    const finalizadoEm = new Date().toISOString();
    const duracaoMs = Date.now() - inicio;

    const status =
      linhasComErro > 0 && linhasAtualizadas === 0
        ? "falha"
        : linhasComErro > 0
        ? "parcial"
        : "ok";

    await insertSyncLog(supabase, {
      iniciado_em: iniciadoEm,
      finalizado_em: finalizadoEm,
      duracao_ms: duracaoMs,
      status,
      linhas_lidas: linhasLidas,
      linhas_importadas: result.ocorrencias.length,
      linhas_atualizadas: linhasAtualizadas,
      linhas_ignoradas: linhasIgnoradas,
      linhas_com_erro: linhasComErro,
      erro: result.erros.length > 0 ? result.erros.join("\n") : null,
    });

    log("INFO", "sync-sac concluído", { status, duracao_ms: duracaoMs });

    return new Response(
      JSON.stringify({
        ok: true,
        status,
        duracao_ms: duracaoMs,
        linhas_lidas: linhasLidas,
        linhas_importadas: result.ocorrencias.length,
        linhas_atualizadas: linhasAtualizadas,
        linhas_ignoradas: linhasIgnoradas,
        linhas_com_erro: linhasComErro,
        erros: result.erros,
      }),
      { headers: { "Content-Type": "application/json" }, status: 200 }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const finalizadoEm = new Date().toISOString();
    const duracaoMs = Date.now() - inicio;

    log("ERROR", "sync-sac falhou", { erro: message, duracao_ms: duracaoMs });

    await insertSyncLog(supabase, {
      iniciado_em: iniciadoEm,
      finalizado_em: finalizadoEm,
      duracao_ms: duracaoMs,
      status: "falha",
      linhas_lidas: linhasLidas,
      linhas_importadas: 0,
      linhas_atualizadas: 0,
      linhas_ignoradas: linhasIgnoradas,
      linhas_com_erro: linhasComErro,
      erro: message,
    });

    return new Response(
      JSON.stringify({ ok: false, erro: message, duracao_ms: duracaoMs }),
      { headers: { "Content-Type": "application/json" }, status: 500 }
    );
  }
});
