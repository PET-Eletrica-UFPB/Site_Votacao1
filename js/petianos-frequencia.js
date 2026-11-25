// Aba "Frequência": lista de alunos por disciplina, separada por curso.
// Junta as inscrições dos alunos (com a lista completa de integrantes) e os projetos
// cadastrados à mão, que não vieram de uma inscrição. Usa $ e esc de petianos.js.
(() => {
  const { cursos } = window.FEIRA;
  const { valorTexto } = RelatorioInscricoes;
  const SEM_CURSO = { id: "sem-curso", nome: "Curso não informado" };
  const SEM_DISCIPLINA = "Sem disciplina";

  let grupos = []; // [{ curso, disciplinas: [{ nome, alunos: [{ nome, projetos: [] }] }] }]
  let carregado = false;

  const normalizar = (t) => String(t ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
  const porNome = (a, b) => a.localeCompare(b, "pt-BR", { sensitivity: "base" });

  /* Leitura das respostas: acha a pergunta pelo id do modelo ou pelo texto dela. */
  const PERGUNTAS = {
    equipe: { id: "equipe", texto: /integrantes|quais alunos|nomes? d[oa]s? (alunos|participantes)/i, nao: /quantos/i },
    curso: { id: "curso", texto: /^\s*curso/i },
    disciplina: { id: "disciplina", texto: /disciplina/i },
    projeto: { id: "projeto", texto: /nome d[oa] (projeto|equipe)|^\s*projeto/i },
  };

  function resposta(r, campo) {
    const { id, texto, nao } = PERGUNTAS[campo];
    const achada = r.respostas[id] ?? Object.values(r.respostas).find((x) => texto.test(x?.p || "") && !(nao && nao.test(x?.p || "")));
    return valorTexto(achada?.v).trim();
  }

  // Resposta escrita → curso do site. Aceita o nome completo, o curto ou só a palavra principal.
  function acharCurso(texto) {
    const t = normalizar(texto);
    if (!t) return null;
    const exato = cursos.find((c) => [c.nome, c.curto, c.id].some((x) => normalizar(x) === t));
    if (exato) return exato.id;
    if (/renov|alternativ/.test(t)) return "renovaveis";
    if (/eletric/.test(t)) return "eletrica";
    return null;
  }

  const PEQUENAS = new Set(["da", "das", "de", "do", "dos", "e"]);
  // Nomes todos em maiúsculas (ou minúsculas) viram "Ana de Souza".
  function arrumarNome(nome) {
    if (nome !== nome.toUpperCase() && nome !== nome.toLowerCase()) return nome;
    return nome
      .toLowerCase()
      .split(" ")
      .map((p, i) => (i > 0 && PEQUENAS.has(p) ? p : p.charAt(0).toUpperCase() + p.slice(1)))
      .join(" ");
  }

  // "1. Ana Souza - 2021000123\nJoão Lima e Maria Silva" → ["Ana Souza", "João Lima", "Maria Silva"]
  function separarNomes(texto) {
    return String(texto ?? "")
      .replace(/^\s*(integrantes|alunos|participantes|nomes?)\s*:\s*/i, "")
      .replace(/\([^)]*\)/g, " ")
      .replace(/\d{5,}/g, " ")
      .split(/\s*(?:\n|,|;|\/|\s[-–]\s|\se\s(?=\p{Lu}))\s*/u)
      .map((n) =>
        n
          .replace(/^\s*(\d+\s*[.)º°:-]?|[-–•*])\s*/, "")
          .replace(/[-–:.]+\s*$/, "")
          .replace(/\s+/g, " ")
          .trim()
      )
      .filter((n) => (n.match(/\p{L}/gu) || []).length >= 3 && !n.endsWith("…"))
      .map(arrumarNome);
  }

  /* Monta os grupos a partir das inscrições e do cadastro. */
  function montar(inscricoes, projetos) {
    const projetoDaInscricao = new Map(projetos.filter((p) => p.inscricao).map((p) => [p.inscricao, p]));
    // Disciplina → curso, aprendido dos projetos e das inscrições que informam o curso.
    const cursoDaDisciplina = new Map();
    const lembrar = (disc, curso) => {
      const k = normalizar(disc);
      if (!k || !curso) return;
      const atual = cursoDaDisciplina.get(k);
      cursoDaDisciplina.set(k, atual && atual !== curso ? "conflito" : curso);
    };

    const registros = []; // { curso, disciplina, projeto, nomes }
    for (const r of inscricoes) {
      const p = projetoDaInscricao.get(r.id);
      const disciplina = p?.disciplina || resposta(r, "disciplina");
      const curso = p?.curso || acharCurso(resposta(r, "curso"));
      lembrar(disciplina, curso);
      registros.push({ curso, disciplina, projeto: p?.nome || resposta(r, "projeto"), nomes: separarNomes(resposta(r, "equipe")) });
    }
    const comInscricao = new Set(inscricoes.map((r) => r.id));
    for (const p of projetos) {
      lembrar(p.disciplina, p.curso);
      if (p.inscricao && comInscricao.has(p.inscricao)) continue;
      registros.push({ curso: p.curso, disciplina: p.disciplina, projeto: p.nome, nomes: separarNomes(p.equipe) });
    }

    // curso → disciplina normalizada → { grafias, alunos: Map(nome normalizado → aluno) }
    const arvore = new Map();
    for (const reg of registros) {
      if (!reg.nomes.length) continue;
      const discKey = normalizar(reg.disciplina) || normalizar(SEM_DISCIPLINA);
      let curso = reg.curso || cursoDaDisciplina.get(discKey);
      if (!curso || curso === "conflito") curso = SEM_CURSO.id;
      if (!arvore.has(curso)) arvore.set(curso, new Map());
      const discs = arvore.get(curso);
      if (!discs.has(discKey)) discs.set(discKey, { grafias: new Map(), alunos: new Map() });
      const d = discs.get(discKey);
      const grafia = reg.disciplina?.trim() || SEM_DISCIPLINA;
      d.grafias.set(grafia, (d.grafias.get(grafia) || 0) + 1);
      for (const nome of reg.nomes) {
        const k = normalizar(nome);
        if (!d.alunos.has(k)) d.alunos.set(k, { nome, projetos: [] });
        const aluno = d.alunos.get(k);
        if (reg.projeto && !aluno.projetos.includes(reg.projeto)) aluno.projetos.push(reg.projeto);
      }
    }

    return [...cursos, SEM_CURSO]
      .filter((c) => arvore.has(c.id))
      .map((c) => ({
        curso: c,
        disciplinas: [...arvore.get(c.id).values()]
          .map((d) => ({
            // A grafia mais usada dá nome à disciplina.
            nome: [...d.grafias.entries()].sort((a, b) => b[1] - a[1])[0][0],
            alunos: [...d.alunos.values()].sort((a, b) => porNome(a.nome, b.nome)),
          }))
          .sort((a, b) => porNome(a.nome, b.nome)),
      }));
  }

  /* Busca: por aluno, projeto ou disciplina. */
  function filtrar(termo) {
    const t = normalizar(termo);
    if (!t) return grupos;
    return grupos
      .map((g) => ({
        ...g,
        disciplinas: g.disciplinas
          .map((d) =>
            normalizar(d.nome).includes(t)
              ? d
              : { ...d, alunos: d.alunos.filter((a) => normalizar(`${a.nome} ${a.projetos.join(" ")}`).includes(t)) }
          )
          .filter((d) => d.alunos.length),
      }))
      .filter((g) => g.disciplinas.length);
  }

  const contar = (lista) => lista.reduce((s, g) => s + g.disciplinas.reduce((x, d) => x + d.alunos.length, 0), 0);
  const plural = (n, um, varios) => `${n} ${n === 1 ? um : varios}`;

  function render() {
    const termo = $("freq-busca").value;
    const lista = filtrar(termo);
    const total = contar(grupos);
    $("freq-resumo").textContent = total
      ? `${plural(total, "aluno", "alunos")} em ${plural(grupos.reduce((s, g) => s + g.disciplinas.length, 0), "disciplina", "disciplinas")}` +
        (termo.trim() ? ` · ${plural(contar(lista), "encontrado", "encontrados")}` : "")
      : "";
    $("freq-pdf").disabled = !total;

    if (!total) {
      $("freq-lista").innerHTML = `<p class="lista-vazia">Nenhum aluno encontrado nas inscrições nem nos projetos cadastrados.</p>`;
      return;
    }
    if (!lista.length) {
      $("freq-lista").innerHTML = `<p class="lista-vazia">Nenhum aluno, projeto ou disciplina com “${esc(termo.trim())}”.</p>`;
      return;
    }
    $("freq-lista").innerHTML = lista
      .map(
        (g) => `
        <section class="freq-curso">
          <h2>${esc(g.curso.nome)}</h2>
          ${g.disciplinas
            .map(
              (d) => `
            <div class="freq-disciplina">
              <div class="freq-disciplina-topo">
                <h3>${esc(d.nome)} <small>${plural(d.alunos.length, "aluno", "alunos")}</small></h3>
                <button class="btn btn-vidro" type="button" data-curso="${esc(g.curso.id)}" data-disciplina="${esc(d.nome)}">PDF</button>
              </div>
              <table class="freq-tabela">
                <thead><tr><th>Nº</th><th>Aluno</th><th>Projeto</th></tr></thead>
                <tbody>
                  ${d.alunos
                    .map((a, i) => `<tr><td class="num">${i + 1}</td><td>${esc(a.nome)}</td><td>${esc(a.projetos.join(" · ")) || "–"}</td></tr>`)
                    .join("")}
                </tbody>
              </table>
            </div>`
            )
            .join("")}
        </section>`
      )
      .join("");
  }

  async function carregar() {
    $("freq-lista").innerHTML = `<p class="lista-vazia">Carregando os alunos…</p>`;
    situacao("");
    try {
      const [inscricoes, projetos] = await Promise.all([API.lerInscricoes("alunos"), API.lerCadastro()]);
      grupos = montar(inscricoes, projetos);
      carregado = true;
      render();
    } catch (erro) {
      console.error(erro);
      $("freq-lista").innerHTML = "";
      situacao(`Não consegui ler os alunos. ${erro.message}`, "alerta");
    }
  }

  function situacao(texto, classe = "") {
    $("freq-situacao").className = `urna-situacao ${classe}`;
    $("freq-situacao").textContent = texto;
  }

  /* PDF: cada disciplina começa numa página, com espaço para assinatura. */
  async function baixarPdf(lista, nomeArquivo, subtitulo) {
    const p = await PDF.criar({
      rotulo: "PET ELÉTRICA UFPB  ·  FREQUÊNCIA",
      titulo: "Lista de frequência",
      subtitulo,
      cabecalho: "Lista de frequência",
    });
    let primeira = true;
    for (const g of lista) {
      for (const [i, d] of g.disciplinas.entries()) {
        if (!primeira) p.novaPagina();
        primeira = false;
        if (i === 0) p.tituloSecao(g.curso.nome, `${plural(g.disciplinas.reduce((s, x) => s + x.alunos.length, 0), "aluno", "alunos")} em ${plural(g.disciplinas.length, "disciplina", "disciplinas")}`);
        p.subtitulo(`${d.nome}  (${plural(d.alunos.length, "aluno", "alunos")})`);
        p.tabela({
          head: [["Nº", "Aluno", "Projeto", "Assinatura"]],
          body: d.alunos.map((a, n) => [n + 1, a.nome, a.projetos.join(" · ") || "–", ""]),
          styles: { minCellHeight: 9 },
          columnStyles: { 0: { cellWidth: 10, halign: "center" }, 1: { cellWidth: 62 }, 2: { cellWidth: 52 }, 3: { cellWidth: "auto" } },
        });
      }
    }
    p.salvar(nomeArquivo);
  }

  const nomeArquivo = (t) => normalizar(t).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

  async function gerar(botao, lista, arquivo, subtitulo) {
    botao.disabled = true;
    situacao("Gerando o PDF…");
    try {
      await baixarPdf(lista, arquivo, subtitulo);
      situacao("PDF baixado.", "ok");
    } catch (erro) {
      console.error(erro);
      situacao(`Não consegui gerar o PDF. ${erro.message}`, "alerta");
    } finally {
      botao.disabled = false;
    }
  }

  /* Eventos */
  $("freq-busca").addEventListener("input", () => carregado && render());
  $("freq-atualizar").addEventListener("click", carregar);
  // O PDF geral segue a busca: com algo digitado, sai só o que está na tela.
  $("freq-pdf").addEventListener("click", () => {
    const termo = $("freq-busca").value.trim();
    const lista = filtrar(termo);
    if (!lista.length) return situacao("Nada para baixar com essa busca.", "alerta");
    gerar($("freq-pdf"), lista, termo ? `frequencia-busca-${nomeArquivo(termo)}` : "frequencia", termo ? `Busca: ${termo}` : "Alunos por disciplina");
  });
  $("freq-lista").addEventListener("click", (e) => {
    const botao = e.target.closest("[data-disciplina]");
    if (!botao) return;
    // A lista da disciplina sai inteira, mesmo com uma busca por aluno na tela.
    const g = grupos.find((x) => x.curso.id === botao.dataset.curso);
    const d = g?.disciplinas.find((x) => x.nome === botao.dataset.disciplina);
    if (d) gerar(botao, [{ ...g, disciplinas: [d] }], `frequencia-${nomeArquivo(d.nome)}`, d.nome);
  });
  // Relê a cada visita, para incluir inscrições e projetos novos.
  document.querySelector('.painel-topo [data-aba="frequencia"]').addEventListener("click", carregar);
})();
