// Aba "Frequência": lista de alunos por disciplina, separada por curso, com presença.
// Os alunos vêm das inscrições (lista completa de integrantes) e dos projetos cadastrados
// sem inscrição. Os petianos marcam a presença e podem acrescentar, editar ou retirar alunos;
// isso fica em /site/frequencia. Usa $ e esc de petianos.js.
(() => {
  const { cursos } = window.FEIRA;
  const { valorTexto } = RelatorioInscricoes;
  const SEM_CURSO = { id: "sem-curso", nome: "Curso não informado" };
  const SEM_DISCIPLINA = "Sem disciplina";
  const CHAVE_LOCAL = "feira-pet:frequencia";

  let inscricoes = [];
  let projetos = [];
  let estado = { presenca: {}, extras: {}, removidos: {} };
  let grupos = []; // [{ curso, disciplinas: [{ nome, alunos: [{ chave, nome, projetos, extra, removido }] }] }]
  let carregado = false;
  let soNesteNavegador = false; // regras do Firebase ainda sem leitura da frequência
  let editando = null; // aluno em edição no diálogo (null = acrescentando)

  const normalizar = (t) => String(t ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
  const porNome = (a, b) => a.localeCompare(b, "pt-BR", { sensitivity: "base" });
  const plural = (n, um, varios) => `${n} ${n === 1 ? um : varios}`;

  // Chave estável de um aluno vindo das inscrições (curso + disciplina + nome), segura para o Firebase.
  function chaveDe(...partes) {
    const texto = partes.map(normalizar).join("|");
    let h1 = 0xdeadbeef;
    let h2 = 0x41c6ce57;
    for (let i = 0; i < texto.length; i++) {
      const c = texto.charCodeAt(i);
      h1 = Math.imul(h1 ^ c, 2654435761);
      h2 = Math.imul(h2 ^ c, 1597334677);
    }
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
    return `a${(4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36)}`;
  }
  const novoId = () => `x${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;

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

  /* Monta os grupos: inscrições + projetos sem inscrição + alunos acrescentados à mão. */
  function montar() {
    const mostrarRetirados = $("freq-retirados").checked;
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

    // curso → disciplina normalizada → { grafias, alunos: Map }
    const arvore = new Map();
    const disciplinaEm = (curso, disciplina) => {
      const discKey = normalizar(disciplina) || normalizar(SEM_DISCIPLINA);
      if (!arvore.has(curso)) arvore.set(curso, new Map());
      const discs = arvore.get(curso);
      if (!discs.has(discKey)) discs.set(discKey, { grafias: new Map(), alunos: new Map() });
      const d = discs.get(discKey);
      const grafia = disciplina?.trim() || SEM_DISCIPLINA;
      d.grafias.set(grafia, (d.grafias.get(grafia) || 0) + 1);
      return d;
    };

    for (const reg of registros) {
      if (!reg.nomes.length) continue;
      let curso = reg.curso || cursoDaDisciplina.get(normalizar(reg.disciplina));
      if (!curso || curso === "conflito") curso = SEM_CURSO.id;
      const d = disciplinaEm(curso, reg.disciplina);
      for (const nome of reg.nomes) {
        const k = normalizar(nome);
        if (!d.alunos.has(k)) {
          const chave = chaveDe(curso, reg.disciplina || SEM_DISCIPLINA, nome);
          d.alunos.set(k, { chave, nome, projetos: [], extra: false, removido: !!estado.removidos[chave], curso, disciplina: reg.disciplina || "" });
        }
        const aluno = d.alunos.get(k);
        if (reg.projeto && !aluno.projetos.includes(reg.projeto)) aluno.projetos.push(reg.projeto);
      }
    }

    for (const [id, e] of Object.entries(estado.extras || {})) {
      if (!e?.nome) continue;
      const curso = cursos.some((c) => c.id === e.curso) ? e.curso : SEM_CURSO.id;
      const d = disciplinaEm(curso, e.disciplina);
      d.alunos.set(`x:${id}`, { chave: id, nome: e.nome, projetos: e.projeto ? [e.projeto] : [], extra: true, editado: !!e.editado, removido: false, curso, disciplina: e.disciplina || "" });
    }

    grupos = [...cursos, SEM_CURSO]
      .filter((c) => arvore.has(c.id))
      .map((c) => ({
        curso: c,
        disciplinas: [...arvore.get(c.id).values()]
          .map((d) => ({
            // A grafia mais usada dá nome à disciplina.
            nome: [...d.grafias.entries()].sort((a, b) => b[1] - a[1])[0][0],
            alunos: [...d.alunos.values()].filter((a) => mostrarRetirados || !a.removido).sort((a, b) => porNome(a.nome, b.nome)),
          }))
          .filter((d) => d.alunos.length)
          .sort((a, b) => porNome(a.nome, b.nome)),
      }))
      .filter((g) => g.disciplinas.length);
  }

  /* Busca: por aluno, projeto ou disciplina. */
  function filtrar(lista, termo) {
    const t = normalizar(termo);
    if (!t) return lista;
    return lista
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

  const ativos = (alunos) => alunos.filter((a) => !a.removido);
  const presente = (a) => !a.removido && !!estado.presenca[a.chave];
  const todosAlunos = () => grupos.flatMap((g) => g.disciplinas.flatMap((d) => d.alunos));

  function render() {
    const termo = $("freq-busca").value;
    const lista = filtrar(grupos, termo);
    const alunos = ativos(todosAlunos());
    const nDisc = grupos.reduce((s, g) => s + g.disciplinas.length, 0);
    const encontrados = ativos(lista.flatMap((g) => g.disciplinas.flatMap((d) => d.alunos))).length;
    $("freq-resumo").textContent = alunos.length
      ? `${plural(alunos.length, "aluno", "alunos")} em ${plural(nDisc, "disciplina", "disciplinas")} · ${alunos.filter(presente).length} presentes` +
        (termo.trim() ? ` · ${plural(encontrados, "encontrado", "encontrados")}` : "")
      : "";
    $("freq-pdf").disabled = !alunos.length;
    $("freq-aviso").hidden = !soNesteNavegador;

    if (!grupos.length) {
      $("freq-lista").innerHTML = `<p class="lista-vazia">Nenhum aluno encontrado nas inscrições nem nos projetos cadastrados. Use “+ Acrescentar aluno” para incluir alguém.</p>`;
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
            .map((d) => {
              const ativosD = ativos(d.alunos);
              const dados = `data-curso="${esc(g.curso.id)}" data-disciplina="${esc(d.nome)}"`;
              return `
            <div class="freq-disciplina">
              <div class="freq-disciplina-topo">
                <h3>${esc(d.nome)} <small>${ativosD.filter(presente).length} de ${plural(ativosD.length, "aluno presente", "alunos presentes")}</small></h3>
                <div class="freq-disciplina-acoes">
                  <button class="btn btn-vidro" type="button" data-acao="acrescentar" ${dados}>+ Aluno</button>
                  <button class="btn btn-vidro" type="button" data-acao="pdf" ${dados}>PDF</button>
                </div>
              </div>
              <table class="freq-tabela">
                <thead><tr><th>Presente</th><th>Aluno</th><th class="col-projeto">Projeto</th><th><span class="sr-only">Ações</span></th></tr></thead>
                <tbody>
                  ${d.alunos
                    .map(
                      (a) => `
                  <tr class="${a.removido ? "retirado" : ""}">
                    <td><input type="checkbox" class="freq-check" data-chave="${esc(a.chave)}" ${presente(a) ? "checked" : ""} ${a.removido ? "disabled" : ""} aria-label="Presença de ${esc(a.nome)}"></td>
                    <td>${esc(a.nome)}${a.extra ? ` <small class="freq-tag">${a.editado ? "editado" : "acrescentado"}</small>` : ""}${a.removido ? ` <small class="freq-tag">retirado</small>` : ""}</td>
                    <td class="col-projeto">${esc(a.projetos.join(" · ")) || "–"}</td>
                    <td class="freq-linha-acoes">
                      ${
                        a.removido
                          ? `<button type="button" class="botao-texto" data-acao="restaurar" data-chave="${esc(a.chave)}">Restaurar</button>`
                          : `<button type="button" class="botao-texto" data-acao="editar" data-chave="${esc(a.chave)}">Editar</button>
                             <button type="button" class="botao-texto" data-acao="retirar" data-chave="${esc(a.chave)}">Retirar</button>`
                      }
                    </td>
                  </tr>`
                    )
                    .join("")}
                </tbody>
              </table>
            </div>`;
            })
            .join("")}
        </section>`
      )
      .join("");
  }

  const atualizarTela = () => {
    montar();
    render();
  };

  function situacao(texto, classe = "") {
    $("freq-situacao").className = `urna-situacao ${classe}`;
    $("freq-situacao").textContent = texto;
  }

  /* Estado salvo: Firebase, com uma cópia neste navegador. */
  function lerLocal() {
    try {
      return JSON.parse(localStorage.getItem(CHAVE_LOCAL)) || {};
    } catch {
      return {};
    }
  }
  function guardarLocal() {
    try {
      localStorage.setItem(CHAVE_LOCAL, JSON.stringify(estado));
    } catch {
      // sem armazenamento, vale o Firebase
    }
  }
  const completar = (e) => ({ presenca: e?.presenca || {}, extras: e?.extras || {}, removidos: e?.removidos || {} });

  // Aplica as mudanças na tela na hora e grava no Firebase. Se falhar, desfaz.
  async function gravar(mudancas, mensagem) {
    const antes = JSON.stringify(estado);
    for (const [caminho, valor] of Object.entries(mudancas)) {
      const [parte, chave] = caminho.split("/");
      if (valor == null) delete estado[parte][chave];
      else estado[parte][chave] = valor;
    }
    atualizarTela();
    try {
      await API.salvarFrequencia(mudancas);
      guardarLocal();
      if (mensagem) situacao(mensagem, "ok");
      return true;
    } catch (erro) {
      console.error(erro);
      estado = JSON.parse(antes);
      atualizarTela();
      situacao(`Não salvou: ${erro.message}`, "alerta");
      return false;
    }
  }

  async function carregar() {
    $("freq-lista").innerHTML = `<p class="lista-vazia">Carregando os alunos…</p>`;
    situacao("");
    try {
      const [lidas, cadastro, salvo] = await Promise.all([
        API.lerInscricoes("alunos"),
        API.lerCadastro(),
        API.lerFrequencia().catch((erro) => {
          if (erro.status !== 401) throw erro;
          return null; // regras antigas: usa a cópia deste navegador
        }),
      ]);
      inscricoes = lidas;
      projetos = cadastro;
      soNesteNavegador = salvo === null;
      estado = completar(salvo ?? lerLocal());
      if (!soNesteNavegador) guardarLocal();
      carregado = true;
      atualizarTela();
    } catch (erro) {
      console.error(erro);
      $("freq-lista").innerHTML = "";
      situacao(`Não consegui ler os alunos. ${erro.message}`, "alerta");
    }
  }

  const acharAluno = (chave) => todosAlunos().find((a) => a.chave === chave);

  /* Diálogo de acrescentar / editar */
  function abrirDialogo(aluno, curso, disciplina) {
    editando = aluno || null;
    $("freq-dialogo-titulo").textContent = aluno ? "Editar aluno" : "Acrescentar aluno";
    $("freq-nomes-rotulo").textContent = aluno ? "Nome do aluno" : "Nome do aluno (para vários, um por linha)";
    $("freq-nomes").value = aluno?.nome || "";
    $("freq-nomes").rows = aluno ? 1 : 4;
    $("freq-curso").value = aluno ? (aluno.curso === SEM_CURSO.id ? "" : aluno.curso) : curso && curso !== SEM_CURSO.id ? curso : "";
    $("freq-disciplina").value = aluno?.disciplina || disciplina || "";
    $("freq-projeto").value = aluno?.projetos.join(" · ") || "";
    $("freq-disciplinas").innerHTML = [...new Set(grupos.flatMap((g) => g.disciplinas.map((d) => d.nome)))]
      .sort(porNome)
      .map((d) => `<option value="${esc(d)}"></option>`)
      .join("");
    $("freq-dialogo-erro").textContent = "";
    $("freq-dialogo").showModal();
    $("freq-nomes").focus();
  }

  async function salvarDialogo(e) {
    e.preventDefault();
    const curso = $("freq-curso").value;
    const disciplina = $("freq-disciplina").value.trim().replace(/\s+/g, " ");
    const projeto = $("freq-projeto").value.trim().replace(/\s+/g, " ");
    const nomes = editando
      ? [arrumarNome($("freq-nomes").value.trim().replace(/\s+/g, " "))].filter(Boolean)
      : separarNomes($("freq-nomes").value);
    const erro = (t) => ($("freq-dialogo-erro").textContent = t);
    if (!nomes.length) return erro("Escreva o nome do aluno.");
    if (!curso) return erro("Escolha o curso.");
    if (!disciplina) return erro("Escreva a disciplina.");

    // Quem já está nessa disciplina não entra de novo.
    const mesmaDisciplina = ativos(todosAlunos()).filter(
      (a) => a.curso === curso && normalizar(a.disciplina || SEM_DISCIPLINA) === normalizar(disciplina) && a !== editando
    );
    const repetidos = nomes.filter((n) => mesmaDisciplina.some((a) => normalizar(a.nome) === normalizar(n)));
    const novos = nomes.filter((n) => !repetidos.includes(n));
    if (!novos.length) return erro(`${repetidos.join(", ")} já ${repetidos.length === 1 ? "está" : "estão"} nessa disciplina.`);

    const dados = (nome) => ({ nome, curso, disciplina, projeto, criadoEm: Date.now() });
    const mudancas = {};
    let mensagem;
    if (editando?.extra) {
      mudancas[`extras/${editando.chave}`] = { ...estado.extras[editando.chave], ...dados(novos[0]) };
      mensagem = `${novos[0]}: dados atualizados.`;
    } else if (editando) {
      // Aluno das inscrições: a versão original sai e entra a corrigida, levando a presença.
      const id = novoId();
      mudancas[`removidos/${editando.chave}`] = true;
      mudancas[`extras/${id}`] = { ...dados(novos[0]), editado: true };
      if (estado.presenca[editando.chave]) {
        mudancas[`presenca/${editando.chave}`] = null;
        mudancas[`presenca/${id}`] = true;
      }
      mensagem = `${novos[0]}: dados atualizados.`;
    } else {
      for (const nome of novos) mudancas[`extras/${novoId()}`] = dados(nome);
      mensagem = `${plural(novos.length, "aluno acrescentado", "alunos acrescentados")} em ${disciplina}.`;
    }
    if (repetidos.length) mensagem += ` Já estavam na lista: ${repetidos.join(", ")}.`;
    $("freq-dialogo").close();
    await gravar(mudancas, mensagem);
  }

  /* PDF: cada disciplina começa numa página, com presença e espaço para assinatura. */
  async function baixarPdf(lista, nomeArquivo, subtitulo) {
    const p = await PDF.criar({
      rotulo: "PET ELÉTRICA UFPB  ·  FREQUÊNCIA",
      titulo: "Lista de frequência",
      subtitulo,
      cabecalho: "Lista de frequência",
    });
    let primeira = true;
    for (const g of lista) {
      const disciplinas = g.disciplinas.map((d) => ({ ...d, alunos: ativos(d.alunos) })).filter((d) => d.alunos.length);
      for (const [i, d] of disciplinas.entries()) {
        if (!primeira) p.novaPagina();
        primeira = false;
        if (i === 0) {
          const n = disciplinas.reduce((s, x) => s + x.alunos.length, 0);
          p.tituloSecao(g.curso.nome, `${plural(n, "aluno", "alunos")} em ${plural(disciplinas.length, "disciplina", "disciplinas")}`);
        }
        p.subtitulo(`${d.nome}  (${d.alunos.filter(presente).length} de ${plural(d.alunos.length, "aluno presente", "alunos presentes")})`);
        p.tabela({
          head: [["Nº", "Aluno", "Projeto", "Presença", "Assinatura"]],
          body: d.alunos.map((a, n) => [n + 1, a.nome, a.projetos.join(" · ") || "–", presente(a) ? "Presente" : "", ""]),
          styles: { minCellHeight: 9 },
          columnStyles: { 0: { cellWidth: 10, halign: "center" }, 1: { cellWidth: 56 }, 2: { cellWidth: 44 }, 3: { cellWidth: 20, halign: "center" }, 4: { cellWidth: "auto" } },
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
  $("freq-retirados").addEventListener("change", () => carregado && atualizarTela());
  $("freq-atualizar").addEventListener("click", carregar);
  $("freq-acrescentar").addEventListener("click", () => abrirDialogo(null));
  $("freq-form").addEventListener("submit", salvarDialogo);
  $("freq-cancelar").addEventListener("click", () => $("freq-dialogo").close());

  // O PDF geral segue a busca: com algo digitado, sai só o que está na tela.
  $("freq-pdf").addEventListener("click", () => {
    const termo = $("freq-busca").value.trim();
    const lista = filtrar(grupos, termo);
    if (!lista.length) return situacao("Nada para baixar com essa busca.", "alerta");
    gerar($("freq-pdf"), lista, termo ? `frequencia-busca-${nomeArquivo(termo)}` : "frequencia", termo ? `Busca: ${termo}` : "Alunos por disciplina");
  });

  $("freq-lista").addEventListener("change", (e) => {
    const caixa = e.target.closest(".freq-check");
    if (!caixa) return;
    const a = acharAluno(caixa.dataset.chave);
    if (!a) return;
    gravar({ [`presenca/${a.chave}`]: caixa.checked ? true : null }, `${a.nome}: ${caixa.checked ? "presença marcada" : "presença desmarcada"}.`);
  });

  $("freq-lista").addEventListener("click", (e) => {
    const botao = e.target.closest("[data-acao]");
    if (!botao) return;
    const { acao } = botao.dataset;
    if (acao === "acrescentar") return abrirDialogo(null, botao.dataset.curso, botao.dataset.disciplina);
    if (acao === "pdf") {
      // A lista da disciplina sai inteira, mesmo com uma busca por aluno na tela.
      const g = grupos.find((x) => x.curso.id === botao.dataset.curso);
      const d = g?.disciplinas.find((x) => x.nome === botao.dataset.disciplina);
      if (d) gerar(botao, [{ ...g, disciplinas: [d] }], `frequencia-${nomeArquivo(d.nome)}`, d.nome);
      return;
    }
    const a = acharAluno(botao.dataset.chave);
    if (!a) return;
    if (acao === "editar") return abrirDialogo(a);
    if (acao === "restaurar") return gravar({ [`removidos/${a.chave}`]: null }, `${a.nome} voltou para a lista.`);
    if (acao === "retirar") {
      if (!confirm(`Retirar ${a.nome} de ${a.disciplina || SEM_DISCIPLINA}?`)) return;
      const mudancas = a.extra
        ? { [`extras/${a.chave}`]: null, [`presenca/${a.chave}`]: null }
        : { [`removidos/${a.chave}`]: true, [`presenca/${a.chave}`]: null };
      gravar(mudancas, `${a.nome} saiu da lista.${a.extra ? "" : " Para trazer de volta, marque “Mostrar retirados”."}`);
    }
  });

  $("freq-curso").innerHTML =
    `<option value="">Selecione o curso</option>` + cursos.map((c) => `<option value="${c.id}">${esc(c.nome)}</option>`).join("");

  // Relê a cada visita, para incluir inscrições e projetos novos.
  document.querySelector('.painel-topo [data-aba="frequencia"]').addEventListener("click", carregar);
})();
