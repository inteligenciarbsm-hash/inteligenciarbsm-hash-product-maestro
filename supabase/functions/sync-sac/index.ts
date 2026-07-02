import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { buildWorkbookUrl, getAccessToken, readWorksheet } from "./graph.ts";
import { log } from "./logger.ts";
import { findHeaderRow, transformRows } from "./mapper.ts";
import { getConfig, insertSyncLog, upsertOcorrencias } from "./repository.ts";

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

    const tenantId = Deno.env.get("GRAPH_TENANT_ID");
    const clientId = Deno.env.get("GRAPH_CLIENT_ID");
    const clientSecret = Deno.env.get("GRAPH_CLIENT_SECRET");
    const siteId = Deno.env.get("GRAPH_SITE_ID");
    const driveId = Deno.env.get("GRAPH_DRIVE_ID");
    const itemId = Deno.env.get("GRAPH_ITEM_ID");

    const faltando = [
      !tenantId && "GRAPH_TENANT_ID",
      !clientId && "GRAPH_CLIENT_ID",
      !clientSecret && "GRAPH_CLIENT_SECRET",
      !itemId && "GRAPH_ITEM_ID",
      !siteId && !driveId && "GRAPH_SITE_ID ou GRAPH_DRIVE_ID",
    ].filter(Boolean);

    if (faltando.length > 0) {
      throw new Error(
        `Secrets não configurados: ${faltando.join(", ")}. ` +
          `Execute: supabase secrets set <KEY>=<VALUE>`
      );
    }

    // ── 2. Ler configurações do banco ─────────────────────────────────────────

    const sheetName = await getConfig(supabase, "sac.sheet_name", "SAC 2026");

    // ── 3. Obter token OAuth ──────────────────────────────────────────────────

    const accessToken = await getAccessToken(tenantId!, clientId!, clientSecret!);

    // ── 4. Construir URL e ler planilha ───────────────────────────────────────

    const workbookUrl = buildWorkbookUrl(siteId, driveId, itemId!);
    const values = await readWorksheet(accessToken, workbookUrl, sheetName!);

    // ── 5. Localizar cabeçalho e transformar linhas ───────────────────────────

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

    // ── 6. Persistir no banco ─────────────────────────────────────────────────

    const linhasAtualizadas = await upsertOcorrencias(supabase, result.ocorrencias);

    // ── 7. Registrar log ──────────────────────────────────────────────────────

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
