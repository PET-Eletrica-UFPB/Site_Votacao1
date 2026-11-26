// "Planta da feira" (aba Projetos): para cada disciplina, escolhe o local numerado da planta
// (ou automático, ou fora/auditório), mostra a prévia na hora e gera o PDF com Planta.baixar.
// A escolha fica salva em /site/planta. Usa $, esc, cursos e aviso de petianos.js.
(() => {
  const CHAVE_LOCAL = "feira-pet:planta";
  // Estas ficam fora da planta, a não ser que alguém mude.
  const FORA_POR_PADRAO = [/\bintegradora\s+(iii|3)\b/, /\bmanutencao\s+industrial\b/];

  let disciplinas = []; // [{ chave, nome, curso, projetos, local: "auto" | "fora" | 1..9 }]

  const normalizar = (t) => String(t ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
  const chaveDe = (nome) => normalizar(nome).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "sem-disciplina";
  const edicaoPadrao = () => {
    const d = new Date();
    return `${d.getFullYear()}.${d.getMonth() < 6 ? 1 : 2}`;
  };

  // Valor salvo → local. Aceita o formato antigo (pátio, auditório, sala).
  function lerLocal(valor) {
    if (valor === "auto" || valor === "fora") return valor;
    if (valor === "patio") return "auto";
    if (valor === "auditorio" || valor === "sala") return "fora";
    const n = Number(valor);
    const local = Planta.LOCAIS.find((l) => l.id === n);
    if (!local) return null;
    return local.patio ? "auto" : n; // partes do pátio escolhidas antes viram "Pátio"
  }

  function lerNavegador() {
    try {
      return JSON.parse(localStorage.getItem(CHAVE_LOCAL)) || {};
    } catch {
      return {};
    }
  }

  // Agrupa os projetos do cadastro por disciplina e aplica o que já estava salvo.
  function montar(projetos, salvo) {
    const grupos = new Map();
    for (const p of projetos) {
      const nome = (p.disciplina || "").trim() || "Sem disciplina";
      const chave = chaveDe(nome);
      if (!grupos.has(chave)) grupos.set(chave, { chave, grafias: new Map(), cursos: new Map(), projetos: [] });
      const g = grupos.get(chave);
      g.grafias.set(nome, (g.grafias.get(nome) || 0) + 1);
      g.cursos.set(p.curso, (g.cursos.get(p.curso) || 0) + 1);
      g.projetos.push(p);
    }
    const maisComum = (mapa) => [...mapa.entries()].sort((a, b) => b[1] - a[1])[0][0];
    return [...grupos.values()]
      .map((g) => {
        const nome = maisComum(g.grafias);
        const curso = maisComum(g.cursos);
        const padrao = FORA_POR_PADRAO.some((r) => r.test(normalizar(nome))) ? "fora" : Planta.localPadrao(nome);
        const s = salvo.disciplinas?.[g.chave];
        return {
          chave: g.chave,
          nome,
          curso,
          projetos: g.projetos.sort((a, b) => a.numero - b.numero).map((p) => ({ codigo: p.codigo, nome: p.nome })),
          local: lerLocal(s?.local) ?? padrao,
          ordem: Number.isFinite(s?.ordem) ? s.ordem : Planta.ordemPadrao(nome, curso),
        };
      })
      .sort((a, b) => a.ordem - b.ordem || a.nome.localeCompare(b.nome, "pt-BR"))
      .map((d, i) => ({ ...d, ordem: i })); // ordem sem buracos, para as setas
  }

  // Ordem da lista = ordem no percurso do pátio (mesa 1 em diante).
  const ordenadas = () => [...disciplinas].sort((a, b) => a.ordem - b.ordem);

  function opcoes(d) {
    const locais = Planta.LOCAIS.filter((l) => !l.patio).map((l) => {
      const mesas = `até ${Planta.projetosNaSala(l.id)} projetos`;
      return `<option value="${l.id}" ${d.local === l.id ? "selected" : ""}>${l.id} · ${esc(l.nome)} · ${mesas}</option>`;
    }).join("");
    return `
      <option value="auto" ${d.local === "auto" ? "selected" : ""}>Pátio (na ordem da lista)</option>
      <optgroup label="Salas">${locais}</optgroup>
      <option value="fora" ${d.local === "fora" ? "selected" : ""}>Fora da planta / Auditório</option>`;
  }

  // Redesenha a prévia e a lista a cada mudança.
  function render() {
    const lista = ordenadas();
    const m = Planta.previa($("planta-previa"), lista, { edicao: $("planta-edicao").value.trim() || edicaoPadrao() });
    const naPlanta = m.incluidas.reduce((s, d) => s + d.projetos.length, 0);
    const divididas = [...m.porDisciplina.entries()].filter(([, r]) => r.dividida).map(([d]) => d.nome);
    $("planta-resumo").textContent =
      `${naPlanta} projeto${naPlanta === 1 ? "" : "s"} na planta · ${m.localDe.size} com mesa` +
      (m.semMesa.length ? ` · ${m.semMesa.length} sem mesa: escolha outro local ou mande alguma disciplina para o auditório.` : ".") +
      (divididas.length ? ` Divididas em mais de um local por falta de espaço: ${divididas.join(", ")}.` : "");
    $("planta-resumo").classList.toggle("alerta", m.semMesa.length > 0 || divididas.length > 0);

    const curto = (id) => cursos.find((c) => c.id === id)?.curto || "";
    $("planta-lista").innerHTML = `
      <p class="planta-ordem-dica">A ordem da lista é a ordem no pátio: a primeira começa no corredor da Elétrica, sobe, atravessa a fileira do alto e desce pelo corredor das Renováveis. Use ↑ ↓ para mudar.</p>
      <ol>
        ${lista
          .map((d, i) => {
            const r = m.porDisciplina.get(d);
            const onde = d.local === "fora" ? "fora da planta" : r?.texto || "";
            return `
          <li class="planta-item ${d.local === "fora" ? "fora" : ""} ${r?.sem || r?.dividida ? "alerta" : ""}" data-chave="${esc(d.chave)}">
            <span class="planta-linha">
              <span class="planta-ordem">
                <button type="button" data-mover="-1" aria-label="Subir ${esc(d.nome)}" ${i === 0 ? "disabled" : ""}>↑</button>
                <button type="button" data-mover="1" aria-label="Descer ${esc(d.nome)}" ${i === lista.length - 1 ? "disabled" : ""}>↓</button>
              </span>
              <span class="planta-nome"><b>${i + 1}. ${esc(d.nome)}</b><small>${esc(curto(d.curso))} · ${d.projetos.length} projeto${d.projetos.length === 1 ? "" : "s"} · ${esc(onde)}</small></span>
            </span>
            <select data-local aria-label="Local de ${esc(d.nome)}">${opcoes(d)}</select>
          </li>`;
          })
          .join("")}
      </ol>`;
  }

  const estadoParaSalvar = () => ({
    edicao: $("planta-edicao").value.trim() || edicaoPadrao(),
    disciplinas: Object.fromEntries(disciplinas.map((d) => [d.chave, { local: String(d.local), ordem: d.ordem }])),
  });

  function guardarNavegador() {
    try {
      localStorage.setItem(CHAVE_LOCAL, JSON.stringify(estadoParaSalvar()));
    } catch {
      // sem armazenamento, vale o Firebase
    }
  }

  function feedback(texto, erro = false) {
    $("planta-feedback").textContent = texto;
    $("planta-feedback").classList.toggle("erro", erro);
  }

  // O canvas acompanha a largura da janela, com a nitidez da tela.
  function ajustarCanvas() {
    const canvas = $("planta-previa");
    const largura = canvas.clientWidth || 800;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(largura * dpr);
    canvas.height = Math.round((largura * dpr * Planta.PAGINA[1]) / Planta.PAGINA[0]);
  }

  async function abrir() {
    $("planta-abrir").disabled = true;
    try {
      const [projetos, salvo] = await Promise.all([
        API.lerCadastro(),
        API.lerPlanta().catch((erro) => {
          if (erro.status !== 401) throw erro;
          return null; // regras antigas: usa o que ficou neste navegador
        }),
      ]);
      if (!projetos.length) return aviso("Cadastre os projetos antes de montar a planta.", true);
      const base = salvo ?? lerNavegador();
      disciplinas = montar(projetos, base);
      $("planta-edicao").value = base.edicao || edicaoPadrao();
      feedback("");
      $("planta").showModal();
      ajustarCanvas();
      render();
      // Com a fonte da original carregada, redesenha a prévia com ela.
      Planta.prepararFonte().then(() => $("planta").open && render());
    } catch (erro) {
      console.error(erro);
      aviso(`Não consegui abrir a planta. ${erro.message}`, true);
    } finally {
      $("planta-abrir").disabled = false;
    }
  }

  /* Eventos */
  $("planta-abrir").addEventListener("click", abrir);
  $("planta-cancelar").addEventListener("click", () => $("planta").close());
  $("planta-fechar").addEventListener("click", () => $("planta").close());
  $("planta-edicao").addEventListener("input", () => {
    render();
    guardarNavegador();
  });
  addEventListener("resize", () => {
    if (!$("planta").open) return;
    ajustarCanvas();
    render();
  });

  $("planta-lista").addEventListener("change", (e) => {
    if (!e.target.matches("[data-local]")) return;
    const d = disciplinas.find((x) => x.chave === e.target.closest("[data-chave]").dataset.chave);
    d.local = lerLocal(e.target.value);
    render();
    guardarNavegador();
    $("planta-lista").querySelector(`[data-chave="${CSS.escape(d.chave)}"] select`)?.focus();
  });

  $("planta-lista").addEventListener("click", (e) => {
    const botao = e.target.closest("[data-mover]");
    if (!botao) return;
    const lista = ordenadas();
    const i = lista.findIndex((x) => x.chave === botao.closest("[data-chave]").dataset.chave);
    const j = i + Number(botao.dataset.mover);
    if (j < 0 || j >= lista.length) return;
    [lista[i].ordem, lista[j].ordem] = [lista[j].ordem, lista[i].ordem];
    render();
    guardarNavegador();
    $("planta-lista").querySelector(`[data-chave="${CSS.escape(lista[i].chave)}"] [data-mover="${botao.dataset.mover}"]`)?.focus();
  });

  $("planta-gerar").addEventListener("click", async () => {
    const botao = $("planta-gerar");
    botao.disabled = true;
    feedback("Gerando a planta…");
    const estado = estadoParaSalvar();
    guardarNavegador();
    try {
      const { ocupadas, semMesa } = await Planta.baixar(ordenadas(), { edicao: estado.edicao, cursos });
      let salvo = true;
      try {
        await API.salvarPlanta(estado);
      } catch (erro) {
        console.error(erro);
        salvo = false;
      }
      feedback(
        `Planta baixada: ${ocupadas} projeto${ocupadas === 1 ? "" : "s"} com mesa` +
          (semMesa ? `, ${semMesa} projeto(s) sem mesa.` : ".") +
          (salvo ? "" : " As escolhas ficaram só neste navegador (o Firebase não aceitou salvar)."),
        !!semMesa || !salvo
      );
    } catch (erro) {
      console.error(erro);
      feedback(`Não consegui gerar a planta. ${erro.message}`, true);
    } finally {
      botao.disabled = false;
    }
  });
})();
