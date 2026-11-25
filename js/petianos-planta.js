// "Planta da feira" (aba Projetos): marca onde cada disciplina fica (pátio, auditório, sala ou fora)
// e gera o PDF da planta com Planta.baixar. A escolha fica salva em /site/planta.
// Usa $, esc, cursos e aviso de petianos.js.
(() => {
  const CHAVE_LOCAL = "feira-pet:planta";
  const LOCAIS = [
    ["patio", "Pátio (mesas da planta)"],
    ["auditorio", "Auditório"],
    ["sala", "Sala"],
    ["fora", "Fora da planta"],
  ];
  // Estas ficam fora da planta, a não ser que alguém mude.
  const FORA_POR_PADRAO = [/\bintegradora\s+(iii|3)\b/, /\bmanutencao\s+industrial\b/];

  let disciplinas = []; // [{ chave, nome, curso, projetos, local, sala, ordem }]
  let edicaoSalva = "";

  const normalizar = (t) => String(t ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
  const chaveDe = (nome) => normalizar(nome).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "sem-disciplina";
  const edicaoPadrao = () => {
    const d = new Date();
    return `${d.getFullYear()}.${d.getMonth() < 6 ? 1 : 2}`;
  };

  function lerLocal() {
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
    const lista = [...grupos.values()]
      .map((g) => ({
        chave: g.chave,
        nome: maisComum(g.grafias),
        curso: maisComum(g.cursos),
        projetos: g.projetos.sort((a, b) => a.numero - b.numero).map((p) => ({ codigo: p.codigo, nome: p.nome })),
      }))
      .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
    lista.forEach((d, i) => {
      const s = salvo.disciplinas?.[d.chave];
      d.local = s?.local || (FORA_POR_PADRAO.some((r) => r.test(normalizar(d.nome))) ? "fora" : "patio");
      d.sala = s?.sala || "";
      d.ordem = Number.isFinite(s?.ordem) ? s.ordem : 1000 + i;
    });
    return lista;
  }

  // Na ordem que a planta usa: Elétrica, depois Renováveis; dentro de cada curso, a ordem da lista.
  const ordenadas = () =>
    cursos.flatMap((c) => disciplinas.filter((d) => d.curso === c.id).sort((a, b) => a.ordem - b.ordem));

  function faixas(numeros) {
    const n = [...numeros].sort((a, b) => a - b);
    const partes = [];
    for (let i = 0; i < n.length; i++) {
      let j = i;
      while (j + 1 < n.length && n[j + 1] === n[j] + 1) j++;
      partes.push(i === j ? `${n[i]}` : `${n[i]}–${n[j]}`);
      i = j;
    }
    return partes.join(", ");
  }

  function render() {
    const lista = ordenadas();
    const { mesaDe, semMesa } = Planta.distribuir(lista);
    const noPatio = lista.filter((d) => d.local === "patio").reduce((s, d) => s + d.projetos.length, 0);
    $("planta-resumo").textContent =
      `Pátio: ${noPatio} projeto${noPatio === 1 ? "" : "s"} para ${Planta.TOTAL_MESAS} mesas` +
      (semMesa.length ? ` · ${semMesa.length} sem mesa: mande alguma disciplina para o auditório ou uma sala.` : ".");
    $("planta-resumo").classList.toggle("alerta", semMesa.length > 0);

    $("planta-lista").innerHTML = cursos
      .map((c) => {
        const doCurso = lista.filter((d) => d.curso === c.id);
        if (!doCurso.length) return "";
        return `
        <section class="planta-curso">
          <h3>${esc(c.nome)} <small>mesas ${faixas(Planta.MESAS_DO_CURSO[c.id])}</small></h3>
          <ol>
            ${doCurso
              .map((d, i) => {
                const mesas = d.projetos.map((p) => mesaDe.get(p.codigo)).filter(Boolean);
                const onde =
                  d.local === "patio"
                    ? mesas.length
                      ? `Mesa${mesas.length === 1 ? "" : "s"} ${faixas(mesas)}${mesas.length < d.projetos.length ? ` · ${d.projetos.length - mesas.length} sem mesa` : ""}`
                      : "Sem mesa livre"
                    : "";
                return `
              <li class="planta-item ${d.local === "fora" ? "fora" : ""}" data-chave="${esc(d.chave)}">
                <span class="planta-ordem">
                  <button type="button" data-mover="-1" aria-label="Subir ${esc(d.nome)}" ${i === 0 ? "disabled" : ""}>↑</button>
                  <button type="button" data-mover="1" aria-label="Descer ${esc(d.nome)}" ${i === doCurso.length - 1 ? "disabled" : ""}>↓</button>
                </span>
                <span class="planta-nome"><b>${esc(d.nome)}</b><small>${d.projetos.length} projeto${d.projetos.length === 1 ? "" : "s"}${onde ? ` · ${onde}` : ""}</small></span>
                <span class="planta-local">
                  <select data-local aria-label="Local de ${esc(d.nome)}">
                    ${LOCAIS.map(([v, t]) => `<option value="${v}" ${d.local === v ? "selected" : ""}>${t}</option>`).join("")}
                  </select>
                  ${d.local === "sala" ? `<input data-sala value="${esc(d.sala)}" placeholder="Ex.: T07" maxlength="30" aria-label="Sala de ${esc(d.nome)}">` : ""}
                </span>
              </li>`;
              })
              .join("")}
          </ol>
        </section>`;
      })
      .join("");
  }

  function estadoParaSalvar() {
    return {
      edicao: $("planta-edicao").value.trim() || edicaoPadrao(),
      disciplinas: Object.fromEntries(disciplinas.map((d) => [d.chave, { local: d.local, sala: d.sala, ordem: d.ordem }])),
    };
  }

  function guardarLocal() {
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
      const base = salvo ?? lerLocal();
      disciplinas = montar(projetos, base);
      edicaoSalva = base.edicao || edicaoPadrao();
      $("planta-edicao").value = edicaoSalva;
      feedback("");
      render();
      $("planta").showModal();
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

  $("planta-lista").addEventListener("change", (e) => {
    const item = e.target.closest("[data-chave]");
    const d = item && disciplinas.find((x) => x.chave === item.dataset.chave);
    if (!d) return;
    if (e.target.matches("[data-local]")) {
      d.local = e.target.value;
      render();
      if (d.local === "sala") $("planta-lista").querySelector(`[data-chave="${CSS.escape(d.chave)}"] [data-sala]`)?.focus();
    }
    guardarLocal();
  });
  $("planta-lista").addEventListener("input", (e) => {
    if (!e.target.matches("[data-sala]")) return;
    const d = disciplinas.find((x) => x.chave === e.target.closest("[data-chave]").dataset.chave);
    d.sala = e.target.value.trim();
  });
  $("planta-lista").addEventListener("click", (e) => {
    const botao = e.target.closest("[data-mover]");
    if (!botao) return;
    const d = disciplinas.find((x) => x.chave === botao.closest("[data-chave]").dataset.chave);
    const doCurso = ordenadas().filter((x) => x.curso === d.curso);
    doCurso.forEach((x, i) => (x.ordem = i));
    const i = doCurso.indexOf(d);
    const outro = doCurso[i + Number(botao.dataset.mover)];
    if (!outro) return;
    [d.ordem, outro.ordem] = [outro.ordem, d.ordem];
    render();
    guardarLocal();
    $("planta-lista").querySelector(`[data-chave="${CSS.escape(d.chave)}"] [data-mover="${botao.dataset.mover}"]`)?.focus();
  });

  $("planta-gerar").addEventListener("click", async () => {
    const botao = $("planta-gerar");
    const semSala = disciplinas.find((d) => d.local === "sala" && !d.sala);
    if (semSala) return feedback(`Escreva qual é a sala de ${semSala.nome}.`, true);
    botao.disabled = true;
    feedback("Gerando a planta…");
    const estado = estadoParaSalvar();
    guardarLocal();
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
        `Planta baixada: ${ocupadas} de ${Planta.TOTAL_MESAS} mesas ocupadas` +
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
