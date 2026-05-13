/**
 * SAC Rede Brasil — endpoint público que expõe a planilha de pesquisas como JSON.
 *
 * Como usar:
 * 1) Abra a planilha de respostas (a que recebe os formulários).
 * 2) Extensões → Apps Script → cole este arquivo em "Código.gs".
 * 3) Salve, depois Implantar → Gerenciar implantações → ✏️ → "Nova versão" → Implantar.
 * 4) Mantém o mesmo /exec (não precisa atualizar a env var na Vercel).
 *
 * Recarregue a planilha pra ver o menu "🧹 Manutenção" aparecer no topo.
 *
 * Endpoints:
 *   GET ?               → { sheets: [{ name, formTitle, rows, lastUpdate }] }
 *   GET ?sheet=<nome>   → { headers: [...], rows: [{...}] }
 */

// ============================================================================
// ENDPOINT PÚBLICO (/exec) — lido pelo app
// ============================================================================

function doGet(e) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheetName = e && e.parameter && e.parameter.sheet;

  if (!sheetName) {
    const sheets = ss.getSheets().map(s => {
      let formTitle = null;
      try {
        const url = s.getFormUrl();
        if (url) formTitle = FormApp.openByUrl(url).getTitle();
      } catch (_err) {
        // Aba sem form vinculado ou form deletado — ignora.
      }
      return {
        name: s.getName(),
        formTitle: formTitle,
        rows: Math.max(0, s.getLastRow() - 1),
        lastUpdate: s.getLastRow() > 1
          ? s.getRange(s.getLastRow(), 1).getValue()
          : null,
      };
    });
    return _json({ sheets });
  }

  const sheet = ss.getSheetByName(sheetName);
  if (!sheet) return _json({ error: "Aba não encontrada" });

  const values = sheet.getDataRange().getValues();
  if (values.length === 0) return _json({ headers: [], rows: [] });

  const [headers, ...rest] = values;
  const rows = rest
    .filter(r => r.some(cell => cell !== "" && cell !== null))
    .map(r => Object.fromEntries(headers.map((h, i) => [String(h), r[i]])));

  return _json({ headers: headers.map(String), rows });
}

function _json(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

// ============================================================================
// MENU "🧹 MANUTENÇÃO" — aparece na própria planilha
// ============================================================================

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu("🧹 Manutenção")
    .addItem("Limpar abas de forms deletados", "limparAbasOrfas")
    .addToUi();
}

/**
 * Detecta abas cujo Google Form vinculado foi deletado (não existe mais)
 * e oferece pra remover. Pede confirmação antes de apagar.
 */
function limparAbasOrfas() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const ui = SpreadsheetApp.getUi();
  const orfas = [];

  for (const sheet of ss.getSheets()) {
    const formUrl = sheet.getFormUrl();
    if (!formUrl) continue; // sem form vinculado — não considera órfã

    try {
      FormApp.openByUrl(formUrl);
      // Form ainda existe — mantém a aba
    } catch (e) {
      // openByUrl falhou → form foi deletado ou ficou inacessível
      orfas.push(sheet);
    }
  }

  if (orfas.length === 0) {
    ui.alert("Nenhuma aba órfã encontrada — todos os forms vinculados ainda existem.");
    return;
  }

  const lista = orfas.map(s => `• ${s.getName()}`).join("\n");
  const resp = ui.alert(
    "Limpar abas órfãs?",
    `As seguintes abas têm o formulário vinculado deletado:\n\n${lista}\n\nApagar essas abas? (Os dados serão perdidos.)`,
    ui.ButtonSet.YES_NO
  );

  if (resp !== ui.Button.YES) return;

  for (const sheet of orfas) {
    ss.deleteSheet(sheet);
  }
  ui.alert(`✅ ${orfas.length} aba(s) órfã(s) removida(s).`);
}
