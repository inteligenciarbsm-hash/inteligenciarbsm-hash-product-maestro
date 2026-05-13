/**
 * Gerador de Google Form equivalente ao MS Form do aparelho de barbear.
 * Cria o form, vincula à planilha central E renomeia a aba pra ficar limpa
 * no app (sem "Respostas ao formulário N").
 *
 * Como usar:
 * 1. Acessa script.google.com → Novo projeto
 * 2. Cola este código, salva (Ctrl+S)
 * 3. Roda criarFormBarbear (botão ▶ Executar)
 * 4. Autoriza acesso quando pedir
 * 5. Vê os links no painel "Registro de execução"
 *
 * Pra criar outros forms: copia, troca o CONFIG (título, nome da aba,
 * perguntas) e roda. O resto da lógica é igual.
 */

const CONFIG = {
  SPREADSHEET_ID: "1XQxZIeAujmCCu3Dc4luM1UjKCd8L1N-LQLTer7qkbuQ",
  // Título que aparece pro respondente e no dropdown do app
  FORM_TITLE: "Aparelho Barbear Modelo 1",
  // Subtítulo / descrição
  FORM_DESC: "MARCAS PRÓPRIAS - REDE BRASIL — Análise sensorial / Home use test",
  // Nome curto da aba na planilha (max 100 chars, mas mantém curto)
  TAB_NAME: "Barbear Modelo 1",
};

function criarFormBarbear() {
  const form = FormApp.create(CONFIG.FORM_TITLE);
  form.setDescription(CONFIG.FORM_DESC);
  form.setCollectEmail(false);
  form.setLimitOneResponsePerUser(false);

  // Helpers
  const rating = (titulo, req) =>
    form.addScaleItem().setTitle(titulo).setBounds(1, 5).setRequired(!!req);
  const texto = (titulo, req) =>
    form.addParagraphTextItem().setTitle(titulo).setRequired(!!req);
  const escolha = (titulo, opcoes, req) =>
    form.addMultipleChoiceItem().setTitle(titulo).setChoiceValues(opcoes).setRequired(!!req);

  // 15 perguntas (extraídas do MS Form original)
  rating("Quão fácil foi limpar o aparelho após o uso?", false);
  rating("O aparelho parece confortável de segurar e firme na mão? (1-5)", true);
  rating(": A rapidez com que o barbear foi finalizado foi satisfatória?", false);
  rating("Como você avalia o design e a aparência do aparelho? (1-5)", true);
  rating("Qual o seu nível de satisfação geral com o aparelho?", false);
  texto("Se sim, comente:", false);
  texto("Comentários:", false);
  rating("Quão provável é que você recomende este aparelho a um amigo?", false);
  rating("Com base na aparência, qual a sua expectativa de que o aparelho ofereça um barbear rente? (1-5)", true);
  rating("O aparelho foi fácil de usar em áreas difíceis (pescoço, queixo)?", false);
  escolha("A sua pele apresentou alguma sensibilidade após o barbear?", ["SIM", "NÃO"], false);
  rating("Em comparação com o seu barbeador atual, este é: 1: Muito Pior, 5: Muito Melhor", false);
  rating("O aparelho deslizou suavemente pelo rosto? (1 - 5)", true);
  rating("A qualidade dos materiais (plástico, metal, outros) parece ser alta? (1-5)", true);
  rating("O aparelho proporcionou um barbear rente (sem deixar pelos falhados)?", true);

  // Vincula à planilha — cria uma aba nova
  // Capturamos o estado ANTES pra identificar qual aba foi criada
  const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  const sheetIdsBefore = new Set(ss.getSheets().map((s) => s.getSheetId()));

  form.setDestination(FormApp.DestinationType.SPREADSHEET, CONFIG.SPREADSHEET_ID);

  // Aguarda 2s pro Google criar a aba (operação assíncrona)
  Utilities.sleep(2000);

  // Encontra a aba nova e renomeia
  const ssAfter = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  const newSheet = ssAfter
    .getSheets()
    .find((s) => !sheetIdsBefore.has(s.getSheetId()));

  if (newSheet) {
    // Evita conflito de nome se já existir
    let finalName = CONFIG.TAB_NAME;
    let suffix = 1;
    while (ssAfter.getSheetByName(finalName) && ssAfter.getSheetByName(finalName).getSheetId() !== newSheet.getSheetId()) {
      finalName = CONFIG.TAB_NAME + " " + suffix;
      suffix++;
    }
    newSheet.setName(finalName);
    Logger.log("📊 Aba renomeada para: " + finalName);
  } else {
    Logger.log("⚠️ Não consegui localizar a aba criada (renomeia manualmente).");
  }

  Logger.log("✅ Form criado!");
  Logger.log("📝 Link pra responder: " + form.getPublishedUrl());
  Logger.log("✏️ Link pra editar:    " + form.getEditUrl());
}
