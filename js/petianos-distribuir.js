// "Distribuir disciplinas" (aba Professores e notas): os petianos marcam os professores
// cadastrados e digitam os novos; o site divide as disciplinas entre eles, equilibrando
// o número de projetos, e cada escolha pode ser trocada à mão antes de salvar.
// Usa $, esc e projetos de petianos.js e o estado de PainelProfessores.
(() => {
  const LIMITE_NOME = 60;
  const MAX_POR_DISCIPLINA = 5;
  const { disciplinaDe } = PainelProfessores;

  let marcados = new Set(); // uids dos cadastrados que entram na distribuição
  const cursoNovo = new Map(); // nome (minúsculo) do professor novo → curso escolhido na janela
  let escolhas = new Map(); // disciplina -> [chave do professor ou ""]
  let salvando = false;
  // Depois da lista automática, só as disciplinas repetidas mostram a segunda vaga.
  let vagasExtras = false;

  const chaveNovo = (nome) => `novo:${nome.toLowerCase()}`;
  const tagCurso = (curso) => (curso ? ` <span class="prof-tag ${curso}">${curso === "eletrica" ? "Elétrica" : "Renováveis"}</span>` : "");
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
    const lista = professores.filter((p) => marcados.has(p.uid)).map((p) => ({ chave: p.uid, nome: p.nome, uid: p.uid, curso: p.curso || "" }));
    const vistos = new Set(professores.map((p) => p.nome.toLowerCase()));
    for (const linha of $("distribuir-novos").value.split("\n")) {
      const nome = linha.trim().replace(/\s+/g, " ").slice(0, LIMITE_NOME);
      if (!nome || vistos.has(nome.toLowerCase())) continue;
      vistos.add(nome.toLowerCase());
      lista.push({ chave: chaveNovo(nome), nome, uid: null, curso: cursoNovo.get(nome.toLowerCase()) || "" });
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

  // Curso de uma disciplina: o da maioria dos seus projetos.
  function cursoDaDisciplina(lista) {
    const conta = {};
    for (const p of lista) conta[p.curso] = (conta[p.curso] || 0) + 1;
    return Object.entries(conta).sort((a, b) => b[1] - a[1])[0]?.[0] || "";
  }
  // Disciplina fora do curso do professor (professor sem curso aceita qualquer uma).
  const foraDoCurso = (prof, cursoDisc) => !!prof.curso && !!cursoDisc && prof.curso !== cursoDisc;

  const porDisciplina = () =>
    Math.min(MAX_POR_DISCIPLINA, Math.max(1, parseInt($("distribuir-por").value, 10) || 1));

  // Garante que cada disciplina tem uma vaga por professor pedido e que nenhuma vaga
  // aponta para alguém que saiu da lista.
  function ajustarEscolhas() {
    const validas = new Set(participantes().map((p) => p.chave));
    const n = porDisciplina();
    const atual = new Map();
    for (const d of disciplinas().keys()) {
      const atuais = (escolhas.get(d) || []).map((c) => (validas.has(c) ? c : ""));
      const vagas = atuais.slice(0, vagasExtras ? Math.max(n, atuais.filter(Boolean).length) : n);
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
      .map(([d, lista]) => ({ d, total: lista.length, curso: cursoDaDisciplina(lista), sorteio: Math.random() }))
      .sort((a, b) => b.total - a.total || a.sorteio - b.sorteio);
    const prof = new Map(profs.map((p) => [p.chave, p]));

    escolhas = new Map();
    for (const { d, total, curso } of ordem) {
      // Professores do curso da disciplina primeiro; entre eles, quem tem menos projetos.
      const escolhidos = profs
        .map((p) => p.chave)
        .sort((a, b) => foraDoCurso(prof.get(a), curso) - foraDoCurso(prof.get(b), curso) || carga.get(a).projetos - carga.get(b).projetos || carga.get(a).disciplinas - carga.get(b).disciplinas || sorteio.get(a) - sorteio.get(b))
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

  /* Lista automática com as regras da banca: cada professor avalia 2 disciplinas, nunca duas
     com mais de 12 projetos, com a carga de projetos equilibrada e sem repetir disciplina
     (só repete se houver mais vagas que disciplinas, e aí repete as menores). */
  const POR_PROFESSOR = 2;
  const GRANDE = 12;

  // Custo de uma divisão em pares (o par i é do professor i): regras quebradas pesam muito;
  // depois, disciplina fora do curso do professor; depois, a maior carga e o desequilíbrio.
  function custo(pares, profs, atuais) {
    let c = 0;
    let maior = 0;
    let quadrados = 0;
    pares.forEach((par, i) => {
      if (par.length === 2 && par[0].d === par[1].d) c += 1e9;
      if (par.length === 2 && par[0].total > GRANDE && par[1].total > GRANDE) c += 1e7;
      for (const x of par) {
        if (foraDoCurso(profs[i], x.curso)) c += 1e5;
        if (!(atuais.get(x.d) || []).includes(profs[i].chave)) c += 1; // mexe o mínimo no que já existe
      }
      const soma = par.reduce((s, x) => s + x.total, 0);
      maior = Math.max(maior, soma);
      quadrados += soma * soma;
    });
    return c + maior * 1000 + quadrados;
  }

  // Melhora trocando disciplinas entre pares, ou pares inteiros entre professores, enquanto o custo cair.
  function melhorar(pares, profs, atuais) {
    let atual = custo(pares, profs, atuais);
    const tentar = (trocar) => {
      trocar();
      const novo = custo(pares, profs, atuais);
      if (novo < atual) {
        atual = novo;
        return true;
      }
      trocar();
      return false;
    };
    for (let melhorou = true; melhorou; ) {
      melhorou = false;
      for (let i = 0; i < pares.length; i++) {
        for (let j = i + 1; j < pares.length; j++) {
          if (tentar(() => ([pares[i], pares[j]] = [pares[j], pares[i]]))) melhorou = true;
          for (let a = 0; a < pares[i].length; a++) {
            for (let b = 0; b < pares[j].length; b++) {
              if (tentar(() => ([pares[i][a], pares[j][b]] = [pares[j][b], pares[i][a]]))) melhorou = true;
            }
          }
        }
      }
    }
    return atual;
  }

  function duasPorProfessor() {
    const profs = participantes();
    if (!profs.length) return feedback("Marque ou digite pelo menos um professor.", true);
    const lista = [...disciplinas().entries()].map(([d, l]) => ({ d, total: l.length, curso: cursoDaDisciplina(l) }));
    if (!lista.length) return feedback("Cadastre os projetos na aba Projetos primeiro.", true);

    // Vagas de cada curso (2 por professor). As disciplinas de cada curso vão para as vagas do seu
    // curso; o que não couber vai para professores sem curso e, se ainda faltar, para o outro curso.
    // Vagas que sobram repetem as menores disciplinas do mesmo curso.
    const vagas = { eletrica: 0, renovaveis: 0, "": 0 };
    for (const p of profs) vagas[p.curso in vagas ? p.curso : ""] += POR_PROFESSOR;
    const porTamanho = (l) => [...l].sort((a, b) => b.total - a.total || a.d.localeCompare(b.d, "pt-BR"));
    const doCurso = { eletrica: porTamanho(lista.filter((x) => x.curso === "eletrica")), renovaveis: porTamanho(lista.filter((x) => x.curso !== "eletrica")) };
    const itens = [];
    const sobra = [];
    for (const c of ["eletrica", "renovaveis"]) {
      itens.push(...doCurso[c].slice(0, vagas[c]));
      sobra.push(...doCurso[c].slice(vagas[c]));
      vagas[c] = Math.max(0, vagas[c] - doCurso[c].length);
    }
    const semProfessor = [];
    for (const x of porTamanho(sobra)) {
      const onde = vagas[""] > 0 ? "" : ["eletrica", "renovaveis"].find((c) => vagas[c] > 0);
      if (onde === undefined) semProfessor.push(x.d);
      else {
        itens.push(x);
        vagas[onde]--;
      }
    }
    for (const c of ["eletrica", "renovaveis", ""]) {
      const base = c && doCurso[c].length ? doCurso[c] : porTamanho(lista);
      for (let i = 0; vagas[c] > 0; i++, vagas[c]--) itens.push(base[base.length - 1 - (i % base.length)]);
    }

    // Várias tentativas a partir de pares diferentes; fica a de menor custo (com sorteio entre as empatadas).
    const atuais = escolhasAtuais();
    let melhor = null;
    for (let t = 0; t < 60; t++) {
      const ordem = [...itens].sort((a, b) => b.total - a.total || Math.random() - 0.5);
      // Ponto de partida: a maior com a menor, a segunda maior com a segunda menor...
      const pares = profs.map((_, i) => [ordem[i], ordem[ordem.length - 1 - i]]);
      for (let k = 0; t > 0 && k < 4; k++) {
        const i = Math.floor(Math.random() * pares.length);
        const j = Math.floor(Math.random() * pares.length);
        [pares[i][0], pares[j][1]] = [pares[j][1], pares[i][0]];
      }
      const c = melhorar(pares, profs, atuais) + Math.random() * 0.5;
      if (!melhor || c < melhor.custo) melhor = { custo: c, pares: pares.map((p) => [...p]) };
    }

    escolhas = new Map(lista.map(({ d }) => [d, []]));
    melhor.pares.forEach((par, i) => {
      for (const x of new Set(par)) escolhas.get(x.d).push(profs[i].chave);
    });
    $("distribuir-por").value = 1;
    vagasExtras = true;
    ajustarEscolhas();
    render();

    const avisos = []; // pedem atenção (amarelo)
    const infos = []; // só informam
    const grandes = melhor.pares.filter((p) => p.length === 2 && p[0].total > GRANDE && p[1].total > GRANDE).length;
    if (grandes) avisos.push(`há mais disciplinas grandes (mais de ${GRANDE} projetos) do que professores: ${plural(grandes, "professor ficou", "professores ficaram")} com duas delas`);
    const repetidas = [...escolhas.entries()].filter(([, v]) => v.filter(Boolean).length > 1).map(([d]) => d);
    if (repetidas.length) infos.push(`como há mais vagas que disciplinas, ${repetidas.join(", ")} ${repetidas.length === 1 ? "ficou" : "ficaram"} com mais de um professor avaliador`);
    const trocados = melhor.pares.reduce((s, par, i) => s + par.filter((x) => foraDoCurso(profs[i], x.curso)).length, 0);
    if (trocados) avisos.push(`faltam professores de um dos cursos: ${plural(trocados, "disciplina ficou", "disciplinas ficaram")} com professor do outro curso`);
    if (semProfessor.length) avisos.push(`faltam professores: ${semProfessor.join(", ")} ${semProfessor.length === 1 ? "ficou" : "ficaram"} sem avaliador`);
    feedback(
      `Lista montada: ${plural(profs.length, "professor", "professores")}, ${POR_PROFESSOR} disciplinas para cada.` +
        (infos.length ? ` Obs.: ${infos.join("; ")}.` : "") +
        (avisos.length ? ` Atenção: ${avisos.join("; ")}.` : infos.length ? "" : " Nenhuma disciplina repetida.") +
        " Confira e clique em “Salvar”, ou use de novo para outra combinação.",
      avisos.length > 0
    );
  }

  /* Lista em PDF: quem avalia o quê. */
  async function baixarLista() {
    const grupos = disciplinas();
    const profs = participantes();
    const deCada = new Map(profs.map((p) => [p.chave, []]));
    for (const [d, vagas] of escolhas) for (const c of new Set(vagas.filter(Boolean))) deCada.get(c)?.push(d);
    const linhas = profs.map((p) => {
      const ds = deCada.get(p.chave).sort((a, b) => a.localeCompare(b, "pt-BR"));
      return [p.nome, ds.map((d) => `${d} (${grupos.get(d).length})`).join("\n") || "–", ds.reduce((s, d) => s + grupos.get(d).length, 0)];
    });
    const semNinguem = [...escolhas].filter(([, v]) => !v.some(Boolean)).map(([d]) => d);
    const doc = await PDF.criar({
      rotulo: "PET ELÉTRICA UFPB  ·  BANCA AVALIADORA",
      titulo: "Quem avalia o quê",
      subtitulo: "Disciplinas de cada professor",
      cabecalho: "Banca avaliadora",
    });
    doc.tabela({
      head: [["Professor", "Disciplinas (projetos)", "Projetos"]],
      body: linhas,
      columnStyles: { 0: { cellWidth: 55, fontStyle: "bold" }, 2: { cellWidth: 22, halign: "center" } },
    });
    if (semNinguem.length) doc.paragrafo(`Sem professor: ${semNinguem.join(", ")}.`, 9, PDF.COR.alerta);
    doc.salvar("quem-avalia-o-que");
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
            ${esc(p.nome)}${p.curso ? tagCurso(p.curso) : ` <small class="distribuir-sem-curso">sem curso</small>`}
          </label>`
          )
          .join("")
      : `<p class="lista-vazia">Nenhum professor cadastrado ainda. Digite os nomes abaixo.</p>`;

    // Carga de cada professor com as escolhas da tela.
    const carga = new Map(profs.map((p) => [p.chave, { projetos: 0, disciplinas: 0, nomes: [], grandes: 0 }]));
    for (const [d, vagas] of escolhas) {
      for (const c of new Set(vagas)) {
        if (!carga.has(c)) continue;
        carga.get(c).projetos += grupos.get(d).length;
        carga.get(c).disciplinas++;
        carga.get(c).nomes.push(d);
        if (grupos.get(d).length > GRANDE) carga.get(c).grandes++;
      }
    }
    $("distribuir-cargas").innerHTML = profs.length
      ? `<p class="campo-titulo">Quanto cada um avalia</p>
         <ul>${profs
           .map((p) => {
             const c = carga.get(p.chave);
             const alerta = c.grandes > 1 ? `<small class="distribuir-alerta">duas disciplinas com mais de ${GRANDE} projetos</small>` : "";
             const escolherCurso = p.uid
               ? ""
               : `<select class="distribuir-curso-novo" data-novo="${esc(p.nome.toLowerCase())}" aria-label="Curso de ${esc(p.nome)}">
                    <option value="">Curso?</option>
                    <option value="eletrica" ${p.curso === "eletrica" ? "selected" : ""}>Professor de Elétrica</option>
                    <option value="renovaveis" ${p.curso === "renovaveis" ? "selected" : ""}>Professor de Renováveis</option>
                  </select>`;
             return `<li class="${c.disciplinas ? "" : "vazio"} ${c.grandes > 1 ? "alerta" : ""}"><b>${esc(p.nome)}</b>${p.uid ? tagCurso(p.curso) : ` <span class="distribuir-novo">novo</span>`}${escolherCurso}<small>${c.disciplinas ? `${plural(c.disciplinas, "disciplina", "disciplinas")} · ${plural(c.projetos, "projeto", "projetos")}` : "Sem disciplina"}</small>${c.nomes.length ? `<small class="distribuir-quais">${c.nomes.sort((a, b) => a.localeCompare(b, "pt-BR")).map((d) => `${esc(d)} (${grupos.get(d).length})`).join(" · ")}</small>` : ""}${alerta}</li>`;
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
        const vazia = !vagas.some(Boolean);
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
    if (!PainelProfessores.podeDescartar()) return false;
    const { professores } = PainelProfessores.estado();
    marcados = new Set(professores.map((p) => p.uid));
    escolhas = escolhasAtuais();
    vagasExtras = false;
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
    // Disciplinas com professor do outro curso (contadas a partir das escolhas da janela).
    const profPorChave = new Map(profs.map((p) => [p.chave, p]));
    let trocados = 0;
    for (const [d, vagas] of escolhas) {
      const curso = cursoDaDisciplina(grupos.get(d) || []);
      for (const c of new Set(vagas.filter(Boolean))) if (profPorChave.has(c) && foraDoCurso(profPorChave.get(c), curso)) trocados++;
    }
    if (trocados) avisos.push(`${plural(trocados, "disciplina fica", "disciplinas ficam")} com professor do outro curso.`);
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
            await API.cadastrarProfessor({ nome: p.nome, codigo, projetos: lista, curso: p.curso });
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
  $("distribuir-duas").addEventListener("click", duasPorProfessor);
  $("distribuir-pdf").addEventListener("click", async () => {
    try {
      feedback("Gerando o PDF da lista…");
      await baixarLista();
      feedback("PDF da lista baixado.");
    } catch (erro) {
      console.error(erro);
      feedback(`Não consegui gerar o PDF. ${erro.message}`, true);
    }
  });
  // Botão da aba: abre a janela já com a lista automática de 2 disciplinas por professor.
  $("lista-banca").addEventListener("click", () => {
    if (!$("distribuir").open && abrir() === false) return;
    duasPorProfessor();
  });
  $("distribuir-salvar").addEventListener("click", salvar);

  $("distribuir-cargas").addEventListener("change", (e) => {
    if (!e.target.matches("[data-novo]")) return;
    cursoNovo.set(e.target.dataset.novo, e.target.value);
    render();
  });

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
    vagasExtras = false;
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
