// "Importar das inscrições": transforma respostas do formulário dos alunos em projetos.
// Usa $, esc, cursos, projetos e recarregar de petianos.js.
(() => {
  const { colunas, valorTexto, dataHora } = RelatorioInscricoes;

  // Campo do projeto ← pergunta do formulário. "padrao" é o id da pergunta no modelo; "parecido" acha a pergunta se o id mudou.
  const CAMPOS = [
    { campo: "nome", rotulo: "Nome do projeto", padrao: "projeto", parecido: /nome d[oa] (projeto|equipe)|^\s*projeto/i, obrigatorio: true, limite: 80 },
    { campo: "curso", rotulo: "Curso", padrao: "curso", parecido: /^\s*curso/i, obrigatorio: true },
    { campo: "disciplina", rotulo: "Disciplina", padrao: "disciplina", parecido: /disciplina/i, obrigatorio: true, limite: 80 },
    { campo: "equipe", rotulo: "Equipe", padrao: "equipe", parecido: /integrantes|quais alunos/i, limite: 80 },
    { campo: "resumo", rotulo: "Resumo", padrao: "resumo", parecido: /resumo|descri|do que se trata/i, limite: 400 },
    { campo: "stand", rotulo: "Stand", padrao: "stand", parecido: /^\s*(n[uú]mero do )?stand\s*$/i, limite: 10 },
  ];

  let formulario = null;
  let inscricoes = [];
  let cols = [];
  let mapa = {}; // campo → id da pergunta ("" = não usar)
  const marcadas = new Set();
  const cursoEscolhido = {}; // id da resposta → curso escolhido à mão
  const cursoPorDisciplina = {}; // disciplina (normalizada) → curso, para as respostas sem curso
  const nomeEditado = {}; // id da resposta → nome do projeto corrigido aqui na janela

  const normalizar = (t) => String(t ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

  const cortar = (texto, limite) => (limite && texto.length > limite ? `${texto.slice(0, limite - 1).trimEnd()}…` : texto);

  // Resposta escrita → curso do site. Aceita o nome completo, o curto ou só a palavra principal.
  function acharCurso(resposta) {
    const r = normalizar(resposta);
    if (!r) return null;
    const exato = cursos.find((c) => [c.nome, c.curto, c.id].some((t) => normalizar(t) === r));
    if (exato) return exato.id;
    return cursos.find((c) => r.includes(normalizar(c.id).slice(0, 5)))?.id || null;
  }

  function valor(r, campo) {
    const id = mapa[campo];
    if (!id) return "";
    const v = valorTexto(r.respostas[id]?.v);
    // Equipe com um nome por linha vira uma lista separada por vírgulas.
    return campo === "equipe" ? v.split(/\s*[\n;]\s*/).filter(Boolean).join(", ") : v.replace(/\s+/g, " ").trim();
  }

  function dadosDe(r) {
    const dados = {};
    for (const c of CAMPOS) {
      if (c.campo === "curso") continue;
      dados[c.campo] = cortar(valor(r, c.campo), c.limite);
    }
    if (nomeEditado[r.id] != null) dados.nome = cortar(nomeEditado[r.id].trim(), 80);
    dados.curso = cursoEscolhido[r.id] || acharCurso(valor(r, "curso")) || cursoPorDisciplina[normalizar(dados.disciplina)] || null;
    dados.inscricao = r.id;
    return dados;
  }

  // Já virou projeto? Pelo vínculo gravado ou por um projeto com o mesmo nome.
  function projetoExistente(r) {
    const nome = normalizar(dadosDe(r).nome);
    return projetos.find((p) => p.inscricao === r.id || (nome && normalizar(p.nome) === nome));
  }

  // Inscrição enviada mais de uma vez: mesmo nome e disciplina, ou mesmo resumo e equipe.
  // Vale a mais recente; devolve { id da repetida: inscrição mais recente }.
  function repetidas() {
    const chaves = (r) => {
      const k = [];
      const nome = NomeProjeto.normalizar(valor(r, "nome"));
      const disc = NomeProjeto.normalizar(valor(r, "disciplina"));
      const resumo = NomeProjeto.normalizar(valor(r, "resumo"));
      const equipe = NomeProjeto.normalizar(valor(r, "equipe"));
      if (nome && disc) k.push(`n|${nome}|${disc}`);
      if (resumo.length > 10 && equipe.length > 5) k.push(`r|${resumo}|${equipe}`);
      return k;
    };
    const maisRecente = {};
    for (const r of inscricoes) for (const k of chaves(r)) if (!maisRecente[k] || r.enviadoEm > maisRecente[k].enviadoEm) maisRecente[k] = r;
    const resultado = {};
    for (const r of inscricoes) {
      const outra = chaves(r).map((k) => maisRecente[k]).find((x) => x && x.id !== r.id && x.enviadoEm >= r.enviadoEm);
      if (outra) resultado[r.id] = outra;
    }
    return resultado;
  }

  // Nome que vale conferir antes de ir para a urna (lista de nomes, nome de pessoa, "Grupo 2"…).
  function alertaNome(r) {
    const d = dadosDe(r);
    return NomeProjeto.problema(d.nome, { outros: [valor(r, "equipe")], equipe: valor(r, "equipe"), rigor: "revisao" });
  }

  function problema(r) {
    const d = dadosDe(r);
    if (!d.nome) return "Sem nome do projeto";
    if (!d.disciplina) return "Sem disciplina";
    if (!d.curso) return "Escolha o curso";
    return null;
  }

  /* Tela */
  function renderMapa() {
    $("importar-mapa").innerHTML = CAMPOS.map(
      (c) => `
        <label class="campo">
          <span>${c.rotulo}${c.obrigatorio ? " *" : ""}</span>
          <select data-campo="${c.campo}">
            <option value="">— não usar —</option>
            ${cols.map((q) => `<option value="${esc(q.id)}" ${mapa[c.campo] === q.id ? "selected" : ""}>${esc(q.texto)}</option>`).join("")}
          </select>
        </label>`
    ).join("");
  }

  // Respostas sem curso escrito: o curso vem da disciplina, escolhido uma vez para todas.
  function renderCursos(pendentes) {
    const semCurso = pendentes.filter((r) => !acharCurso(valor(r, "curso")) && !cursoEscolhido[r.id]);
    const disciplinas = new Map();
    for (const r of semCurso) {
      const d = cortar(valor(r, "disciplina"), 80);
      if (!d) continue;
      const n = normalizar(d);
      disciplinas.set(n, { nome: disciplinas.get(n)?.nome || d, qtd: (disciplinas.get(n)?.qtd || 0) + 1 });
    }
    $("importar-cursos").hidden = !disciplinas.size;
    if (!disciplinas.size) return;
    $("importar-cursos").innerHTML = `
      <p class="campo-titulo">Curso de cada disciplina <small>(${semCurso.length} inscrições não dizem o curso)</small></p>
      <div class="importar-cursos-grade">
        ${[...disciplinas.entries()]
          .sort((a, b) => a[1].nome.localeCompare(b[1].nome, "pt-BR"))
          .map(
            ([n, d]) => `
              <label class="importar-curso-linha">
                <span>${esc(d.nome)} <small>${d.qtd}</small></span>
                <select data-disciplina="${esc(n)}">
                  <option value="">Curso?</option>
                  ${cursos.map((c) => `<option value="${c.id}" ${cursoPorDisciplina[n] === c.id ? "selected" : ""}>${esc(c.curto)}</option>`).join("")}
                </select>
              </label>`
          )
          .join("")}
      </div>`;
  }

  function renderLista() {
    let pendentes = inscricoes.filter((r) => !projetoExistente(r));
    const feitas = inscricoes.filter((r) => projetoExistente(r));
    // As repetidas saem das pendentes: fica só a inscrição mais recente de cada equipe.
    const rep = repetidas();
    const repetidasPendentes = pendentes.filter((r) => rep[r.id]);
    pendentes = pendentes.filter((r) => !rep[r.id]);
    renderCursos(pendentes);
    for (const id of [...marcadas]) if (!pendentes.some((r) => r.id === id)) marcadas.delete(id);

    if (!inscricoes.length) {
      $("importar-lista").innerHTML = `<li class="lista-vazia">Ainda não há respostas no formulário dos alunos.</li>`;
    } else {
      $("importar-lista").innerHTML =
        pendentes
          .map((r) => {
            const d = dadosDe(r);
            const erro = problema(r);
            const alerta = alertaNome(r);
            const curso = cursos.find((c) => c.id === d.curso);
            const editando = alerta || nomeEditado[r.id] != null;
            return `
              <li class="importar-item ${erro ? "com-erro" : ""} ${alerta ? "com-alerta" : ""}">
                <input type="checkbox" data-id="${esc(r.id)}" ${marcadas.has(r.id) ? "checked" : ""} ${erro ? "disabled" : ""} aria-label="Importar ${esc(d.nome || "inscrição sem nome")}">
                <span class="importar-info">
                  <b>${esc(d.nome) || "<em>Sem nome do projeto</em>"}</b>
                  <small>${[curso?.curto, d.disciplina, d.equipe].filter(Boolean).map(esc).join(" · ") || "Sem detalhes"}</small>
                  ${erro && erro !== "Escolha o curso" ? `<small class="importar-erro">${esc(erro)}: ajuste o campo acima ou cadastre à mão.</small>` : ""}
                  ${alerta ? `<small class="importar-erro">Confira o nome: ${esc(alerta)}.${d.resumo ? ` Sobre o projeto: “${esc(cortar(d.resumo, 90))}”` : ""}</small>` : ""}
                  ${
                    editando
                      ? `<label class="importar-renomear"><span>Nome que vai para o site e a urna</span>
                          <input data-nome-de="${esc(r.id)}" value="${esc(nomeEditado[r.id] ?? d.nome)}" maxlength="80"></label>`
                      : ""
                  }
                </span>
                ${
                  !d.curso || cursoEscolhido[r.id]
                    ? `<select class="importar-curso" data-curso-de="${esc(r.id)}" aria-label="Curso de ${esc(d.nome)}">
                        <option value="">Curso?</option>
                        ${cursos.map((c) => `<option value="${c.id}" ${d.curso === c.id ? "selected" : ""}>${esc(c.curto)}</option>`).join("")}
                      </select>`
                    : ""
                }
              </li>`;
          })
          .join("") +
        (repetidasPendentes.length
          ? `<li class="importar-separador">Enviadas mais de uma vez: fica só a mais recente (${repetidasPendentes.length})</li>` +
            repetidasPendentes
              .map((r) => {
                const nova = rep[r.id];
                return `<li class="importar-item feito"><span class="item-stand">2×</span><span class="importar-info"><b>${esc(dadosDe(r).nome) || "Sem nome"}</b><small>Enviada em ${esc(dataHora(r.enviadoEm))}; vale a de ${esc(dataHora(nova.enviadoEm))}</small></span></li>`;
              })
              .join("")
          : "") +
        (feitas.length
          ? `<li class="importar-separador">Já cadastradas (${feitas.length})</li>` +
            feitas
              .map((r) => {
                const p = projetoExistente(r);
                return `<li class="importar-item feito"><span class="item-stand">${esc(p.codigo)}</span><span class="importar-info"><b>${esc(p.nome)}</b><small>Já está na lista de projetos</small></span></li>`;
              })
              .join("")
          : "");
    }

    const validas = pendentes.filter((r) => !problema(r));
    const paraRevisar = validas.filter((r) => alertaNome(r)).length;
    const marcaveis = validas.filter((r) => !alertaNome(r));
    $("importar-todos").checked = marcaveis.length > 0 && marcaveis.every((r) => marcadas.has(r.id));
    $("importar-todos").indeterminate = marcadas.size > 0 && !$("importar-todos").checked;
    $("importar-todos").disabled = !validas.length;
    $("importar-contagem").textContent =
      `${pendentes.length} nova${pendentes.length === 1 ? "" : "s"} · ${feitas.length} já cadastrada${feitas.length === 1 ? "" : "s"}` +
      (repetidasPendentes.length ? ` · ${repetidasPendentes.length} repetida${repetidasPendentes.length === 1 ? "" : "s"}` : "") +
      (paraRevisar ? ` · ${paraRevisar} nome${paraRevisar === 1 ? "" : "s"} para conferir` : "");
    $("importar-confirmar").disabled = !marcadas.size;
    $("importar-confirmar").textContent = marcadas.size
      ? `Cadastrar ${marcadas.size} projeto${marcadas.size === 1 ? "" : "s"}`
      : "Cadastrar projetos";
  }

  function aviso(texto, erro = false) {
    $("importar-feedback").textContent = texto;
    $("importar-feedback").classList.toggle("erro", erro);
  }

  /* Eventos */
  $("importar-abrir").addEventListener("click", async () => {
    $("importar-abrir").disabled = true;
    aviso("");
    try {
      [formulario, inscricoes] = await Promise.all([API.lerFormulario("alunos"), API.lerInscricoes("alunos")]);
      cols = colunas(formulario, inscricoes);
      mapa = {};
      for (const c of CAMPOS) {
        mapa[c.campo] = cols.find((q) => q.id === c.padrao)?.id || cols.find((q) => c.parecido.test(q.texto))?.id || "";
      }
      // O nome de quem se inscreveu não é o nome do projeto.
      if (mapa.nome && /complet|quem/i.test(cols.find((q) => q.id === mapa.nome)?.texto || "")) mapa.nome = "";
      marcadas.clear();
      renderMapa();
      renderLista();
      $("importar").showModal();
    } catch (erro) {
      $("feedback").textContent = `Não consegui ler as inscrições. ${erro.message}`;
      $("feedback").classList.add("erro");
    } finally {
      $("importar-abrir").disabled = false;
    }
  });

  const fechar = () => $("importar").close();
  $("importar-fechar").addEventListener("click", fechar);
  $("importar-cancelar").addEventListener("click", fechar);

  $("importar-mapa").addEventListener("change", (e) => {
    const sel = e.target.closest("[data-campo]");
    if (!sel) return;
    mapa[sel.dataset.campo] = sel.value;
    renderLista();
  });

  $("importar-cursos").addEventListener("change", (e) => {
    const sel = e.target.closest("[data-disciplina]");
    if (!sel) return;
    if (sel.value) cursoPorDisciplina[sel.dataset.disciplina] = sel.value;
    else delete cursoPorDisciplina[sel.dataset.disciplina];
    renderLista();
  });

  // Digitando o nome novo: guarda sem redesenhar (para não perder o cursor); redesenha ao sair do campo.
  $("importar-lista").addEventListener("input", (e) => {
    const nome = e.target.closest("[data-nome-de]");
    if (nome) nomeEditado[nome.dataset.nomeDe] = nome.value;
  });

  $("importar-lista").addEventListener("change", (e) => {
    const caixa = e.target.closest("[data-id]");
    const curso = e.target.closest("[data-curso-de]");
    const nome = e.target.closest("[data-nome-de]");
    if (nome) nomeEditado[nome.dataset.nomeDe] = nome.value;
    if (caixa) caixa.checked ? marcadas.add(caixa.dataset.id) : marcadas.delete(caixa.dataset.id);
    if (curso) {
      if (curso.value) cursoEscolhido[curso.dataset.cursoDe] = curso.value;
      else delete cursoEscolhido[curso.dataset.cursoDe];
    }
    renderLista();
  });

  $("importar-todos").addEventListener("change", () => {
    // "Marcar todas" deixa de fora as repetidas e os nomes que ainda pedem conferência.
    const rep = repetidas();
    const validas = inscricoes.filter((r) => !projetoExistente(r) && !problema(r) && !rep[r.id] && !alertaNome(r));
    if ($("importar-todos").checked) validas.forEach((r) => marcadas.add(r.id));
    else marcadas.clear();
    renderLista();
  });

  $("importar-confirmar").addEventListener("click", async () => {
    const escolhidas = inscricoes.filter((r) => marcadas.has(r.id) && !problema(r));
    if (!escolhidas.length) return;
    $("importar-confirmar").disabled = true;
    aviso("Cadastrando…");
    try {
      const criados = await API.importarProjetos(escolhidas.map(dadosDe));
      await recarregar();
      marcadas.clear();
      fechar();
      $("feedback").classList.remove("erro");
      $("feedback").textContent = `${criados.length} projeto${criados.length === 1 ? "" : "s"} importado${criados.length === 1 ? "" : "s"}: ${criados.map((p) => p.codigo).join(", ")}. Confira os dados e grave as urnas de novo.`;
    } catch (erro) {
      aviso(erro.message, true);
      $("importar-confirmar").disabled = false;
    }
  });
})();
