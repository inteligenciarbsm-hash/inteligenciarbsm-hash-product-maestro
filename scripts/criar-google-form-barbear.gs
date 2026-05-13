/**
 * Gerador de Google Form equivalente ao MS Form "MARCAS PRÓPRIAS - REDE BRASIL - APARELHO BARBEAR MODELO 1".
 *
 * Como usar:
 * 1. Acessa script.google.com → Novo projeto
 * 2. Cola este código, salva (Ctrl+S)
 * 3. Roda a função criarFormBarbear (botão ▶ Executar)
 * 4. Autoriza acesso quando pedir (Avançado → Acessar não seguro → Permitir)
 * 5. Ver Logger.log no painel "Registro de execução" pra pegar o link do form criado
 *
 * O form já vincula respostas à planilha central (vira aba nova).
 */

function criarFormBarbear() {
  const SPREADSHEET_ID = "1XQxZIeAujmCCu3Dc4luM1UjKCd8L1N-LQLTer7qkbuQ";
  const TITLE = "MARCAS PRÓPRIAS - REDE BRASIL - APARELHO BARBEAR MODELO 1";
  const DESC  = "ANÁLISE SENSORIAL / HOME USE TEST";

  const form = FormApp.create(TITLE);
  form.setDescription(DESC);
  form.setCollectEmail(false);
  form.setLimitOneResponsePerUser(false);

  const rating = (titulo, req) =>
    form.addScaleItem().setTitle(titulo).setBounds(1, 5).setRequired(!!req);
  const texto = (titulo, req) =>
    form.addParagraphTextItem().setTitle(titulo).setRequired(!!req);
  const escolha = (titulo, opcoes, req) =>
    form.addMultipleChoiceItem().setTitle(titulo).setChoiceValues(opcoes).setRequired(!!req);

  // ===== 15 perguntas =====
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

  // Vincula respostas à planilha central → cria aba nova automaticamente
  form.setDestination(FormApp.DestinationType.SPREADSHEET, SPREADSHEET_ID);

  Logger.log("✅ Form criado!");
  Logger.log("📝 Link pra responder: " + form.getPublishedUrl());
  Logger.log("✏️ Link pra editar:    " + form.getEditUrl());
  Logger.log("📊 Aba criada na planilha: " + SPREADSHEET_ID);
}
