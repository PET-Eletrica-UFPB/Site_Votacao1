// Checagens do nome de projeto, usadas no formulário público e nas importações da Área dos Petianos.
window.NomeProjeto = (() => {
  const LIMITE = 60; // precisa caber no site, no placar e na urna

  const normalizar = (s) =>
    String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

  // Primeiros nomes de quem está na lista de integrantes ("Ana Souza, João Lima" → ["ana", "joao"]).
  const primeirosNomes = (equipe) =>
    String(equipe ?? "")
      .split(/\s*(?:[,;\n]|\s-\s|\d+\.|\se\s)\s*/i)
      .map((p) => normalizar(p).split(" ")[0])
      .filter((n) => n && n.length > 2);

  /**
   * Motivo para recusar ou revisar um nome de projeto, ou null se está ok.
   * outros: textos das outras respostas (ex.: lista de integrantes).
   * rigor "formulario" bloqueia só o que é certamente erro; "revisao" também aponta o que vale conferir.
   */
  function problema(valor, { outros = [], equipe = "", rigor = "formulario" } = {}) {
    const t = String(valor ?? "").trim();
    if (!t) return null;
    if (/\d{6,}/.test(t)) return "parece ter números de matrícula";
    const partes = t.split(/\s*[,;]\s*|\s+e\s+/i).filter(Boolean);
    if (/[,;]/.test(t) && partes.length >= 3) return "parece uma lista de nomes";
    // "Grupo 1 (Gustavo, Luan…)": número do grupo seguido de nomes separados por vírgula.
    if (/^\(?\s*grupo\s*\d+/i.test(t) && /,/.test(t)) return "tem os nomes dos integrantes";
    if (/^\(?\s*(grupo|equipe|time)\s*\d+\s*\)?\s*$/i.test(t)) return "é só um número de grupo: acrescente o assunto do projeto";
    const n = normalizar(t);
    if (outros.some((o) => normalizar(o).length > 15 && (normalizar(o).includes(n) || n.includes(normalizar(o))))) {
      return "é igual à lista de integrantes";
    }
    if (t.length > LIMITE) return `passa de ${LIMITE} caracteres`;
    if (rigor === "revisao") {
      // Pode ser o nome de um integrante (ex.: "RYAN RODRIGUES NOBREGA" numa equipe com "Ryan").
      const palavras = n.split(" ");
      if (palavras.length >= 2 && palavras.length <= 5 && primeirosNomes(equipe).includes(palavras[0])) {
        return "parece o nome de um integrante";
      }
      // Todo em maiúsculas com três palavras de verdade (siglas como "T.J.V" passam).
      if (t === t.toUpperCase() && palavras.filter((p) => p.length >= 3).length >= 3) return "está todo em maiúsculas, pode ser nome de pessoa";
    }
    return null;
  }

  return { problema, normalizar, LIMITE };
})();
