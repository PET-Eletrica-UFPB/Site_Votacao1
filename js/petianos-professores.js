// Aba "Professores e notas" da Área dos Petianos. Usa $, esc e projetos de petianos.js.
window.PainelProfessores = (() => {
  const SEM_DISCIPLINA = "Sem disciplina";
  const disciplinaDe = (p) => (p.disciplina || "").trim() || SEM_DISCIPLINA;
  const fmtNota = (n) => (Math.round(n * 100) / 100).toFixed(2).replace(/0$/, "").replace(".", ",");

  let iniciado = false;
  let professores = [];
  let codigos = {};
  let avaliacoes = {};
  let editandoUid = null;
  let selecionados = new Set();
  let alterado = false;

  /* Abas */
  const botoesAba = () => document.querySelectorAll(".painel-topo .aba[data-aba]");

  function mostrarAba(nome) {
    botoesAba().forEach((b) => {
      b.setAttribute("aria-pressed", b.dataset.aba === nome);
      $(`aba-${b.dataset.aba}`).hidden = b.dataset.aba !== nome;
    });
  }

  document.querySelector(".painel-topo .abas").addEventListener("click", (e) => {
    const botao = e.target.closest(".aba[data-aba]");
    if (botao) mostrarAba(botao.dataset.aba);
  });

  /* Dados */
  async function carregar() {
    try {
      [professores, codigos, avaliacoes] = await Promise.all([
        API.listarProfessores(),
        API.codigosDosProfessores(),
        API.lerAvaliacoes(),
      ]);
      $("aviso-prof").hidden = true;
    } catch (erro) {
      console.error(erro);
      $("aviso-prof").textContent = `Não consegui ler os professores e as notas. ${erro.message}`;
      $("aviso-prof").hidden = false;
    }
    if (editandoUid && !professores.some((p) => p.uid === editandoUid)) novoProfessor();
    renderListaProf();
    renderRelatorio();
    renderAtribuir();
  }

  const existentes = () => new Set(projetos.map((p) => p.codigo));
  const notaDe = (uid, codigo) => avaliacoes[uid]?.[codigo];

  function contagem(prof) {
    const validos = prof.projetos.filter((c) => existentes().has(c));
    return { total: validos.length, feitos: validos.filter((c) => notaDe(prof.uid, c)).length };
  }

  /* Lateral */
  function renderListaProf() {
    const n = professores.length;
    $("total-professores").textContent = n;
    $("total-prof-txt").textContent = n === 1 ? "professor cadastrado" : "professores cadastrados";

    $("lista-prof").innerHTML = n
      ? professores
          .map((p) => {
            const { total, feitos } = contagem(p);
            const completo = total && feitos === total;
            return `
              <li>
                <button class="item-projeto" data-uid="${esc(p.uid)}" aria-current="${p.uid === editandoUid}">
                  <span class="item-stand ${completo ? "ok" : ""}">${feitos}/${total}</span>
                  <span>
                    <span class="item-nome">${esc(p.nome)}${p.curso ? ` <span class="prof-tag ${esc(p.curso)}">${p.curso === "eletrica" ? "Elétrica" : "Renováveis"}</span>` : ""}</span>
                    <span class="item-sub">${total ? `${total} projeto${total > 1 ? "s" : ""} · ${completo ? "tudo avaliado" : `${total - feitos} pendente${total - feitos > 1 ? "s" : ""}`}` : "Nenhum projeto atribuído"}</span>
                    ${total ? `<span class="item-sub item-disciplinas">${disciplinasDoProfessor(p).map(esc).join(" · ")}</span>` : ""}
                  </span>
                </button>
              </li>`;
          })
          .join("")
      : `<li class="lista-vazia">Nenhum professor cadastrado ainda.</li>`;
  }

  function renderRelatorio() {
    let total = 0;
    let feitos = 0;
    for (const p of professores) {
      const c = contagem(p);
      total += c.total;
      feitos += c.feitos;
    }
    $("aval-feitas").textContent = `${feitos}/${total}`;
    $("aval-txt").textContent = total && feitos === total ? "todas feitas" : "avaliações feitas";
    $("aval-barra").style.width = `${(feitos / (total || 1)) * 100}%`;
  }

  /* Formulário */
  function preencher(prof) {
    $("prof-nome").value = prof?.nome ?? "";
    $("prof-codigo").value = prof ? codigos[prof.uid] ?? "" : "";
    document.querySelectorAll('[name="prof-curso"]').forEach((r) => (r.checked = r.value === (prof?.curso || "")));
    selecionados = new Set(prof?.projetos ?? []);
    $("prof-titulo").textContent = prof ? prof.nome : "Novo professor";
    $("salvar-prof").textContent = prof ? "Salvar alterações" : "Cadastrar professor";
    $("excluir-prof").hidden = !prof;
    $("atribuir-busca").value = "";
    alterado = false;
    renderAtribuir();
    renderListaProf();
  }

  function novoProfessor() {
    editandoUid = null;
    preencher(null);
  }

  function podeDescartar() {
    return !alterado || confirm("Você tem alterações não salvas neste professor. Descartar?");
  }

  function aviso(texto, erro = false) {
    $("feedback-prof").textContent = texto;
    $("feedback-prof").classList.toggle("erro", erro);
  }

  // Quem mais avalia cada projeto, sem contar o professor que está aberto: { "5A": ["Prof. X", ...] }
  function avaliadoresPorProjeto() {
    const quem = {};
    for (const p of professores) {
      if (p.uid === editandoUid) continue;
      for (const c of p.projetos) (quem[c] ||= []).push(p.nome);
    }
    return quem;
  }

  // Disciplinas de um professor, pelos projetos atribuídos a ele.
  function disciplinasDoProfessor(prof) {
    const nomes = new Set(projetos.filter((p) => prof.projetos.includes(p.codigo)).map(disciplinaDe));
    return [...nomes].sort((a, b) => a.localeCompare(b, "pt-BR"));
  }

  // Projetos marcados que outro professor já avalia, agrupados por disciplina.
  function sobreposicoes() {
    const outros = avaliadoresPorProjeto();
    const porDisciplina = new Map();
    for (const p of projetos) {
      if (!selecionados.has(p.codigo) || !outros[p.codigo]) continue;
      const d = disciplinaDe(p);
      if (!porDisciplina.has(d)) porDisciplina.set(d, { projetos: 0, nomes: new Set() });
      porDisciplina.get(d).projetos++;
      outros[p.codigo].forEach((n) => porDisciplina.get(d).nomes.add(n));
    }
    return porDisciplina;
  }

  function renderAtribuir() {
    const busca = $("atribuir-busca").value.trim().toLowerCase();
    const outros = avaliadoresPorProjeto();
    const grupos = new Map();
    for (const p of projetos) {
      const d = disciplinaDe(p);
      if (busca && ![p.nome, d, p.codigo].some((t) => t.toLowerCase().includes(busca))) continue;
      if (!grupos.has(d)) grupos.set(d, []);
      grupos.get(d).push(p);
    }

    const validos = [...selecionados].filter((c) => existentes().has(c)).length;
    $("atribuir-total").textContent = `${validos} selecionado${validos === 1 ? "" : "s"}`;

    if (!projetos.length) {
      $("atribuir-lista").innerHTML = `<p class="lista-vazia">Cadastre os projetos na aba Projetos primeiro.</p>`;
      return;
    }
    if (!grupos.size) {
      $("atribuir-lista").innerHTML = `<p class="lista-vazia">Nenhum projeto encontrado.</p>`;
      return;
    }

    const esconderCobertas = $("esconder-cobertas").checked;
    const htmlGrupos = [...grupos.entries()]
      .sort(([a], [b]) => a.localeCompare(b, "pt-BR"))
      .map(([disciplina, lista]) => {
        const marcados = lista.filter((p) => selecionados.has(p.codigo)).length;
        // Quem já avalia esta disciplina e em quantos dos projetos dela.
        const porProfessor = new Map();
        for (const p of lista) for (const nome of outros[p.codigo] || []) porProfessor.set(nome, (porProfessor.get(nome) || 0) + 1);
        const cobertos = lista.filter((p) => outros[p.codigo]).length;
        const situacao = !cobertos ? "livre" : cobertos === lista.length ? "coberta" : "parcial";
        if (esconderCobertas && situacao === "coberta" && !marcados) return "";
        const rotulo = { livre: "Livre", parcial: `${cobertos}/${lista.length} com avaliador`, coberta: "Já tem avaliador" }[situacao];
        return `
          <fieldset class="grupo-atribuir ${situacao}">
            <legend>
              <label class="marcar-grupo">
                <input type="checkbox" data-grupo="${esc(disciplina)}" ${marcados === lista.length ? "checked" : ""} data-parcial="${marcados > 0 && marcados < lista.length}">
                <span>${esc(disciplina)}</span>
              </label>
              <small>${marcados}/${lista.length}</small>
              <span class="situacao-disciplina ${situacao}">${rotulo}</span>
            </legend>
            ${
              porProfessor.size
                ? `<p class="ja-avaliam">Já avaliam esta disciplina: ${[...porProfessor.entries()]
                    .map(([nome, n]) => `<b>${esc(nome)}</b> (${n}/${lista.length})`)
                    .join(", ")}</p>`
                : ""
            }
            ${lista
              .map((p) => {
                const nota = editandoUid && notaDe(editandoUid, p.codigo);
                const quem = outros[p.codigo] || [];
                return `
                  <label class="item-atribuir ${quem.length ? "tem-outro" : ""}">
                    <input type="checkbox" value="${esc(p.codigo)}" ${selecionados.has(p.codigo) ? "checked" : ""}>
                    <span class="item-stand">${esc(p.codigo)}</span>
                    <span class="item-atribuir-nome">${esc(p.nome)}<small>${quem.length ? `Já avaliado por ${quem.map(esc).join(", ")}` : "Nenhum outro avaliador"}</small></span>
                    ${nota ? `<span class="item-nota">${fmtNota(nota.media)}</span>` : selecionados.has(p.codigo) && editandoUid ? `<span class="item-nota pendente">Pendente</span>` : ""}
                  </label>`;
              })
              .join("")}
          </fieldset>`;
      })
      .join("");
    $("atribuir-lista").innerHTML = htmlGrupos || `<p class="lista-vazia">Todas as disciplinas já têm avaliador. Desmarque “Esconder” para ver todas.</p>`;

    document.querySelectorAll('[data-parcial="true"]').forEach((c) => {
      c.indeterminate = true;
    });
  }

  /* Eventos */
  $("novo-prof").addEventListener("click", () => {
    if (!podeDescartar()) return;
    novoProfessor();
    aviso("");
    $("prof-nome").focus();
  });

  $("lista-prof").addEventListener("click", (e) => {
    const item = e.target.closest("[data-uid]");
    if (!item || !podeDescartar()) return;
    editandoUid = item.dataset.uid;
    preencher(professores.find((p) => p.uid === editandoUid));
    aviso("");
    if (matchMedia("(max-width: 1040px)").matches) $("ficha-prof").scrollIntoView();
  });

  $("form-prof").addEventListener("input", (e) => {
    if (e.target.id === "atribuir-busca" || e.target.id === "esconder-cobertas") return renderAtribuir();
    alterado = true;
    aviso("");
  });

  $("atribuir-lista").addEventListener("change", (e) => {
    const caixa = e.target;
    if (caixa.dataset.grupo !== undefined) {
      const dentro = caixa.closest("fieldset").querySelectorAll("input[value]");
      dentro.forEach((c) => (caixa.checked ? selecionados.add(c.value) : selecionados.delete(c.value)));
    } else if (caixa.value) {
      caixa.checked ? selecionados.add(caixa.value) : selecionados.delete(caixa.value);
    }
    alterado = true;
    renderAtribuir();
  });

  $("gerar-codigo").addEventListener("click", () => {
    const numeros = crypto.getRandomValues(new Uint32Array(1))[0] % 1000000;
    $("prof-codigo").value = String(numeros).padStart(6, "0");
    $("prof-codigo").type = "password";
    $("prof-codigo").closest(".senha-caixa")?.querySelector(".senha-ver")?.click(); // mostra o código gerado
    alterado = true;
    aviso("");
  });

  $("form-prof").addEventListener("submit", async (e) => {
    e.preventDefault();
    const nome = $("prof-nome").value.trim().replace(/\s+/g, " ");
    const codigo = $("prof-codigo").value.trim();
    $("prof-nome").value = nome;
    if (!nome) return aviso("Preencha o nome do professor.", true);
    if (codigo.length < 6) return aviso("O código de acesso precisa ter pelo menos 6 caracteres.", true);
    const repetido = professores.find((p) => p.uid !== editandoUid && p.nome.toLowerCase() === nome.toLowerCase());
    if (repetido) return aviso("Já existe um professor com esse nome. Use um nome diferente para não confundir na hora do login.", true);

    // Avisa antes de pôr dois professores na mesma disciplina.
    const repetidas = sobreposicoes();
    if (repetidas.size) {
      const lista = [...repetidas.entries()]
        .map(([d, { projetos: n, nomes }]) => `• ${d} (${n} projeto${n > 1 ? "s" : ""}): já com ${[...nomes].join(", ")}`)
        .join("\n");
      if (!confirm(`Alguns projetos marcados já têm outro avaliador:\n\n${lista}\n\nSalvar mesmo assim?`)) return;
    }

    const curso = document.querySelector('[name="prof-curso"]:checked')?.value || "";
    if (!curso) return aviso("Escolha se é professor de Elétrica ou de Renováveis.", true);
    const dados = { nome, codigo, curso, projetos: [...selecionados].filter((c) => existentes().has(c)) };
    const eraNovo = !editandoUid;
    $("salvar-prof").disabled = true;
    aviso("Salvando…");
    try {
      if (eraNovo) editandoUid = await API.cadastrarProfessor(dados);
      else await API.atualizarProfessor(editandoUid, dados);
      alterado = false;
      await carregar();
      const projetosTxt = `${dados.projetos.length} projeto${dados.projetos.length === 1 ? "" : "s"}`;
      if (eraNovo) {
        // Cadastro feito: a ficha volta vazia, pronta para o próximo professor.
        novoProfessor();
        aviso(`${nome} cadastrado com ${projetosTxt}. Código de acesso: ${codigo} (entregue a ele; também fica na ficha dele, na lista). Pronto para o próximo cadastro.`);
        $("prof-nome").focus();
      } else {
        preencher(professores.find((p) => p.uid === editandoUid));
        aviso(`${nome} atualizado com ${projetosTxt}.`);
      }
    } catch (erro) {
      if (eraNovo) editandoUid = null;
      aviso(erro.message, true);
    } finally {
      $("salvar-prof").disabled = false;
    }
  });

  $("excluir-prof").addEventListener("click", () => {
    $("confirmar-prof-nome").textContent = professores.find((p) => p.uid === editandoUid)?.nome || "";
    $("confirmar-prof").showModal();
  });

  $("confirmar-prof-nao").addEventListener("click", () => $("confirmar-prof").close());

  $("confirmar-prof-sim").addEventListener("click", async () => {
    const nome = $("confirmar-prof-nome").textContent;
    $("confirmar-prof").close();
    aviso("Excluindo…");
    try {
      await API.removerProfessor(editandoUid);
      alterado = false;
      novoProfessor();
      await carregar();
      aviso(`${nome} foi excluído.`);
    } catch (erro) {
      aviso(erro.message, true);
    }
  });

  $("baixar-pdf").addEventListener("click", async () => {
    const botao = $("baixar-pdf");
    botao.disabled = true;
    $("pdf-situacao").className = "urna-situacao";
    $("pdf-situacao").textContent = "Gerando o PDF…";
    try {
      // Relê tudo para o PDF sair com as últimas notas.
      const [lista, profs, notas] = await Promise.all([API.lerCadastro(), API.listarProfessores(), API.lerAvaliacoes()]);
      await Relatorio.baixar({ projetos: lista, professores: profs, avaliacoes: notas });
      $("pdf-situacao").className = "urna-situacao ok";
      $("pdf-situacao").textContent = "PDF baixado.";
    } catch (erro) {
      console.error(erro);
      $("pdf-situacao").className = "urna-situacao alerta";
      $("pdf-situacao").textContent = `Não consegui gerar o PDF. ${erro.message}`;
    } finally {
      botao.disabled = false;
    }
  });

  return {
    iniciar() {
      if (iniciado) return;
      iniciado = true;
      novoProfessor();
      carregar();
    },
    projetosMudaram() {
      if (iniciado) carregar();
    },
    podeDescartar,
    disciplinaDe,
    // Para a distribuição automática (petianos-distribuir.js).
    estado: () => ({ professores, codigos, avaliacoes }),
    async recarregar() {
      await carregar();
      if (editandoUid) preencher(professores.find((p) => p.uid === editandoUid));
    },
  };
})();
