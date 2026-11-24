// Aba "Formulários" da Área dos Petianos: perguntas e respostas das inscrições. Usa $ e esc de petianos.js.
window.PainelFormularios = (() => {
  const TIPOS = Object.keys(window.FEIRA.publicos);
  const dos = (t) => window.FEIRA.publicos[t].dos;
  const { tiposPergunta, formulariosPadrao } = window.FEIRA;
  const comOpcoes = (tipo) => tiposPergunta.find((t) => t.id === tipo)?.opcoes;
  const copia = (obj) => JSON.parse(JSON.stringify(obj));
  const { colunas, valorTexto, dataHora } = RelatorioInscricoes;

  let iniciado = false;
  let tipo = "alunos";
  let secao = "respostas";
  let respostaAberta = null;
  const estado = Object.fromEntries(
    TIPOS.map((t) => [t, { formulario: null, rascunho: null, inscricoes: [], alterado: false, carregado: false }])
  );

  /* Dados */
  async function carregar(t = tipo) {
    const e = estado[t];
    try {
      const [formulario, inscricoes] = await Promise.all([API.lerFormulario(t), API.lerInscricoes(t)]);
      e.formulario = formulario;
      e.inscricoes = inscricoes;
      if (!e.alterado) e.rascunho = copia(formulario);
      e.carregado = true;
      $("aviso-form").hidden = true;
    } catch (erro) {
      console.error(erro);
      $("aviso-form").textContent = `Não consegui ler os formulários. ${erro.message}`;
      $("aviso-form").hidden = false;
      if (!e.formulario) {
        e.formulario = { ...copia(formulariosPadrao[t]), aberto: false, salvo: false };
        e.rascunho = copia(e.formulario);
      }
    }
    if (t === tipo) render();
  }

  function render() {
    const e = estado[tipo];
    document.querySelectorAll(".abas-form .aba").forEach((b) => b.setAttribute("aria-pressed", b.dataset.tipo === tipo));
    $("form-tipo-nome").textContent = tipo;
    $("form-total").textContent = e.carregado ? e.inscricoes.length : "–";
    $("form-total-txt").textContent = e.inscricoes.length === 1 ? "resposta" : "respostas";
    const aberto = !!e.formulario?.aberto;
    $("form-aberto").checked = aberto;
    $("form-aberto-txt").textContent = aberto ? "Inscrições abertas" : "Inscrições fechadas";
    $("form-link").href = `inscricoes.html#${tipo}`;
    const n = e.rascunho?.perguntas.length || 0;
    $("form-qtd-perguntas").textContent = `${n} pergunta${n === 1 ? "" : "s"}${e.alterado ? " · não salvas" : ""}`;
    $("respostas-titulo").textContent = `Inscrições de ${tipo}`;
    $("perguntas-titulo").textContent = `Formulário ${dos(tipo)}`;

    document.querySelectorAll("[data-secao]").forEach((b) => b.setAttribute("aria-current", b.dataset.secao === secao));
    $("secao-respostas").hidden = secao !== "respostas";
    $("secao-perguntas").hidden = secao !== "perguntas";
    renderRespostas();
    renderEditor();
  }

  /* Respostas */
  function renderRespostas() {
    const e = estado[tipo];
    if (!e.formulario) return;
    const cols = colunas(e.formulario, e.inscricoes);
    const busca = $("respostas-busca").value.trim().toLowerCase();
    const linhas = e.inscricoes
      .map((r, i) => ({ r, i, valores: cols.map((c) => valorTexto(r.respostas[c.id]?.v)) }))
      .filter((l) => !busca || l.valores.some((v) => v.toLowerCase().includes(busca)));

    if (!e.inscricoes.length) {
      $("respostas-tabela").innerHTML = `<p class="lista-vazia">Ninguém respondeu ainda. ${e.formulario.aberto ? "" : "Abra as inscrições na lateral para o formulário aparecer no site."}</p>`;
      return;
    }
    if (!linhas.length) {
      $("respostas-tabela").innerHTML = `<p class="lista-vazia">Nenhuma resposta encontrada.</p>`;
      return;
    }
    $("respostas-tabela").innerHTML = `
      <table class="tabela-respostas">
        <thead><tr><th>Nº</th><th>Enviado em</th>${cols.map((c) => `<th>${esc(c.texto)}</th>`).join("")}</tr></thead>
        <tbody>
          ${linhas
            .map(
              ({ r, i, valores }) => `
                <tr data-id="${esc(r.id)}" tabindex="0">
                  <td class="num">${i + 1}</td>
                  <td class="quando">${esc(dataHora(r.enviadoEm))}</td>
                  ${valores.map((v) => `<td title="${esc(v)}">${esc(v) || '<span class="vazio">–</span>'}</td>`).join("")}
                </tr>`
            )
            .join("")}
        </tbody>
      </table>`;
  }

  function abrirResposta(id) {
    const e = estado[tipo];
    const i = e.inscricoes.findIndex((r) => r.id === id);
    const r = e.inscricoes[i];
    if (!r) return;
    respostaAberta = r.id;
    const cols = colunas(e.formulario, e.inscricoes);
    const primeira = cols.map((c) => valorTexto(r.respostas[c.id]?.v)).find((v) => v.trim());
    $("ver-resposta-meta").textContent =
      `Resposta nº ${i + 1} · ${dataHora(r.enviadoEm)}` + (r.editadoEm ? ` · corrigida em ${dataHora(r.editadoEm)}` : "");
    $("ver-resposta-titulo").textContent = primeira || "Resposta";
    $("ver-resposta-lista").innerHTML = cols
      .map((c) => `<div><dt>${esc(c.texto)}</dt><dd>${esc(valorTexto(r.respostas[c.id]?.v)) || '<span class="vazio">Sem resposta</span>'}</dd></div>`)
      .join("");
    $("excluir-resposta").textContent = "Excluir resposta";
    $("excluir-resposta").dataset.confirmar = "";
    modoEdicao(false);
    $("ver-resposta-feedback").textContent = "";
    $("ver-resposta").showModal();
  }

  /* Corrigir uma resposta (ex.: aluno que escreveu os nomes no lugar do projeto) */
  function modoEdicao(ligado) {
    $("editar-resposta").hidden = ligado;
    $("excluir-resposta").hidden = ligado;
    $("cancelar-edicao").hidden = !ligado;
    $("salvar-resposta").hidden = !ligado;
  }

  $("editar-resposta").addEventListener("click", () => {
    const e = estado[tipo];
    const r = e.inscricoes.find((x) => x.id === respostaAberta);
    const cols = colunas(e.formulario, e.inscricoes);
    $("ver-resposta-lista").innerHTML = cols
      .map((c) => {
        const v = valorTexto(r.respostas[c.id]?.v);
        const linhas = Math.min(6, Math.max(1, Math.ceil(v.length / 60), v.split("\n").length));
        return `
          <div>
            <dt><label for="ed-${esc(c.id)}">${esc(c.texto)}</label></dt>
            <dd><textarea class="edicao-resposta" id="ed-${esc(c.id)}" data-pergunta="${esc(c.id)}" rows="${linhas}">${esc(v)}</textarea>
            ${c.tipo === "varias" ? `<small class="vazio">Várias opções: separe com ponto e vírgula.</small>` : ""}</dd>
          </div>`;
      })
      .join("");
    modoEdicao(true);
    $("ver-resposta-lista").querySelector("textarea")?.focus();
  });

  $("cancelar-edicao").addEventListener("click", () => abrirResposta(respostaAberta));

  $("salvar-resposta").addEventListener("click", async () => {
    const e = estado[tipo];
    const r = e.inscricoes.find((x) => x.id === respostaAberta);
    const cols = colunas(e.formulario, e.inscricoes);
    const respostas = {};
    for (const c of cols) {
      const campo = document.querySelector(`.edicao-resposta[data-pergunta="${CSS.escape(c.id)}"]`);
      const texto = (campo?.value ?? valorTexto(r.respostas[c.id]?.v)).trim();
      if (!texto) continue;
      const v = c.tipo === "varias" ? texto.split(/\s*;\s*/).filter(Boolean) : texto;
      respostas[c.id] = { p: r.respostas[c.id]?.p || c.texto.replace(/ \(pergunta removida\)$/, ""), v };
    }
    $("salvar-resposta").disabled = true;
    $("ver-resposta-feedback").classList.remove("erro");
    $("ver-resposta-feedback").textContent = "Salvando…";
    try {
      await API.editarInscricao(tipo, respostaAberta, respostas);
      await carregar(tipo);
      abrirResposta(respostaAberta);
      $("ver-resposta-feedback").textContent = "Correção salva. A resposta original fica guardada na cópia de segurança.";
    } catch (erro) {
      $("ver-resposta-feedback").classList.add("erro");
      $("ver-resposta-feedback").textContent = erro.message;
    } finally {
      $("salvar-resposta").disabled = false;
    }
  });

  /* Editor de perguntas */
  function renderEditor() {
    const r = estado[tipo].rascunho;
    if (!r) return;
    $("editor-titulo").value = r.titulo || "";
    $("editor-descricao").value = r.descricao || "";
    $("editor-status").textContent = estado[tipo].alterado ? "Há alterações não salvas." : estado[tipo].formulario?.salvo ? "Tudo salvo." : "Modelo inicial, ainda não salvo no Firebase.";
    $("editor-perguntas").innerHTML = r.perguntas
      .map(
        (q, i) => `
          <li class="editor-pergunta" data-i="${i}">
            <div class="editor-pergunta-topo">
              <span class="item-stand">${i + 1}</span>
              <label class="visualmente-oculto" for="ep-texto-${i}">Texto da pergunta ${i + 1}</label>
              <input id="ep-texto-${i}" data-campo="texto" value="${esc(q.texto)}" maxlength="200" placeholder="Escreva a pergunta">
            </div>
            <div class="editor-pergunta-linha">
              <label class="visualmente-oculto" for="ep-tipo-${i}">Tipo de resposta</label>
              <select id="ep-tipo-${i}" data-campo="tipo">
                ${tiposPergunta.map((t) => `<option value="${t.id}" ${t.id === q.tipo ? "selected" : ""}>${t.nome}</option>`).join("")}
              </select>
              <label class="ep-obrig"><input type="checkbox" data-campo="obrigatoria" ${q.obrigatoria ? "checked" : ""}> Obrigatória</label>
              <span class="ep-acoes">
                <button type="button" data-acao="subir" aria-label="Subir pergunta ${i + 1}" ${i === 0 ? "disabled" : ""}>↑</button>
                <button type="button" data-acao="descer" aria-label="Descer pergunta ${i + 1}" ${i === r.perguntas.length - 1 ? "disabled" : ""}>↓</button>
                <button type="button" data-acao="remover" aria-label="Excluir pergunta ${i + 1}">Excluir</button>
              </span>
            </div>
            ${
              comOpcoes(q.tipo)
                ? `<label class="campo"><span>Opções (uma por linha)</span><textarea data-campo="opcoes" rows="${Math.max(3, (q.opcoes || []).length + 1)}">${esc((q.opcoes || []).join("\n"))}</textarea></label>`
                : ""
            }
            <label class="campo"><span>Texto de ajuda (opcional)</span><input data-campo="ajuda" value="${esc(q.ajuda || "")}" maxlength="200" placeholder="Aparece embaixo da pergunta"></label>
            ${
              ["curta", "longa", "email", "telefone", "numero"].includes(q.tipo)
                ? `<label class="campo"><span>Exemplo dentro do campo (opcional)</span><input data-campo="exemplo" value="${esc(q.exemplo || "")}" maxlength="120" placeholder="Ex.: EletroBraço"></label>`
                : ""
            }
            ${
              q.tipo === "curta"
                ? `<label class="ep-obrig ep-nome"><input type="checkbox" data-campo="apenasNome" ${q.apenasNome ? "checked" : ""}> Só um nome (recusa listas de pessoas e matrículas, até 60 letras)</label>`
                : ""
            }
          </li>`
      )
      .join("");
  }

  function marcarAlterado() {
    estado[tipo].alterado = true;
    $("editor-status").textContent = "Há alterações não salvas.";
    const n = estado[tipo].rascunho.perguntas.length;
    $("form-qtd-perguntas").textContent = `${n} pergunta${n === 1 ? "" : "s"} · não salvas`;
    aviso("");
  }

  function aviso(texto, erro = false) {
    $("feedback-form").textContent = texto;
    $("feedback-form").classList.toggle("erro", erro);
  }

  const novoId = () => `p${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;

  // Limpa o rascunho para gravar; devolve o motivo se algo impede salvar.
  function prontoParaSalvar(r) {
    if (!(r.titulo || "").trim()) return { erro: "Dê um título ao formulário." };
    if (!r.perguntas.length) return { erro: "O formulário precisa de pelo menos uma pergunta." };
    const perguntas = [];
    for (const [i, q] of r.perguntas.entries()) {
      const texto = (q.texto || "").trim();
      if (!texto) return { erro: `A pergunta ${i + 1} está sem texto.` };
      const limpa = { id: q.id || novoId(), texto, tipo: q.tipo, obrigatoria: !!q.obrigatoria };
      if (comOpcoes(q.tipo)) {
        const opcoes = [...new Set((q.opcoes || []).map((o) => o.trim()).filter(Boolean))];
        if (!opcoes.length) return { erro: `A pergunta ${i + 1} (“${texto}”) precisa de opções.` };
        limpa.opcoes = opcoes;
      }
      if ((q.ajuda || "").trim()) limpa.ajuda = q.ajuda.trim();
      if ((q.exemplo || "").trim()) limpa.exemplo = q.exemplo.trim();
      if (q.apenasNome && q.tipo === "curta") limpa.apenasNome = true;
      perguntas.push(limpa);
    }
    return { dados: { titulo: (r.titulo || "").trim(), descricao: (r.descricao || "").trim(), perguntas } };
  }

  /* Eventos */
  document.querySelector(".abas-form").addEventListener("click", (ev) => {
    const botao = ev.target.closest("[data-tipo]");
    if (!botao) return;
    tipo = botao.dataset.tipo;
    $("respostas-busca").value = "";
    aviso("");
    render();
    carregar(tipo);
  });

  // Ao abrir a aba, relê as respostas.
  document.querySelector('.painel-topo [data-aba="formularios"]').addEventListener("click", () => carregar(tipo));

  document.querySelector("#aba-formularios .lista-projetos").addEventListener("click", (ev) => {
    const botao = ev.target.closest("[data-secao]");
    if (!botao) return;
    secao = botao.dataset.secao;
    render();
  });

  $("respostas-busca").addEventListener("input", renderRespostas);

  $("respostas-tabela").addEventListener("click", (ev) => {
    const linha = ev.target.closest("tr[data-id]");
    if (linha) abrirResposta(linha.dataset.id);
  });
  $("respostas-tabela").addEventListener("keydown", (ev) => {
    const linha = ev.target.closest("tr[data-id]");
    if (linha && (ev.key === "Enter" || ev.key === " ")) {
      ev.preventDefault();
      abrirResposta(linha.dataset.id);
    }
  });

  $("ver-resposta-fechar").addEventListener("click", () => $("ver-resposta").close());
  $("ver-resposta").addEventListener("click", (ev) => {
    if (ev.target === $("ver-resposta")) $("ver-resposta").close();
  });

  // Excluir pede um segundo clique, para não apagar sem querer.
  $("excluir-resposta").addEventListener("click", async () => {
    const botao = $("excluir-resposta");
    if (!botao.dataset.confirmar) {
      botao.dataset.confirmar = "1";
      botao.textContent = "Clique de novo para excluir de vez";
      return;
    }
    botao.disabled = true;
    try {
      await API.removerInscricao(tipo, respostaAberta);
      $("ver-resposta").close();
      await carregar(tipo);
      situacao("Resposta excluída.", "ok");
    } catch (erro) {
      botao.textContent = erro.message;
    } finally {
      botao.disabled = false;
    }
  });

  $("form-aberto").addEventListener("change", async () => {
    const e = estado[tipo];
    const aberto = $("form-aberto").checked;
    $("form-aberto").disabled = true;
    try {
      if (e.formulario.salvo) {
        await API.definirInscricoesAbertas(tipo, aberto);
      } else {
        // Primeira vez: grava o formulário inteiro (o modelo ou o que estiver no editor).
        const { dados, erro } = prontoParaSalvar(e.rascunho);
        if (erro) throw new Error(`${erro} Ajuste em “Editar perguntas”.`);
        await API.salvarFormulario(tipo, { ...dados, aberto });
        e.alterado = false;
      }
      e.formulario.aberto = aberto;
      await carregar(tipo);
      situacao(aberto ? `Inscrições de ${tipo} abertas no site.` : `Inscrições de ${tipo} fechadas.`, "ok");
    } catch (erro) {
      $("form-aberto").checked = !aberto;
      situacao(erro.message, "alerta");
    } finally {
      $("form-aberto").disabled = false;
    }
  });

  function situacao(texto, classe = "") {
    $("form-situacao").className = `urna-situacao ${classe}`;
    $("form-situacao").textContent = texto;
  }

  async function exportar(como) {
    const botao = como === "pdf" ? $("exportar-pdf") : $("exportar-tabela");
    botao.disabled = true;
    situacao(como === "pdf" ? "Gerando o PDF…" : "Gerando a tabela…");
    try {
      // Relê para sair com as respostas mais recentes.
      const [formulario, inscricoes] = await Promise.all([API.lerFormulario(tipo), API.lerInscricoes(tipo)]);
      if (como === "pdf") {
        await RelatorioInscricoes.baixar(tipo, formulario, inscricoes);
        situacao("PDF baixado.", "ok");
      } else {
        const ext = await Exportar.tabela(`inscricoes-${tipo}`, `Inscrições ${tipo}`, RelatorioInscricoes.tabela(formulario, inscricoes));
        situacao(ext === "xlsx" ? "Planilha do Excel baixada." : "Sem acesso ao gerador de .xlsx: baixei em .csv (abre no Excel).", "ok");
      }
    } catch (erro) {
      console.error(erro);
      situacao(`Não consegui exportar. ${erro.message}`, "alerta");
    } finally {
      botao.disabled = false;
    }
  }

  $("exportar-tabela").addEventListener("click", () => exportar("tabela"));
  $("exportar-pdf").addEventListener("click", () => exportar("pdf"));

  $("form-editor").addEventListener("input", (ev) => {
    const r = estado[tipo].rascunho;
    const alvo = ev.target;
    if (alvo.id === "editor-titulo") r.titulo = alvo.value;
    else if (alvo.id === "editor-descricao") r.descricao = alvo.value;
    else if (alvo.dataset.campo) {
      const q = r.perguntas[Number(alvo.closest("[data-i]").dataset.i)];
      const campo = alvo.dataset.campo;
      if (campo === "obrigatoria" || campo === "apenasNome") q[campo] = alvo.checked;
      else if (campo === "opcoes") q.opcoes = alvo.value.split("\n");
      else q[campo] = alvo.value;
      if (campo === "tipo") {
        if (comOpcoes(q.tipo) && !(q.opcoes || []).filter((o) => o.trim()).length) q.opcoes = ["Opção 1", "Opção 2"];
        renderEditor();
      }
    } else return;
    marcarAlterado();
  });

  $("editor-perguntas").addEventListener("click", (ev) => {
    const botao = ev.target.closest("[data-acao]");
    if (!botao) return;
    const lista = estado[tipo].rascunho.perguntas;
    const i = Number(botao.closest("[data-i]").dataset.i);
    const acao = botao.dataset.acao;
    if (acao === "remover") {
      if (!confirm(`Excluir a pergunta “${lista[i].texto || i + 1}”? As respostas antigas continuam guardadas.`)) return;
      lista.splice(i, 1);
    } else {
      const j = acao === "subir" ? i - 1 : i + 1;
      [lista[i], lista[j]] = [lista[j], lista[i]];
    }
    marcarAlterado();
    renderEditor();
    document.querySelector(`.editor-pergunta[data-i="${acao === "remover" ? Math.max(0, i - 1) : acao === "subir" ? i - 1 : i + 1}"] [data-acao="${acao === "remover" ? "remover" : acao}"]`)?.focus();
  });

  $("adicionar-pergunta").addEventListener("click", () => {
    estado[tipo].rascunho.perguntas.push({ id: novoId(), texto: "", tipo: "curta", obrigatoria: false });
    marcarAlterado();
    renderEditor();
    const campos = document.querySelectorAll('#editor-perguntas [data-campo="texto"]');
    campos[campos.length - 1]?.focus();
  });

  $("restaurar-modelo").addEventListener("click", () => {
    if (!confirm(`Trocar as perguntas atuais pelo modelo inicial do formulário ${dos(tipo)}? Nada é salvo até você clicar em “Salvar perguntas”.`)) return;
    const r = estado[tipo].rascunho;
    Object.assign(r, copia(formulariosPadrao[tipo]));
    marcarAlterado();
    renderEditor();
  });

  $("form-editor").addEventListener("submit", async (ev) => {
    ev.preventDefault();
    const e = estado[tipo];
    const { dados, erro } = prontoParaSalvar(e.rascunho);
    if (erro) return aviso(erro, true);
    $("salvar-form").disabled = true;
    aviso("Salvando…");
    try {
      await API.salvarFormulario(tipo, { ...dados, aberto: !!e.formulario?.aberto });
      e.alterado = false;
      await carregar(tipo);
      aviso(`Formulário ${dos(tipo)} salvo com ${dados.perguntas.length} pergunta${dados.perguntas.length === 1 ? "" : "s"}.`);
    } catch (erroSalvar) {
      aviso(erroSalvar.message, true);
    } finally {
      $("salvar-form").disabled = false;
    }
  });

  return {
    iniciar() {
      if (iniciado) return;
      iniciado = true;
      TIPOS.forEach((t) => carregar(t));
    },
    recarregar() {
      if (iniciado) TIPOS.forEach((t) => carregar(t));
    },
    podeDescartar() {
      const pendentes = TIPOS.filter((t) => estado[t].alterado);
      return !pendentes.length || confirm(`Há perguntas não salvas ${pendentes.length > 1 ? "nos formulários" : "no formulário"} ${pendentes.map(dos).join(" e ")}. Sair mesmo assim?`);
    },
  };
})();
