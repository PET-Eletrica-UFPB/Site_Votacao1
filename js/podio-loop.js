// Loop do Modo Pódio: pódio → planta → QR code → pódio…, cada tela por alguns segundos.
// A planta é um PNG escolhido aqui (guardado no próprio aparelho, no IndexedDB) e o QR code
// usa os mesmos destinos da aba "QR codes" da Área dos Petianos. Usa $ de podio.js.
(() => {
  const BIBLIOTECA_QR = "https://cdnjs.cloudflare.com/ajax/libs/qrcode-generator/1.4.4/qrcode.min.js";
  const CHAVE = "feira-pet:podio-loop";
  const DESTINOS = window.FEIRA.destinosQr;
  const CENAS = ["cena-podio", "cena-planta", "cena-qr"];

  const padrao = () => {
    const d = DESTINOS[0];
    return { ativo: false, destino: d.id, link: linkDaPagina(d.pagina), titulo: d.titulo, texto: d.texto, tempo: 20, deitada: false };
  };
  const linkDaPagina = (pagina) => new URL(pagina, location.href).href.replace(/[?#].*$/, "");
  const valido = (t) => /^https?:\/\/\S+\.\S+/.test(t);

  function lerConfig() {
    try {
      return { ...padrao(), ...JSON.parse(localStorage.getItem(CHAVE)) };
    } catch {
      return padrao();
    }
  }
  function guardarConfig() {
    try {
      localStorage.setItem(CHAVE, JSON.stringify(config));
    } catch {
      // sem armazenamento, o loop dura até recarregar a página
    }
  }

  /* Planta: o arquivo fica no IndexedDB (pode passar do limite do localStorage). */
  function banco() {
    return new Promise((ok, falha) => {
      const pedido = indexedDB.open("feira-pet-podio", 1);
      pedido.onupgradeneeded = () => pedido.result.createObjectStore("arquivos");
      pedido.onsuccess = () => ok(pedido.result);
      pedido.onerror = () => falha(pedido.error);
    });
  }
  async function arquivo(acao, valor) {
    const db = await banco();
    return new Promise((ok, falha) => {
      const t = db.transaction("arquivos", acao === "ler" ? "readonly" : "readwrite");
      const loja = t.objectStore("arquivos");
      const pedido = acao === "ler" ? loja.get("planta") : loja.put(valor, "planta");
      pedido.onsuccess = () => ok(pedido.result);
      pedido.onerror = () => falha(pedido.error);
    });
  }

  let config = lerConfig();
  let planta = null; // { blob, nome }
  let urlPlanta = null;
  let cena = 0;
  let relogio = null;

  function mostrarPlanta() {
    if (urlPlanta) URL.revokeObjectURL(urlPlanta);
    urlPlanta = planta ? URL.createObjectURL(planta.blob) : null;
    $("planta-img").src = urlPlanta || "";
    $("planta-img").classList.toggle("deitada", !!config.deitada);
    $("loop-planta-previa").hidden = !urlPlanta;
    if (urlPlanta) $("loop-planta-previa").src = urlPlanta;
    $("loop-planta-nome").textContent = planta
      ? `${planta.nome} (salvo neste aparelho)`
      : "Nenhum arquivo escolhido. Gere o PNG em Área dos Petianos → Projetos → Planta da feira → Baixar PNG.";
  }

  /* QR code em SVG: nítido em qualquer tamanho de TV. */
  function carregarQr() {
    if (window.qrcode) return Promise.resolve(window.qrcode);
    return new Promise((ok, falha) => {
      const s = document.createElement("script");
      s.src = BIBLIOTECA_QR;
      s.onload = () => ok(window.qrcode);
      s.onerror = () => falha(new Error("Sem internet para gerar o QR code."));
      document.head.append(s);
    });
  }
  async function desenharQr() {
    $("qr-titulo").textContent = config.titulo;
    $("qr-texto").textContent = config.texto;
    $("qr-endereco").textContent = config.link.replace(/^https?:\/\//, "");
    const qrcode = await carregarQr();
    const qr = qrcode(0, "M");
    qr.addData(config.link);
    qr.make();
    const n = qr.getModuleCount();
    let caminho = "";
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (qr.isDark(r, c)) caminho += `M${c + 4} ${r + 4}h1v1h-1z`;
    $("qr-quadro").innerHTML = `<svg viewBox="0 0 ${n + 8} ${n + 8}" shape-rendering="crispEdges" role="img" aria-label="QR code para ${config.link}"><rect width="100%" height="100%" fill="#fff"/><path d="${caminho}" fill="#0c065c"/></svg>`;
  }

  /* Troca de telas */
  function irPara(i) {
    cena = i;
    CENAS.forEach((id, j) => $(id).classList.toggle("ativa", j === i));
    const barras = $("loop-progresso").children;
    [...barras].forEach((b, j) => {
      b.className = j < i ? "feita" : "";
      if (j === i) {
        void b.offsetWidth; // reinicia a animação
        b.className = "atual";
      }
    });
  }
  function proxima() {
    // Sem planta, pula essa tela.
    let i = (cena + 1) % CENAS.length;
    if (CENAS[i] === "cena-planta" && !planta) i = (i + 1) % CENAS.length;
    irPara(i);
  }

  function ligar() {
    clearInterval(relogio);
    document.body.classList.add("em-loop");
    document.body.style.setProperty("--tempo-cena", `${config.tempo}s`);
    $("loop-progresso").hidden = false;
    $("loop").textContent = "Loop ligado";
    desenharQr().catch((erro) => console.error(erro));
    irPara(0);
    relogio = setInterval(proxima, config.tempo * 1000);
  }
  function desligar() {
    clearInterval(relogio);
    relogio = null;
    document.body.classList.remove("em-loop");
    $("loop-progresso").hidden = true;
    $("loop").textContent = "Loop";
    irPara(0);
  }

  /* Janela de configuração */
  function preencher() {
    $("loop-destino").innerHTML = DESTINOS.map((d) => `<option value="${d.id}">${API.esc(d.nome)}</option>`).join("");
    $("loop-destino").value = config.destino;
    $("loop-link").value = config.link;
    $("loop-link").readOnly = config.destino !== "outro";
    $("loop-titulo").value = config.titulo;
    $("loop-texto").value = config.texto;
    $("loop-tempo").value = config.tempo;
    $("loop-deitada").checked = !!config.deitada;
    $("loop-parar").hidden = !config.ativo;
    $("loop-iniciar").textContent = config.ativo ? "Salvar e reiniciar" : "Iniciar loop";
    $("loop-feedback").textContent = "";
  }

  function feedback(texto, erro = false) {
    $("loop-feedback").textContent = texto;
    $("loop-feedback").classList.toggle("erro", erro);
  }

  $("loop").addEventListener("click", () => {
    preencher();
    $("loop-dialogo").showModal();
  });
  $("loop-fechar").addEventListener("click", () => $("loop-dialogo").close());

  $("loop-destino").addEventListener("change", (e) => {
    const d = DESTINOS.find((x) => x.id === e.target.value) || DESTINOS[0];
    $("loop-link").value = d.pagina ? linkDaPagina(d.pagina) : "https://";
    $("loop-link").readOnly = !!d.pagina;
    $("loop-titulo").value = d.titulo;
    $("loop-texto").value = d.texto;
  });

  $("loop-planta").addEventListener("change", async (e) => {
    const f = e.target.files[0];
    if (!f) return;
    if (!/^image\/(png|jpeg)$/.test(f.type)) return feedback("Escolha um arquivo PNG (ou JPG) da planta.", true);
    planta = { blob: f, nome: f.name };
    mostrarPlanta();
    try {
      await arquivo("gravar", planta);
      feedback("");
    } catch (erro) {
      console.error(erro);
      feedback("A planta vale só até recarregar a página (o navegador não deixou guardar o arquivo).", true);
    }
  });
  $("loop-deitada").addEventListener("change", (e) => $("planta-img").classList.toggle("deitada", e.target.checked));

  $("loop-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const link = $("loop-link").value.trim();
    if (!valido(link)) return feedback("Digite um link completo para o QR code, começando com https://", true);
    if (!planta) return feedback("Escolha o arquivo PNG da planta.", true);
    const tempo = Math.min(300, Math.max(5, Math.round(Number($("loop-tempo").value) || 20)));
    config = {
      ativo: true,
      destino: $("loop-destino").value,
      link,
      titulo: $("loop-titulo").value.trim(),
      texto: $("loop-texto").value.trim(),
      tempo,
      deitada: $("loop-deitada").checked,
    };
    guardarConfig();
    mostrarPlanta();
    $("loop-dialogo").close();
    ligar();
  });

  $("loop-parar").addEventListener("click", () => {
    config.ativo = false;
    guardarConfig();
    $("loop-dialogo").close();
    desligar();
  });

  /* Início: volta ao loop se ele estava ligado (a TV pode ter recarregado a página). */
  arquivo("ler")
    .catch(() => null)
    .then((salvo) => {
      planta = salvo?.blob ? salvo : null;
      mostrarPlanta();
      if (config.ativo) ligar();
    });
})();
