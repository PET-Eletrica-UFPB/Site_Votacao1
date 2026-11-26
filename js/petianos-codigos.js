// Códigos de votação em sequência por disciplina (aba Projetos). Os projetos de cada disciplina
// ficam com números seguidos, na ordem das disciplinas da planta. Usa $, projetos, recarregar e aviso de petianos.js.
window.OrganizarCodigos = (() => {
  const CHAVE_PLANTA = "feira-pet:planta";
  const chaveDe = (nome) =>
    String(nome || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "sem-disciplina";

  // Ordem das disciplinas: a salva na janela "Planta da feira"; sem ela, a da planta original.
  async function ordem() {
    let salvo = null;
    try {
      salvo = await API.lerPlanta();
    } catch {
      try {
        salvo = JSON.parse(localStorage.getItem(CHAVE_PLANTA));
      } catch {
        salvo = null;
      }
    }
    const disciplinas = salvo?.disciplinas || {};
    return (nome, curso) => {
      const s = disciplinas[chaveDe(nome)];
      return Number.isFinite(s?.ordem) ? s.ordem : 1000 + Planta.ordemPadrao(nome, curso);
    };
  }

  // Votos da rodada atual: com votação em andamento, trocar códigos bagunçaria a contagem das urnas.
  async function temVotos() {
    try {
      const { votos } = await API.buscarVotos();
      return Object.values(votos).some((v) => v > 0);
    } catch {
      return null; // não deu para saber
    }
  }

  // automatico: chamado depois de importar; só reorganiza se for seguro (sem votos).
  async function executar({ automatico = false } = {}) {
    const votos = await temVotos();
    if (automatico && votos !== false) return { mudaram: 0, pulou: true };
    if (!automatico) {
      const aviso =
        "Reorganizar os códigos de votação para que os projetos de cada disciplina fiquem com números seguidos (na ordem da planta)?\n\n" +
        "• Professores e notas acompanham os projetos.\n" +
        "• Depois é preciso baixar e gravar de novo o .ino das duas urnas e refazer as placas de mesa." +
        (votos ? "\n\nATENÇÃO: já há votos na rodada atual. Trocar os códigos agora mistura a contagem. Só continue se for zerar a votação depois." : "");
      if (!confirm(aviso)) return { mudaram: 0, cancelou: true };
    }
    const resultado = await API.organizarCodigos(await ordem());
    await recarregar();
    return resultado;
  }

  $("organizar-codigos").addEventListener("click", async () => {
    const botao = $("organizar-codigos");
    botao.disabled = true;
    try {
      const { mudaram, cancelou } = await executar();
      if (cancelou) return;
      aviso(
        mudaram
          ? `${mudaram} projeto${mudaram === 1 ? " mudou" : "s mudaram"} de código. Agora cada disciplina tem números seguidos. Grave de novo o .ino das urnas e refaça as placas de mesa.`
          : "Os códigos já estavam em sequência por disciplina."
      );
    } catch (erro) {
      console.error(erro);
      aviso(`Não consegui reorganizar os códigos. ${erro.message}`, true);
    } finally {
      botao.disabled = false;
    }
  });

  return { executar };
})();
