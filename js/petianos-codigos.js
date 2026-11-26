// Códigos de votação por disciplina (aba Projetos). Na janela "Organizar códigos", os petianos marcam
// as disciplinas na ordem de prioridade: a primeira marcada fica com 1, 2, 3… do seu curso, a seguinte
// continua do último número do mesmo curso (ou do último do outro curso, se for de lá).
// As não marcadas vêm depois, na ordem da planta. A prioridade fica salva em /site/planta/prioridade.
// Usa $, esc, cursos, projetos, recarregar e aviso de petianos.js.
window.OrganizarCodigos = (() => {
  const CHAVE_PLANTA = "feira-pet:planta";
  const CHAVE_PRIORIDADE = "feira-pet:prioridade";
  const chaveDe = (nome) =>
    String(nome || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "sem-disciplina";
  // Cada item da prioridade é uma disciplina de um curso: "eletrica|integradora-i".
  const itemDe = (nome, curso) => `${curso}|${chaveDe(nome)}`;

  const lerLocal = (chave) => {
    try {
      return JSON.parse(localStorage.getItem(chave));
    } catch {
      return null;
    }
  };
  const guardarLocal = (chave, valor) => {
    try {
      localStorage.setItem(chave, JSON.stringify(valor));
    } catch {
      // sem armazenamento, vale o Firebase
    }
  };

  // Planta salva (ordem do pátio e prioridade dos códigos). Sem acesso ao Firebase, a deste navegador.
  async function lerSalvo() {
    try {
      const planta = await API.lerPlanta();
      const prioridade = Object.values(planta.prioridade || {});
      return { planta, prioridade: prioridade.length ? prioridade : lerLocal(CHAVE_PRIORIDADE) || [] };
    } catch {
      return { planta: lerLocal(CHAVE_PLANTA) || {}, prioridade: lerLocal(CHAVE_PRIORIDADE) || [] };
    }
  }

  // Posição de cada disciplina: primeiro as marcadas na prioridade, depois a ordem da planta.
  function ordemCom(planta, prioridade) {
    const disciplinas = planta?.disciplinas || {};
    const posicao = new Map(prioridade.map((item, i) => [item, i]));
    return (nome, curso) => {
      const p = posicao.get(itemDe(nome, curso));
      if (p !== undefined) return p;
      const s = disciplinas[chaveDe(nome)];
      return 1e6 + (Number.isFinite(s?.ordem) ? s.ordem : 1000 + Planta.ordemPadrao(nome, curso));
    };
  }

  async function ordem() {
    const { planta, prioridade } = await lerSalvo();
    return ordemCom(planta, prioridade);
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

  // automatico: chamado depois de importar ou de mudar um curso; só reorganiza se for seguro (sem votos).
  // Segue a prioridade salva, para não desfazer a escolhida na janela.
  async function executar({ automatico = true } = {}) {
    if (automatico && !(await AjusteAutomatico.ligado())) return { mudaram: 0, pulou: true, desligado: true };
    const votos = await temVotos();
    if (automatico && votos !== false) return { mudaram: 0, pulou: true };
    const resultado = await API.organizarCodigos(await ordem());
    await recarregar();
    return resultado;
  }

  /* Janela de prioridade */
  let grupos = []; // [{ item, nome, curso, projetos }]
  let marcadas = []; // itens na ordem em que foram marcados
  let plantaSalva = {};
  let votosNaRodada = null;

  const curtoDe = (id) => cursos.find((c) => c.id === id)?.curto || "Sem curso";
  const letraDe = (id) => cursos.find((c) => c.id === id)?.letra || "";
  const plural = (n, um, varios) => `${n} ${n === 1 ? um : varios}`;

  function montar() {
    const mapa = new Map();
    for (const p of projetos) {
      const nome = (p.disciplina || "").trim() || "Sem disciplina";
      const item = itemDe(nome, p.curso);
      if (!mapa.has(item)) mapa.set(item, { item, nome, curso: p.curso, projetos: [] });
      mapa.get(item).projetos.push(p);
    }
    const posicao = ordemCom(plantaSalva, []);
    return [...mapa.values()]
      .map((g) => ({ ...g, projetos: g.projetos.sort((a, b) => a.numero - b.numero) }))
      .sort(
        (a, b) =>
          (cursos.find((c) => c.id === a.curso)?.tecla ?? 9) - (cursos.find((c) => c.id === b.curso)?.tecla ?? 9) ||
          posicao(a.nome, a.curso) - posicao(b.nome, b.curso) ||
          a.nome.localeCompare(b.nome, "pt-BR")
      );
  }

  // Números das marcadas, na ordem da prioridade, cada curso com a sua contagem.
  function numeracao() {
    const proximo = {};
    const faixa = new Map();
    for (const item of marcadas) {
      const g = grupos.find((x) => x.item === item);
      if (!g) continue;
      const de = proximo[g.curso] || 1;
      proximo[g.curso] = de + g.projetos.length;
      faixa.set(item, { de, ate: de + g.projetos.length - 1 });
    }
    return faixa;
  }

  function render() {
    const faixa = numeracao();
    let cursoAtual = null;
    $("codigos-lista").innerHTML = grupos
      .map((g) => {
        const titulo = g.curso !== cursoAtual ? `<li class="freq-planilha-curso">${esc(cursos.find((c) => c.id === g.curso)?.nome || "Sem curso")}</li>` : "";
        cursoAtual = g.curso;
        const pos = marcadas.indexOf(g.item);
        const f = faixa.get(g.item);
        const letra = letraDe(g.curso);
        const codigos = f ? (f.de === f.ate ? `${f.de}${letra}` : `${f.de}${letra} a ${f.ate}${letra}`) : "sem número";
        return `${titulo}
          <li class="codigos-item ${pos >= 0 ? "marcada" : ""}">
            <label>
              <input type="checkbox" value="${esc(g.item)}" ${pos >= 0 ? "checked" : ""}>
              <span class="codigos-pos" aria-hidden="true">${pos >= 0 ? `${pos + 1}º` : ""}</span>
              <span class="codigos-nome">${esc(g.nome)}<small>${plural(g.projetos.length, "projeto", "projetos")}</small></span>
              <b class="codigos-faixa">${codigos}</b>
            </label>
          </li>`;
      })
      .join("");

    const faltam = grupos.filter((g) => !marcadas.includes(g.item));
    const totais = cursos
      .map((c) => {
        const ultimo = Math.max(0, ...[...faixa.entries()].filter(([item]) => item.startsWith(`${c.id}|`)).map(([, f]) => f.ate));
        return ultimo ? `${c.curto}: até ${ultimo}${c.letra}` : null;
      })
      .filter(Boolean);
    $("codigos-resumo").textContent = !marcadas.length
      ? "Nenhuma disciplina marcada: nenhuma tem número ainda. Marque na ordem de prioridade."
      : `${plural(marcadas.length, "disciplina marcada", "disciplinas marcadas")} · ${totais.join(" · ")}` +
        (faltam.length === 1
          ? ". A não marcada fica com os números seguintes."
          : faltam.length
            ? `. As ${faltam.length} não marcadas ficam com os números seguintes, na ordem da planta.`
            : ".");
    $("codigos-aplicar").disabled = !marcadas.length;
  }

  function feedback(texto, erro = false) {
    $("codigos-feedback").textContent = texto;
    $("codigos-feedback").classList.toggle("erro", erro);
  }

  async function abrir() {
    const botao = $("organizar-codigos");
    botao.disabled = true;
    try {
      await recarregar();
      if (!projetos.length) return aviso("Cadastre os projetos antes de organizar os códigos.", true);
      const [salvo, votos] = await Promise.all([lerSalvo(), temVotos()]);
      plantaSalva = salvo.planta;
      votosNaRodada = votos;
      grupos = montar();
      marcadas = salvo.prioridade.filter((item) => grupos.some((g) => g.item === item));
      $("codigos-votos").hidden = !votos;
      feedback("");
      render();
      $("codigos-dialogo").showModal();
    } catch (erro) {
      console.error(erro);
      aviso(`Não consegui abrir a organização dos códigos. ${erro.message}`, true);
    } finally {
      botao.disabled = false;
    }
  }

  async function aplicar() {
    if (votosNaRodada && !confirm("Já há votos na rodada atual. Trocar os códigos agora mistura a contagem. Continuar mesmo assim (e zerar a votação depois)?")) return;
    const botao = $("codigos-aplicar");
    botao.disabled = true;
    feedback("Aplicando os códigos…");
    try {
      guardarLocal(CHAVE_PRIORIDADE, marcadas);
      let salvou = true;
      try {
        await API.salvarPrioridade(marcadas);
      } catch (erro) {
        console.error(erro);
        salvou = false;
      }
      const { mudaram } = await API.organizarCodigos(ordemCom(plantaSalva, marcadas));
      await recarregar();
      $("codigos-dialogo").close();
      aviso(
        (mudaram
          ? `${plural(mudaram, "projeto mudou", "projetos mudaram")} de código, na ordem de prioridade escolhida. Grave de novo o .ino das urnas e refaça as placas de mesa.`
          : "Os códigos já estavam nessa ordem.") +
          (salvou ? "" : " A prioridade ficou salva só neste navegador (o Firebase não aceitou salvar).")
      );
    } catch (erro) {
      console.error(erro);
      feedback(`Não consegui aplicar os códigos. ${erro.message}`, true);
    } finally {
      botao.disabled = !marcadas.length;
    }
  }

  /* Eventos */
  $("organizar-codigos").addEventListener("click", abrir);
  $("codigos-fechar").addEventListener("click", () => $("codigos-dialogo").close());
  $("codigos-cancelar").addEventListener("click", () => $("codigos-dialogo").close());
  $("codigos-aplicar").addEventListener("click", aplicar);
  // Marcar põe a disciplina no fim da fila; desmarcar tira e as seguintes sobem uma posição.
  $("codigos-lista").addEventListener("change", (e) => {
    const caixa = e.target.closest("input[type=checkbox]");
    if (!caixa) return;
    marcadas = marcadas.filter((item) => item !== caixa.value);
    if (caixa.checked) marcadas.push(caixa.value);
    render();
    $("codigos-lista").querySelector(`input[value="${CSS.escape(caixa.value)}"]`)?.focus();
  });
  $("codigos-limpar").addEventListener("click", () => {
    marcadas = [];
    render();
  });
  // Completa a fila com as que faltam, na ordem da planta (Elétrica e Renováveis intercaladas pela planta).
  $("codigos-completar").addEventListener("click", () => {
    const posicao = ordemCom(plantaSalva, []);
    const faltam = grupos.filter((g) => !marcadas.includes(g.item)).sort((a, b) => posicao(a.nome, a.curso) - posicao(b.nome, b.curso));
    marcadas = [...marcadas, ...faltam.map((g) => g.item)];
    render();
  });

  return { executar };
})();
