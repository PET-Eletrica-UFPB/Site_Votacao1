// "Placas de mesa" (aba Projetos): todas num PDF, só as disciplinas marcadas num PDF,
// ou um PDF por disciplina marcada dentro de um .zip. Usa $, esc, cursos, projetos e aviso de petianos.js.
(() => {
  let grupos = []; // [{ chave, nome, curso, projetos }]

  const normalizar = (t) => String(t ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
  const nomeArquivo = (t) => normalizar(t).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "sem-disciplina";
  const plural = (n, um, varios) => `${n} ${n === 1 ? um : varios}`;

  // Disciplinas do cadastro (grafias diferentes juntas), Elétrica antes de Renováveis e em ordem alfabética.
  function montar(lista) {
    const mapa = new Map();
    for (const p of lista) {
      const nome = (p.disciplina || "").trim() || "Sem disciplina";
      const chave = normalizar(nome);
      if (!mapa.has(chave)) mapa.set(chave, { chave, grafias: new Map(), cursos: new Map(), projetos: [] });
      const g = mapa.get(chave);
      g.grafias.set(nome, (g.grafias.get(nome) || 0) + 1);
      g.cursos.set(p.curso, (g.cursos.get(p.curso) || 0) + 1);
      g.projetos.push(p);
    }
    const maisComum = (m) => [...m.entries()].sort((a, b) => b[1] - a[1])[0][0];
    const ordemCurso = (c) => Math.max(0, cursos.findIndex((x) => x.id === c));
    return [...mapa.values()]
      .map((g) => ({ chave: g.chave, nome: maisComum(g.grafias), curso: maisComum(g.cursos), projetos: g.projetos }))
      .sort((a, b) => ordemCurso(a.curso) - ordemCurso(b.curso) || a.nome.localeCompare(b.nome, "pt-BR"));
  }

  // Projetos na ordem das urnas (Elétrica, depois Renováveis, pelo número).
  const naOrdem = (lista) => lista.filter(Boolean).sort((a, b) => lista.indexOf(a) - lista.indexOf(b));
  const doCadastro = (escolhidos) => {
    const codigos = new Set(escolhidos.flatMap((g) => g.projetos.map((p) => p.codigo)));
    return naOrdem(projetos.filter((p) => codigos.has(p.codigo)));
  };

  function feedback(texto, erro = false) {
    $("placas-feedback").textContent = texto;
    $("placas-feedback").classList.toggle("erro", erro);
  }

  async function abrir() {
    const botao = $("placas");
    botao.disabled = true;
    aviso("Lendo os projetos…");
    try {
      projetos = await API.lerCadastro();
      renderLista();
      if (!projetos.length) return aviso("Cadastre os projetos antes de gerar as placas.", true);
      aviso("");
      grupos = montar(projetos);
      $("placas-todas-info").textContent = `${plural(projetos.length, "placa", "placas")} de ${plural(grupos.length, "disciplina", "disciplinas")}, num PDF só`;
      let cursoAtual = null;
      $("placas-lista").innerHTML = grupos
        .map((g) => {
          const titulo = g.curso !== cursoAtual ? `<li class="freq-planilha-curso">${esc(cursos.find((c) => c.id === g.curso)?.nome || "Sem curso")}</li>` : "";
          cursoAtual = g.curso;
          return `${titulo}<li><label><input type="checkbox" value="${esc(g.chave)}" checked> <span>${esc(g.nome)}</span> <small>${plural(g.projetos.length, "placa", "placas")}</small></label></li>`;
        })
        .join("");
      feedback("");
      $("placas-dialogo").showModal();
    } catch (erro) {
      console.error(erro);
      aviso(`Não consegui ler os projetos. ${erro.message}`, true);
    } finally {
      botao.disabled = false;
    }
  }

  const marcadas = () => {
    const chaves = new Set([...$("placas-lista").querySelectorAll("input:checked")].map((c) => c.value));
    return grupos.filter((g) => chaves.has(g.chave));
  };

  async function gerando(acao) {
    const botoes = $("placas-dialogo").querySelectorAll(".freq-planilha-opcao");
    botoes.forEach((b) => (b.disabled = true));
    try {
      await acao();
    } catch (erro) {
      console.error(erro);
      feedback(`Não consegui gerar as placas. ${erro.message}`, true);
    } finally {
      botoes.forEach((b) => (b.disabled = false));
    }
  }

  // 1) Todas as placas num PDF.
  $("placas-todas").addEventListener("click", () =>
    gerando(async () => {
      feedback("Gerando as placas…");
      await Placas.baixar(naOrdem(projetos));
      feedback(`PDF baixado com ${plural(projetos.length, "placa", "placas")}, uma folha para cada projeto.`);
    })
  );

  // 2) Só as disciplinas marcadas, num PDF.
  $("placas-marcadas").addEventListener("click", () =>
    gerando(async () => {
      const lista = marcadas();
      if (!lista.length) return feedback("Marque pelo menos uma disciplina.", true);
      const escolhidos = doCadastro(lista);
      feedback("Gerando as placas…");
      const nome = lista.length === 1 ? `placas-${nomeArquivo(lista[0].nome)}` : "placas-de-mesa-selecionadas";
      await Placas.baixar(escolhidos, nome, lista.length === 1 ? `Placas de mesa · ${lista[0].nome}` : "Placas de mesa");
      feedback(`PDF baixado com ${plural(escolhidos.length, "placa", "placas")} de ${plural(lista.length, "disciplina", "disciplinas")}.`);
    })
  );

  // 3) Um PDF para cada disciplina marcada, todos num .zip.
  $("placas-zip").addEventListener("click", () =>
    gerando(async () => {
      const lista = marcadas();
      if (!lista.length) return feedback("Marque pelo menos uma disciplina.", true);
      const arquivos = [];
      for (const [i, g] of lista.entries()) {
        feedback(`Gerando ${i + 1} de ${lista.length}: ${g.nome}…`);
        arquivos.push({ nome: `placas-${nomeArquivo(g.nome)}.pdf`, dados: await Placas.bytes(doCadastro([g]), `Placas de mesa · ${g.nome}`) });
      }
      feedback("Montando o .zip…");
      await Exportar.zipArquivos("placas-por-disciplina", arquivos);
      feedback(`.zip baixado com ${plural(lista.length, "PDF", "PDFs")}, um por disciplina.`);
    })
  );

  $("placas-marcar").addEventListener("click", () => {
    const caixas = [...$("placas-lista").querySelectorAll("input")];
    const todas = caixas.every((c) => c.checked);
    caixas.forEach((c) => (c.checked = !todas));
  });
  $("placas-fechar").addEventListener("click", () => $("placas-dialogo").close());
  $("placas").addEventListener("click", abrir);
})();
