// "Distribuir disciplinas" (aba Professores e notas): os petianos marcam os professores
// cadastrados e digitam os novos; o site divide as disciplinas entre eles, equilibrando
// o número de projetos, e cada escolha pode ser trocada à mão antes de salvar.
// Usa $, esc e projetos de petianos.js e o estado de PainelProfessores.
(() => {
  const LIMITE_NOME = 60;
  const MAX_POR_DISCIPLINA = 5;
  const { disciplinaDe } = PainelProfessores;

  let marcados = new Set(); // uids dos cadastrados que entram na distribuição
  let escolhas = new Map(); // disciplina -> [chave do professor ou ""]
  let salvando = false;

  const chaveNovo = (nome) => `novo:${nome.toLowerCase()}`;
  const plural = (n, um, varios) => `${n} ${n === 1 ? um : varios}`;

  // "ELETRONICA  DIGITAL" e "Eletrônica Digital" são a mesma disciplina.
  const chaveDisciplina = (nome) =>
    nome.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();

  // { nome: [projetos] }, em ordem alfabética. Grafias diferentes da mesma disciplina
  // ficam juntas, com o nome mais usado entre elas.
  function disciplinas() {
    const grupos = new Map();
    for (const p of projetos) {
      const d = disciplinaDe(p);
      const k = chaveDisciplina(d);
      if (!grupos.has(k)) grupos.set(k, { lista: [], grafias: new Map() });
      grupos.get(k).lista.push(p);
      grupos.get(k).grafias.set(d, (grupos.get(k).grafias.get(d) || 0) + 1);
    }
    return new Map(
      [...grupos.values()]
        .map(({ lista, grafias }) => [[...grafias.entries()].sort((a, b) => b[1] - a[1])[0][0], lista])
        .sort(([a], [b]) => a.localeCompare(b, "pt-BR"))
    );
  }

  // Professores que entram na distribuição: { chave, nome, uid }
  function participantes() {
    const { professores } = PainelProfessores.estado();
    const lista = professores.filter((p) => marcados.has(p.uid)).map((p) => ({ chave: p.uid, nome: p.nome, uid: p.uid }));
    const vistos = new Set(professores.map((p) => p.nome.toLowerCase()));
    for (const linha of $("distribuir-novos").value.split("\n")) {
      const nome = linha.trim().replace(/\s+/g, " ").slice(0, LIMITE_NOME);
      if (!nome || vistos.has(nome.toLowerCase())) continue;
      vistos.add(nome.toLowerCase());
      lista.push({ chave: chaveNovo(nome), nome, uid: null });
    }
    return lista;
  }

  // Nomes digitados que já são de um professor cadastrado.
  function repetidosDigitados() {
    const { professores } = PainelProfessores.estado();
    const existentes = new Map(professores.map((p) => [p.nome.toLowerCase(), p.nome]));
    return $("distribuir-novos")
      .value.split("\n")
      .map((l) => l.trim().replace(/\s+/g, " ").toLowerCase())
      .filter((n) => existentes.has(n))
      .map((n) => existentes.get(n));
  }

  const porDisciplina = () =>
    Math.min(MAX_POR_DISCIPLINA, Math.max(1, parseInt($("distribuir-por").value, 10) || 1));

  // Garante que cada disciplina tem uma vaga por professor pedido e que nenhuma vaga
  // aponta para alguém que saiu da lista.
  function ajustarEscolhas() {
    const validas = new Set(participantes().map((p) => p.chave));
    const n = porDisciplina();
    const atual = new Map();
    for (const d of disciplinas().keys()) {
      const vagas = (escolhas.get(d) || []).map((c) => (validas.has(c) ? c : "")).slice(0, n);
      while (vagas.length < n) vagas.push("");
      atual.set(d, vagas);
    }
    escolhas = atual;
  }

  // Ponto de partida: quem já avalia cada disciplina hoje.
  function escolhasAtuais() {
    const { professores } = PainelProfessores.estado();
    const mapa = new Map();
    for (const [d, lista] of disciplinas()) {
      const codigos = new Set(lista.map((p) => p.codigo));
      mapa.set(d, professores.filter((p) => p.projetos.some((c) => codigos.has(c))).map((p) => p.uid));
    }
    return mapa;
  }

  /* Distribuição automática: as disciplinas maiores primeiro, cada uma para quem tem menos projetos. */
  function distribuir() {
    const profs = participantes();
    if (!profs.length) return feedback("Marque ou digite pelo menos um professor.", true);
    const n = Math.min(porDisciplina(), profs.length);
    const sorteio = new Map(profs.map((p) => [p.chave, Math.random()]));
    const carga = new Map(profs.map((p) => [p.chave, { projetos: 0, disciplinas: 0 }]));

    const ordem = [...disciplinas().entries()]
      .map(([d, lista]) => ({ d, total: lista.length, sorteio: Math.random() }))
      .sort((a, b) => b.total - a.total || a.sorteio - b.sorteio);

    escolhas = new Map();
    for (const { d, total } of ordem) {
      const escolhidos = profs
        .map((p) => p.chave)
        .sort((a, b) => carga.get(a).projetos - carga.get(b).projetos || carga.get(a).disciplinas - carga.get(b).disciplinas || sorteio.get(a) - sorteio.get(b))
        .slice(0, n);
      for (const c of escolhidos) {
        carga.get(c).projetos += total;
        carga.get(c).disciplinas++;
      }
      escolhas.set(d, escolhidos);
    }
    ajustarEscolhas();
    render();
    feedback(`Disciplinas distribuídas entre ${plural(profs.length, "professor", "professores")}. Troque o que quiser antes de salvar.`);
  }

  /* Tela */
  function render() {
    const { professores } = PainelProfessores.estado();
    const grupos = disciplinas();
    const profs = participantes();

    $("distribuir-cadastrados").innerHTML = professores.length
      ? professores
          .map(
            (p) => `
          <label class="ep-obrig">
            <input type="checkbox" value="${esc(p.uid)}" ${marcados.has(p.uid) ? "checked" : ""}>
            ${esc(p.nome)}
          </label>`
          )
          .join("")
      : `<p class="lista-vazia">Nenhum professor cadastrado ainda. Digite os nomes abaixo.</p>`;

    // Carga de cada professor com as escolhas da tela.
    const carga = new Map(profs.map((p) => [p.chave, { projetos: 0, disciplinas: 0 }]));
    for (const [d, vagas] of escolhas) {
      for (const c of new Set(vagas)) {
        if (!carga.has(c)) continue;
        carga.get(c).projetos += grupos.get(d).length;
        carga.get(c).disciplinas++;
      }
    }
    $("distribuir-cargas").innerHTML = profs.length
      ? `<p class="campo-titulo">Quanto cada um avalia</p>
         <ul>${profs
           .map((p) => {
             const c = carga.get(p.chave);
             return `<li class="${c.disciplinas ? "" : "vazio"}"><b>${esc(p.nome)}</b>${p.uid ? "" : ` <span class="distribuir-novo">novo</span>`}<small>${c.disciplinas ? `${plural(c.disciplinas, "disciplina", "disciplinas")} · ${plural(c.projetos, "projeto", "projetos")}` : "Sem disciplina"}</small></li>`;
           })
           .join("")}</ul>`
      : "";

    if (!grupos.size) {
      $("distribuir-lista").innerHTML = `<li class="lista-vazia">Cadastre os projetos na aba Projetos primeiro.</li>`;
      return;
    }
    const opcoes = (atual) =>
      `<option value="">Sem professor</option>` +
      profs.map((p) => `<option value="${esc(p.chave)}" ${p.chave === atual ? "selected" : ""}>${esc(p.nome)}</option>`).join("");

    $("distribuir-lista").innerHTML = [...grupos.entries()]
      .map(([d, lista]) => {
        const vagas = escolhas.get(d) || [];
        const vazia = vagas.some((c) => !c);
        const repetida = new Set(vagas.filter(Boolean)).size < vagas.filter(Boolean).length;
        return `
        <li class="distribuir-item ${vazia || repetida ? "alerta" : ""}" data-disciplina="${esc(d)}">
          <span class="distribuir-nome"><b>${esc(d)}</b><small>${plural(lista.length, "projeto", "projetos")}${repetida ? " · o mesmo professor aparece duas vezes" : vazia ? " · falta professor" : ""}</small></span>
          <span class="distribuir-vagas">
            ${vagas.map((c, i) => `<select data-vaga="${i}" aria-label="Professor ${i + 1} de ${esc(d)}">${opcoes(c)}</select>`).join("")}
          </span>
        </li>`;
      })
      .join("");
  }

  function feedback(texto, erro = false) {
    $("distribuir-feedback").textContent = texto;
    $("distribuir-feedback").classList.toggle("erro", erro);
  }

  function abrir() {
    if (!PainelProfessores.podeDescartar()) return;
    const { professores } = PainelProfessores.estado();
    marcados = new Set(professores.map((p) => p.uid));
    escolhas = escolhasAtuais();
    const maior = Math.max(1, ...[...escolhas.values()].map((v) => v.length));
    $("distribuir-por").value = Math.min(MAX_POR_DISCIPLINA, maior);
    $("distribuir-novos").value = "";
    $("distribuir-resultado").hidden = true;
    $("distribuir-resultado").innerHTML = "";
    feedback(projetos.length ? "Esta é a distribuição de agora. Use o botão para distribuir de novo ou troque à mão." : "");
    ajustarEscolhas();
    render();
    $("distribuir").showModal();
  }

  /* Salvar: cada professor da lista fica com os projetos das disciplinas escolhidas para ele. */
  async function salvar() {
    if (salvando) return;
    const { codigos, avaliacoes } = PainelProfessores.estado();
    const profs = participantes();
    if (!profs.length) return feedback("Marque ou digite pelo menos um professor.", true);
    const grupos = disciplinas();

    const projetosDe = new Map(profs.map((p) => [p.chave, new Set()]));
    const semProfessor = [];
    for (const [d, vagas] of escolhas) {
      const escolhidos = vagas.filter(Boolean);
      if (!escolhidos.length) semProfessor.push(d);
      for (const c of escolhidos) grupos.get(d).forEach((p) => projetosDe.get(c)?.add(p.codigo));
    }

    // Avisa antes de tirar de alguém um projeto que ele já avaliou.
    const perdem = [];
    for (const p of profs) {
      if (!p.uid) continue;
      const notas = Object.keys(avaliacoes[p.uid] || {}).filter((c) => !projetosDe.get(p.chave).has(c) && projetos.some((x) => x.codigo === c));
      if (notas.length) perdem.push(`• ${p.nome}: ${notas.join(", ")}`);
    }
    const avisos = [];
    if (semProfessor.length) avisos.push(`Ficam sem professor: ${semProfessor.join(", ")}.`);
    if (perdem.length) avisos.push(`Estes professores deixam de ver projetos que já avaliaram (as notas param de contar):\n${perdem.join("\n")}`);
    const novos = profs.filter((p) => !p.uid);
    const resumo = `Salvar a distribuição para ${plural(profs.length, "professor", "professores")}${novos.length ? `, cadastrando ${plural(novos.length, "novo", "novos")}` : ""}?`;
    if (!confirm([resumo, ...avisos].join("\n\n"))) return;

    salvando = true;
    $("distribuir-salvar").disabled = true;
    $("distribuir-auto").disabled = true;
    const criados = [];
    const falhas = [];
    try {
      for (const p of profs) {
        const lista = [...projetosDe.get(p.chave)];
        feedback(`Salvando ${p.nome}…`);
        try {
          if (p.uid) {
            const atual = PainelProfessores.estado().professores.find((x) => x.uid === p.uid);
            const igual = atual && atual.projetos.length === lista.length && lista.every((c) => atual.projetos.includes(c));
            if (igual) continue;
            if (!codigos[p.uid]) throw new Error("código de acesso não encontrado");
            await API.atualizarProfessor(p.uid, { nome: p.nome, codigo: codigos[p.uid], projetos: lista });
          } else {
            const codigo = String(crypto.getRandomValues(new Uint32Array(1))[0] % 1000000).padStart(6, "0");
            await API.cadastrarProfessor({ nome: p.nome, codigo, projetos: lista });
            criados.push({ nome: p.nome, codigo });
          }
        } catch (erro) {
          falhas.push(`${p.nome}: ${erro.message}`);
        }
      }
      await PainelProfessores.recarregar();
    } finally {
      salvando = false;
      $("distribuir-salvar").disabled = false;
      $("distribuir-auto").disabled = false;
    }

    // Os novos já estão cadastrados: tira-os da caixa e marca como cadastrados.
    const { professores } = PainelProfessores.estado();
    const criadosNomes = new Set(criados.map((c) => c.nome.toLowerCase()));
    $("distribuir-novos").value = $("distribuir-novos")
      .value.split("\n")
      .filter((l) => !criadosNomes.has(l.trim().replace(/\s+/g, " ").toLowerCase()))
      .join("\n")
      .trim();
    professores.filter((p) => criadosNomes.has(p.nome.toLowerCase())).forEach((p) => marcados.add(p.uid));
    escolhas = new Map([...escolhas].map(([d, vagas]) => [d, vagas.map((c) => professores.find((p) => c === chaveNovo(p.nome))?.uid || c)]));
    ajustarEscolhas();
    render();

    $("distribuir-resultado").hidden = !criados.length;
    $("distribuir-resultado").innerHTML = criados.length
      ? `<p class="campo-titulo">Códigos de acesso dos novos professores</p>
         <ul>${criados.map((c) => `<li><span>${esc(c.nome)}</span><code>${esc(c.codigo)}</code></li>`).join("")}</ul>
         <small>Entregue o código a cada professor. Ele também aparece na ficha do professor, na lista ao lado.</small>`
      : "";
    if (falhas.length) feedback(`Não consegui salvar tudo:\n${falhas.join("\n")}`, true);
    else feedback("Distribuição salva.");
  }

  /* Eventos */
  $("abrir-distribuir").addEventListener("click", abrir);
  $("distribuir-cancelar").addEventListener("click", () => $("distribuir").close());
  $("distribuir-auto").addEventListener("click", distribuir);
  $("distribuir-salvar").addEventListener("click", salvar);

  $("distribuir-cadastrados").addEventListener("change", (e) => {
    if (!e.target.value) return;
    e.target.checked ? marcados.add(e.target.value) : marcados.delete(e.target.value);
    ajustarEscolhas();
    render();
  });

  $("distribuir-novos").addEventListener("input", () => {
    ajustarEscolhas();
    render();
    const repetidos = repetidosDigitados();
    if (repetidos.length) feedback(`Já cadastrado${repetidos.length > 1 ? "s" : ""}: ${repetidos.join(", ")}. Marque na lista de cima em vez de digitar.`, true);
    else feedback("");
  });

  $("distribuir-por").addEventListener("input", () => {
    ajustarEscolhas();
    render();
  });

  $("distribuir-lista").addEventListener("change", (e) => {
    if (!e.target.matches("[data-vaga]")) return;
    const d = e.target.closest("[data-disciplina]").dataset.disciplina;
    escolhas.get(d)[Number(e.target.dataset.vaga)] = e.target.value;
    render();
    $("distribuir-lista").querySelector(`[data-disciplina="${CSS.escape(d)}"] [data-vaga="${e.target.dataset.vaga}"]`)?.focus();
  });
})();
