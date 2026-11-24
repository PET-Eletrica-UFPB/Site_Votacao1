// "Importar planilha" da aba Formulários: traz respostas de um .xlsx/.csv (ex.: Google Forms)
// para o formulário aberto na tela. Usa $ e esc de petianos.js.
(() => {
  const { tiposPergunta, publicos } = window.FEIRA;
  const IGNORAR = "__ignorar";
  const DATA = "__data";
  const NOVA = "__nova";

  let tipo = null;
  let formulario = null;
  let colunas = []; // [{ titulo, valores: [...] , destino }]
  let linhas = []; // linhas de dados da planilha (sem o cabeçalho)
  let jaImportadas = new Set();

  const normalizar = (t) =>
    String(t ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[:?.]+\s*$/, "").replace(/\s+/g, " ").trim();
  const tipoAtual = () => document.querySelector('.abas-form .aba[aria-pressed="true"]')?.dataset.tipo || "alunos";

  /* Leitura */
  function textoDe(v) {
    if (v instanceof Date) return v.toLocaleDateString("pt-BR");
    if (typeof v === "number") return Number.isInteger(v) ? String(v) : String(v).replace(".", ",");
    return String(v ?? "").trim();
  }

  function dataDe(v) {
    if (v instanceof Date && !isNaN(v)) return v.getTime();
    if (typeof v === "number" && v > 20000) {
      // número de série do Excel (dias desde 1899-12-30), no fuso de quem abre
      const utc = Math.round((v - 25569) * 86400000);
      return utc + new Date(utc).getTimezoneOffset() * 60000;
    }
    const t = Date.parse(v);
    return isNaN(t) ? null : t;
  }

  // Coluna da planilha → pergunta do formulário com o mesmo texto (ou começo parecido).
  function destinoInicial(titulo, valores) {
    const n = normalizar(titulo);
    if (!n && valores.every((v) => !textoDe(v))) return IGNORAR;
    if (/carimbo|data\/hora|timestamp|data de envio/.test(n)) return DATA;
    const perguntas = formulario.perguntas;
    const igual = perguntas.find((q) => normalizar(q.texto) === n);
    if (igual) return igual.id;
    const parecida = perguntas.find((q) => {
      const t = normalizar(q.texto);
      return Math.min(t.length, n.length) >= 5 && (t.startsWith(n) || n.startsWith(t));
    });
    if (parecida) return parecida.id;
    return valores.some((v) => textoDe(v)) ? NOVA : IGNORAR;
  }

  // Tipo de uma pergunta nova, pelo título e pelos valores da coluna.
  function inferirTipo(titulo, valores) {
    const n = normalizar(titulo);
    const textos = valores.map(textoDe).filter(Boolean);
    if (/e-?mail/.test(n)) return { tipo: "email" };
    if (/telefone|whats|celular/.test(n)) return { tipo: "telefone" };
    const distintos = [...new Set(textos)];
    if (textos.length >= 3 && distintos.length <= 5 && distintos.every((t) => t.length <= 40)) return { tipo: "unica", opcoes: distintos };
    const media = textos.reduce((s, t) => s + t.length, 0) / (textos.length || 1);
    return { tipo: media > 60 ? "longa" : "curta" };
  }

  // Valor da célula no formato da pergunta de destino.
  function converter(v, pergunta) {
    const texto = textoDe(v);
    if (!texto || !pergunta?.opcoes?.length) return texto;
    const achar = (t) => pergunta.opcoes.find((o) => normalizar(o) === normalizar(t));
    if (pergunta.tipo === "varias") {
      const partes = texto.split(/\s*[,;]\s*/).filter(Boolean);
      const opcoes = partes.map(achar);
      return opcoes.every(Boolean) ? [...new Set(opcoes)] : texto;
    }
    return achar(texto) || texto;
  }

  // Identifica a linha, para não importar a mesma resposta duas vezes.
  function assinatura(linha) {
    const s = JSON.stringify(linha.map(textoDe));
    let h = 5381;
    for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
    return `h${(h >>> 0).toString(36)}${s.length.toString(36)}`;
  }

  /* Tela */
  function opcoesDestino(col) {
    const usados = new Set(colunas.filter((c) => c !== col).map((c) => c.destino));
    const perguntas = formulario.perguntas
      .map((q) => `<option value="${esc(q.id)}" ${col.destino === q.id ? "selected" : ""} ${usados.has(q.id) ? "disabled" : ""}>${esc(q.texto)}</option>`)
      .join("");
    return `
      <option value="${IGNORAR}" ${col.destino === IGNORAR ? "selected" : ""}>Ignorar esta coluna</option>
      <option value="${DATA}" ${col.destino === DATA ? "selected" : ""}>Data de envio</option>
      <option value="${NOVA}" ${col.destino === NOVA ? "selected" : ""}>Nova pergunta</option>
      <optgroup label="Perguntas do formulário">${perguntas}</optgroup>`;
  }

  const novas = () => linhas.filter((l) => !jaImportadas.has(assinatura(l)));

  function render() {
    $("planilha-colunas").innerHTML = colunas
      .map((c, i) => {
        const exemplo = textoDe(c.valores.find((v) => textoDe(v)) ?? "");
        return `
          <tr>
            <td>${esc(c.titulo) || "<span class='vazio'>(sem título)</span>"}</td>
            <td title="${esc(exemplo)}">${esc(exemplo) || "<span class='vazio'>vazia</span>"}</td>
            <td><select data-col="${i}">${opcoesDestino(c)}</select></td>
          </tr>`;
      })
      .join("");
    const n = novas().length;
    const puladas = linhas.length - n;
    $("planilha-resumo").textContent =
      `${linhas.length} resposta${linhas.length === 1 ? "" : "s"} na planilha para o formulário ${publicos[tipo].dos}` +
      (puladas ? ` · ${puladas} já importada${puladas === 1 ? "" : "s"} antes (serão puladas)` : "") +
      ". Confira para onde vai cada coluna.";
    $("planilha-confirmar").disabled = !n;
    $("planilha-confirmar").textContent = n ? `Importar ${n} resposta${n === 1 ? "" : "s"}` : "Nada novo para importar";
  }

  function aviso(texto, erro = false) {
    $("planilha-feedback").textContent = texto;
    $("planilha-feedback").classList.toggle("erro", erro);
  }

  /* Eventos */
  $("planilha-abrir").addEventListener("click", () => {
    $("planilha-arquivo").value = "";
    $("planilha-arquivo").click();
  });

  $("planilha-arquivo").addEventListener("change", async () => {
    const arquivo = $("planilha-arquivo").files[0];
    if (!arquivo) return;
    tipo = tipoAtual();
    $("form-situacao").className = "urna-situacao";
    $("form-situacao").textContent = "Lendo a planilha…";
    try {
      const XLSX = await Exportar.carregar();
      const livro = XLSX.read(await arquivo.arrayBuffer(), { cellDates: true });
      const aba = livro.Sheets[livro.SheetNames[0]];
      const tabela = XLSX.utils.sheet_to_json(aba, { header: 1, raw: true, defval: "" }).filter((l) => l.some((v) => textoDe(v)));
      if (tabela.length < 2) throw new Error("A planilha não tem respostas (só o cabeçalho ou nada).");
      const [cabecalho, ...dados] = tabela;
      const largura = Math.max(...tabela.map((l) => l.length));
      linhas = dados.map((l) => Array.from({ length: largura }, (_, i) => l[i] ?? ""));
      [formulario, jaImportadas] = await Promise.all([API.lerFormulario(tipo), API.assinaturasImportadas(tipo)]);
      colunas = Array.from({ length: largura }, (_, i) => {
        const titulo = textoDe(cabecalho[i]);
        const valores = linhas.map((l) => l[i]);
        return { titulo, valores, destino: destinoInicial(titulo, valores) };
      });
      // Uma pergunta só recebe uma coluna: as repetidas viram "Nova pergunta".
      const vistos = new Set();
      for (const c of colunas) {
        if ([IGNORAR, DATA, NOVA].includes(c.destino)) continue;
        if (vistos.has(c.destino)) c.destino = NOVA;
        vistos.add(c.destino);
      }
      $("planilha-titulo").textContent = `Importar planilha: ${arquivo.name}`;
      aviso("");
      render();
      $("form-situacao").textContent = "";
      $("planilha").showModal();
    } catch (erro) {
      console.error(erro);
      $("form-situacao").className = "urna-situacao alerta";
      $("form-situacao").textContent = `Não consegui ler a planilha. ${erro.message}`;
    }
  });

  $("planilha-colunas").addEventListener("change", (e) => {
    const sel = e.target.closest("[data-col]");
    if (!sel) return;
    colunas[Number(sel.dataset.col)].destino = sel.value;
    render();
  });

  const fechar = () => $("planilha").close();
  $("planilha-fechar").addEventListener("click", fechar);
  $("planilha-cancelar").addEventListener("click", fechar);

  $("planilha-confirmar").addEventListener("click", async () => {
    $("planilha-confirmar").disabled = true;
    aviso("Importando…");
    try {
      // Perguntas novas entram no fim do formulário.
      const perguntas = formulario.perguntas.map((q) => ({ ...q }));
      colunas.forEach((c, i) => {
        if (c.destino !== NOVA) return;
        const base = normalizar(c.titulo).replace(/[^a-z0-9]+/g, "_").slice(0, 24) || `coluna_${i + 1}`;
        let id = `pl_${base}`;
        while (perguntas.some((q) => q.id === id)) id += "_";
        const titulo = c.titulo.replace(/\s*:\s*$/, "") || `Coluna ${i + 1}`;
        perguntas.push({ id, texto: titulo, obrigatoria: false, ...inferirTipo(titulo, c.valores) });
        c.destino = id;
      });
      const porId = Object.fromEntries(perguntas.map((q) => [q.id, q]));
      const colData = colunas.findIndex((c) => c.destino === DATA);

      const paraGravar = novas().map((l) => {
        const respostas = {};
        colunas.forEach((c, i) => {
          const q = porId[c.destino];
          if (!q) return;
          const v = converter(l[i], q);
          if (Array.isArray(v) ? v.length : v) respostas[q.id] = { p: q.texto, v };
        });
        return { enviadoEm: (colData >= 0 && dataDe(l[colData])) || Date.now(), respostas, planilha: assinatura(l) };
      });

      const mudouFormulario = perguntas.length !== formulario.perguntas.length || !formulario.salvo;
      if (mudouFormulario) {
        const { titulo, descricao, aberto } = formulario;
        const limpas = perguntas.map(({ id, texto, tipo: t, obrigatoria, opcoes, ajuda, exemplo, apenasNome }) => ({
          id, texto, tipo: tiposPergunta.some((x) => x.id === t) ? t : "curta", obrigatoria: !!obrigatoria,
          ...(opcoes?.length ? { opcoes } : {}), ...(ajuda ? { ajuda } : {}), ...(exemplo ? { exemplo } : {}), ...(apenasNome ? { apenasNome: true } : {}),
        }));
        await API.salvarFormulario(tipo, { titulo, descricao, aberto, perguntas: limpas });
      }
      await API.importarInscricoes(tipo, paraGravar);
      fechar();
      PainelFormularios.recarregar();
      $("form-situacao").className = "urna-situacao ok";
      $("form-situacao").textContent = `${paraGravar.length} resposta${paraGravar.length === 1 ? "" : "s"} importada${paraGravar.length === 1 ? "" : "s"} da planilha.`;
    } catch (erro) {
      console.error(erro);
      aviso(`Não consegui importar. ${erro.message}`, true);
      $("planilha-confirmar").disabled = false;
    }
  });
})();
