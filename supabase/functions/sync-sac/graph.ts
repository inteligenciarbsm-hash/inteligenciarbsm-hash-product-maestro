import { log } from "./logger.ts";

const GRAPH_BASE = "https://graph.microsoft.com/v1.0";

// ─── URL do workbook ──────────────────────────────────────────────────────────
// Constrói a URL usando drive_id + item_id (preferencial) ou site_id + item_id.
// Ambas são URLs válidas do Graph API — a diferença é apenas qual drive é usado.

export function buildWorkbookUrl(
  siteId: string | undefined,
  driveId: string | undefined,
  itemId: string
): string {
  if (driveId) {
    return `${GRAPH_BASE}/drives/${driveId}/items/${itemId}/workbook`;
  }

  if (siteId) {
    return `${GRAPH_BASE}/sites/${siteId}/drive/items/${itemId}/workbook`;
  }

  throw new Error(
    "Configure GRAPH_DRIVE_ID ou GRAPH_SITE_ID. Veja as instruções em supabase/migrations/20260630000001_sac_refinements.sql"
  );
}

// ─── OAuth: Client Credentials para Microsoft Graph ───────────────────────────

export async function getAccessToken(
  tenantId: string,
  clientId: string,
  clientSecret: string
): Promise<string> {
  log("INFO", "Solicitando token Azure AD", { tenant_id: tenantId, client_id: clientId });

  const res = await fetch(
    `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "client_credentials",
        client_id: clientId,
        client_secret: clientSecret,
        scope: "https://graph.microsoft.com/.default",
      }),
    }
  );

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Falha ao obter token Azure AD (${res.status}): ${body}`);
  }

  const json = await res.json();

  if (!json.access_token) {
    throw new Error("Token Azure AD ausente na resposta");
  }

  log("INFO", "Token Azure AD obtido com sucesso", {
    expires_in: json.expires_in,
    token_type: json.token_type,
  });

  return json.access_token;
}

// ─── Leitura da planilha ──────────────────────────────────────────────────────

export async function readWorksheet(
  accessToken: string,
  workbookUrl: string,
  sheetName: string
): Promise<unknown[][]> {
  const url = `${workbookUrl}/worksheets/${encodeURIComponent(sheetName)}/usedRange`;

  log("INFO", "Lendo planilha via Graph API", { sheet: sheetName, url });

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(
      `Falha ao ler planilha via Graph API (${res.status}): ${body}`
    );
  }

  const data = await res.json();

  if (!Array.isArray(data.values)) {
    throw new Error(
      "Resposta do Graph API não contém o campo 'values'. Verifique a URL e as permissões do App Registration."
    );
  }

  log("INFO", "Planilha lida com sucesso", {
    total_rows: data.values.length,
    sheet: sheetName,
  });

  return data.values as unknown[][];
}
