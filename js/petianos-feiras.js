// Aba "Feiras" da Área dos Petianos: cria e edita as edições mostradas na página Feiras.
// Usa $ e esc de petianos.js.
window.PainelFeiras = (() => {
  const idInicial = (f, i) => `f${String(i).padStart(2, "0")}${String(f.edicao).replace(/\W/g, "")}`;
  // As edições que vêm com o site, com o mesmo id que ganham ao ir para o Firebase.
  const iniciais = () => window.FEIRAS_PASSADAS.map((f, i) => ({ ...normalizarFeira(f), id: idInicial(f, i) }));
  const numero = (f) => parseFloat(String(f.edicao).replace(",", ".")) || 0;

  let feiras = [];
  let noBanco = false; // false = ainda são as do código do site
  let editandoId = null;
  let fotos = [];
  let alterado = false;

  async function carregar() {
    try {
      const doBanco = await API.lerFeiras();
      noBanco = !!doBanco;
      feiras = (doBanco || iniciais()).map((f) => ({ ...normalizarFeira(f), id: f.id }));
    } catch (erro) {
      $("feira-feedback").textContent = `Não consegui ler as feiras do Firebase. ${erro.message}`;
      $("feira-feedback").classList.add("erro");
      feiras = iniciais();
      noBanco = false;
    }
    feiras.sort((a, b) => numero(b) - numero(a));
    $("aviso-feiras").hidden = noBanco;
    renderLista();
  }

  function renderLista() {
    $("total-feiras").textContent = feiras.length;
    $("total-feiras-txt").textContent = feiras.length === 1 ? "edição na página Feiras" : "edições na página Feiras";
    $("lista-feiras").innerHTML = feiras.length
      ? feiras
          .map(
            (f) => `
              <li>
                <button class="item-projeto" type="button" data-id="${esc(f.id)}" aria-current="${f.id === editandoId}">
                  <span class="item-stand">${esc(f.edicao)}</span>
                  <span>
                    <span class="item-nome">${esc(f.titulo)}</span>
                    <span class="item-sub">${esc([f.quando, `${f.fotos.length} foto${f.fotos.length === 1 ? "" : "s"}`].filter(Boolean).join(" · "))}</span>
                  </span>
                </button>
              </li>`
          )
          .join("")
      : `<li class="lista-vazia">Nenhuma edição cadastrada.</li>`;
  }

  /* Formulário */
  const linhasDe = (texto) => texto.split("\n").map((l) => l.trim()).filter(Boolean);

  function preencher(f) {
    $("feira-edicao").value = f?.edicao ?? "";
    $("feira-titulo").value = f?.titulo ?? "Feira de Engenharia e Energia";
    $("feira-quando").value = f?.quando ?? "";
    $("feira-onde").value = f?.onde ?? "";
    $("feira-resumo").value = f?.resumo ?? "";
    $("feira-link").value = f?.link ?? "";
    $("feira-numeros").value = (f?.numeros || []).join("\n");
    $("feira-vencedores").value = (f?.vencedores || []).map((v) => `${v.categoria}: ${v.nome}`).join("\n");
    fotos = (f?.fotos || []).map((x) => ({ ...x }));
    $("feira-titulo-ficha").textContent = f ? `${f.titulo} ${f.edicao}` : "Nova edição";
    $("feira-salvar").textContent = f ? "Salvar alterações" : "Publicar edição";
    $("feira-excluir").hidden = !f;
    alterado = false;
    contador();
    renderFotos();
    renderLista();
  }

  function contador() {
    $("feira-contador").textContent = `${$("feira-resumo").value.length}/${$("feira-resumo").maxLength}`;
  }

  function renderFotos() {
    $("feira-fotos").innerHTML = fotos.length
      ? fotos
          .map(
            (x, i) => `
              <li class="foto-editor" data-i="${i}">
                <span class="foto-previa">${x.url ? `<img src="${esc(x.url)}" alt="" loading="lazy">` : ""}${i === 0 ? `<em>capa</em>` : ""}</span>
                <span class="foto-campos">
                  <input data-campo="url" type="url" value="${esc(x.url)}" placeholder="https://i.postimg.cc/…/foto.jpg" aria-label="Link da foto ${i + 1}">
                  <input data-campo="legenda" value="${esc(x.legenda)}" maxlength="120" placeholder="Legenda (opcional)" aria-label="Legenda da foto ${i + 1}">
                </span>
                <span class="ep-acoes">
                  <button type="button" data-acao="subir" aria-label="Subir foto ${i + 1}" ${i === 0 ? "disabled" : ""}>↑</button>
                  <button type="button" data-acao="descer" aria-label="Descer foto ${i + 1}" ${i === fotos.length - 1 ? "disabled" : ""}>↓</button>
                  <button type="button" data-acao="remover" aria-label="Remover foto ${i + 1}">Remover</button>
                </span>
              </li>`
          )
          .join("")
      : `<li class="lista-vazia">Nenhuma foto ainda.</li>`;
  }

  function lerFormulario() {
    const vencedores = linhasDe($("feira-vencedores").value).map((l) => {
      const i = l.indexOf(":");
      return i > 0 ? { categoria: l.slice(0, i).trim(), nome: l.slice(i + 1).trim() } : { categoria: "Destaque", nome: l };
    });
    return {
      edicao: $("feira-edicao").value.trim(),
      titulo: $("feira-titulo").value.trim() || "Feira de Engenharia e Energia",
      quando: $("feira-quando").value.trim(),
      onde: $("feira-onde").value.trim(),
      resumo: $("feira-resumo").value.trim(),
      link: $("feira-link").value.trim(),
      numeros: linhasDe($("feira-numeros").value),
      vencedores,
      fotos: fotos.map((x) => ({ url: x.url.trim(), legenda: (x.legenda || "").trim() })).filter((x) => x.url),
    };
  }

  function aviso(texto, erro = false) {
    $("feira-feedback").textContent = texto;
    $("feira-feedback").classList.toggle("erro", erro);
  }

  function podeDescartar() {
    return !alterado || confirm("Você tem alterações não salvas nesta edição. Descartar?");
  }

  // Na primeira gravação, as edições que estavam no código do site vão junto para o Firebase.
  async function garantirNoBanco() {
    if (noBanco) return;
    await API.publicarFeirasIniciais(iniciais().map(({ id, ...f }) => f));
    noBanco = true;
  }

  /* Eventos */
  $("trazer-feiras").addEventListener("click", async () => {
    $("trazer-feiras").disabled = true;
    try {
      await garantirNoBanco();
      await carregar();
      aviso(`${feiras.length} edições agora estão no Firebase e podem ser editadas.`);
    } catch (erro) {
      aviso(erro.message, true);
    } finally {
      $("trazer-feiras").disabled = false;
    }
  });

  $("nova-feira").addEventListener("click", () => {
    if (!podeDescartar()) return;
    editandoId = null;
    preencher(null);
    aviso("");
    $("feira-edicao").focus();
  });

  $("lista-feiras").addEventListener("click", (e) => {
    const item = e.target.closest("[data-id]");
    if (!item || !podeDescartar()) return;
    editandoId = item.dataset.id;
    preencher(feiras.find((f) => f.id === editandoId));
    aviso("");
    if (matchMedia("(max-width: 1040px)").matches) $("ficha-feira").scrollIntoView();
  });

  $("form-feira").addEventListener("input", (e) => {
    const campo = e.target.dataset.campo;
    if (campo) {
      const i = Number(e.target.closest("[data-i]").dataset.i);
      fotos[i][campo] = e.target.value;
      if (campo === "url") {
        const previa = e.target.closest(".foto-editor").querySelector(".foto-previa");
        const img = previa.querySelector("img") || previa.insertAdjacentElement("afterbegin", Object.assign(document.createElement("img"), { alt: "" }));
        img.src = e.target.value.trim();
      }
    }
    if (e.target.id === "feira-resumo") contador();
    alterado = true;
    aviso("");
  });

  $("feira-fotos").addEventListener("click", (e) => {
    const botao = e.target.closest("[data-acao]");
    if (!botao) return;
    const i = Number(botao.closest("[data-i]").dataset.i);
    if (botao.dataset.acao === "remover") fotos.splice(i, 1);
    else {
      const j = botao.dataset.acao === "subir" ? i - 1 : i + 1;
      [fotos[i], fotos[j]] = [fotos[j], fotos[i]];
    }
    alterado = true;
    renderFotos();
  });

  $("feira-add-foto").addEventListener("click", () => {
    fotos.push({ url: "", legenda: "" });
    alterado = true;
    renderFotos();
    const campos = document.querySelectorAll('#feira-fotos [data-campo="url"]');
    campos[campos.length - 1]?.focus();
  });

  $("form-feira").addEventListener("submit", async (e) => {
    e.preventDefault();
    const dados = lerFormulario();
    if (!dados.edicao) return aviso("Preencha a edição (ex.: 2026.1).", true);
    if (dados.link && !/^https?:\/\//i.test(dados.link)) return aviso("O link da matéria precisa começar com http:// ou https://", true);
    const fotoRuim = dados.fotos.find((x) => !/^https?:\/\//i.test(x.url));
    if (fotoRuim) return aviso(`Este link de foto não parece válido: ${fotoRuim.url}`, true);
    const repetida = feiras.find((f) => f.id !== editandoId && f.edicao === dados.edicao);
    if (repetida && !confirm(`Já existe a edição ${dados.edicao}. Salvar outra com o mesmo número?`)) return;

    $("feira-salvar").disabled = true;
    aviso("Salvando…");
    try {
      await garantirNoBanco();
      const eraNova = !editandoId;
      editandoId = await API.salvarFeira(editandoId, dados);
      alterado = false;
      await carregar();
      preencher(feiras.find((f) => f.id === editandoId));
      aviso(`Edição ${dados.edicao} ${eraNova ? "publicada" : "atualizada"} na página Feiras.`);
    } catch (erro) {
      aviso(erro.message, true);
    } finally {
      $("feira-salvar").disabled = false;
    }
  });

  $("feira-excluir").addEventListener("click", async () => {
    const f = feiras.find((x) => x.id === editandoId);
    if (!f || !confirm(`Excluir a edição ${f.edicao} da página Feiras? Isso não pode ser desfeito.`)) return;
    try {
      await garantirNoBanco();
      await API.removerFeira(editandoId);
      editandoId = null;
      await carregar();
      preencher(null);
      aviso(`Edição ${f.edicao} excluída.`);
    } catch (erro) {
      aviso(erro.message, true);
    }
  });

  document.querySelector('.painel-topo [data-aba="feiras"]').addEventListener("click", () => {
    if (!alterado) carregar();
  });

  preencher(null);
  return { podeDescartar, carregar };
})();
