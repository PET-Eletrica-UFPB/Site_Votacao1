// Interruptor "Ajuste automático" da aba Projetos. Ligado (padrão), o site:
//  • reorganiza os códigos por disciplina depois de importar inscrições ou trocar o curso de um projeto;
//  • leva para o projeto as correções feitas nas respostas do formulário (na hora e ao entrar no painel).
// Desligado, nada disso acontece: a tabela de projetos só muda pelo que for feito à mão.
// A escolha vale para todos os petianos (fica em /site/planta/ajusteAutomatico) e também neste navegador.
window.AjusteAutomatico = (() => {
  const CHAVE = "feira-pet:ajuste-automatico";
  let valor = null; // true / false depois de ler
  let leitura = null;

  const el = (id) => document.getElementById(id);

  function lerLocal() {
    try {
      const v = localStorage.getItem(CHAVE);
      return v === null ? null : v === "1";
    } catch {
      return null;
    }
  }
  function guardarLocal(v) {
    try {
      localStorage.setItem(CHAVE, v ? "1" : "0");
    } catch {
      // sem armazenamento, vale o Firebase
    }
  }

  function mostrar() {
    const ligado = valor !== false;
    el("ajuste-automatico").checked = ligado;
    el("ajuste-automatico-txt").textContent = ligado ? "Ajuste automático ativado" : "Ajuste automático desativado";
    el("ajuste-automatico-dica").textContent = ligado
      ? "Ao importar inscrições ou trocar um curso, os códigos se reorganizam por disciplina, e as correções do formulário vão para os projetos (inclusive as feitas enquanto estava desativado)."
      : "Nada muda sozinho: códigos e dados dos projetos só mudam pelo que vocês editarem aqui.";
  }

  // Lê uma vez (Firebase; sem acesso, o que ficou neste navegador). Padrão: ligado.
  function ligado() {
    if (valor !== null) return Promise.resolve(valor);
    leitura ??= API.lerPlanta()
      .then((planta) => (typeof planta.ajusteAutomatico === "boolean" ? planta.ajusteAutomatico : lerLocal() ?? true))
      .catch(() => lerLocal() ?? true)
      .then((v) => {
        valor = v;
        guardarLocal(v);
        mostrar();
        return v;
      });
    return leitura;
  }

  el("ajuste-automatico").addEventListener("change", async (e) => {
    const novo = e.target.checked;
    valor = novo;
    guardarLocal(novo);
    mostrar();
    e.target.disabled = true;
    try {
      await API.salvarAjusteAutomatico(novo);
      aviso(novo ? "Ajuste automático ativado." : "Ajuste automático desativado: a tabela de projetos só muda pelo que for feito à mão.");
      // Religado: as correções feitas no formulário enquanto estava desligado vão agora para os projetos.
      if (novo) await sincronizarInscricoes();
    } catch (erro) {
      console.error(erro);
      aviso("O ajuste automático mudou só neste navegador (o Firebase não aceitou salvar).", true);
    } finally {
      e.target.disabled = false;
    }
  });

  mostrar();
  return { ligado };
})();
