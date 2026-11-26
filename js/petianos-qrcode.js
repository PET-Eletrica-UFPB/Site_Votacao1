// Aba "QR codes" da Área dos Petianos: gera QR codes que abrem páginas do site (ou outro link),
// com prévia, imagem PNG e um cartaz A4 em PDF para imprimir. Usa $ e esc de petianos.js.
(() => {
  const BIBLIOTECA = "https://cdnjs.cloudflare.com/ajax/libs/qrcode-generator/1.4.4/qrcode.min.js";
  // Páginas do site: o link é montado a partir do endereço em que o site está publicado.
  const DESTINOS = window.FEIRA.destinosQr;
  const AZUL = [12, 6, 92];
  const AMBAR = [238, 166, 20];

  let iniciado = false;
  let destino = DESTINOS[0];

  function carregarBiblioteca() {
    if (window.qrcode) return Promise.resolve(window.qrcode);
    return new Promise((ok, falha) => {
      const s = document.createElement("script");
      s.src = BIBLIOTECA;
      s.onload = () => ok(window.qrcode);
      s.onerror = () => falha(new Error("Sem internet para baixar o gerador de QR code."));
      document.head.append(s);
    });
  }

  const linkDaPagina = (pagina) => new URL(pagina, location.href).href.replace(/[?#].*$/, "");

  // Matriz do QR code (true = quadradinho preto). Correção "M": aguenta um pouco de sujeira ou dobra.
  async function matriz(texto) {
    const qrcode = await carregarBiblioteca();
    const qr = qrcode(0, "M");
    qr.addData(texto);
    qr.make();
    const n = qr.getModuleCount();
    return Array.from({ length: n }, (_, r) => Array.from({ length: n }, (_, c) => qr.isDark(r, c)));
  }

  // Desenha a matriz num canvas, com a margem branca que os leitores precisam (4 módulos).
  function desenharCanvas(canvas, m, tamanho) {
    const n = m.length + 8;
    const modulo = Math.floor(tamanho / n);
    canvas.width = canvas.height = modulo * n;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = `rgb(${AZUL.join(",")})`;
    m.forEach((linha, r) => linha.forEach((preto, c) => preto && ctx.fillRect((c + 4) * modulo, (r + 4) * modulo, modulo, modulo)));
  }

  const link = () => $("qr-link").value.trim();
  const valido = (t) => /^https?:\/\/\S+\.\S+/.test(t);

  function situacao(texto, classe = "") {
    $("qr-situacao").className = `urna-situacao ${classe}`;
    $("qr-situacao").textContent = texto;
  }

  async function atualizar() {
    const t = link();
    $("qr-titulo-previa").textContent = $("qr-titulo").value.trim() || " ";
    $("qr-texto-previa").textContent = $("qr-texto").value.trim();
    $("qr-link-previa").textContent = t.replace(/^https?:\/\//, "");
    const ok = valido(t);
    ["qr-png", "qr-pdf", "qr-copiar"].forEach((id) => ($(id).disabled = !ok));
    if (!ok) {
      $("qr-canvas").getContext("2d").clearRect(0, 0, $("qr-canvas").width, $("qr-canvas").height);
      return situacao(t ? "Digite um link completo, começando com https://" : "Digite o link que o QR code vai abrir.", "alerta");
    }
    try {
      desenharCanvas($("qr-canvas"), await matriz(t), 560);
      situacao("");
    } catch (erro) {
      situacao(erro.message, "alerta");
    }
  }

  function escolher(id) {
    destino = DESTINOS.find((d) => d.id === id) || DESTINOS[0];
    $("qr-destino").value = destino.id;
    $("qr-link").value = destino.pagina ? linkDaPagina(destino.pagina) : "https://";
    $("qr-link").readOnly = !!destino.pagina;
    $("qr-titulo").value = destino.titulo;
    $("qr-texto").value = destino.texto;
    atualizar();
  }

  /* Downloads */
  const nomeArquivo = () => `qrcode-${destino.id}`;

  function baixarPng() {
    const grande = document.createElement("canvas");
    matriz(link()).then((m) => {
      desenharCanvas(grande, m, 1200);
      grande.toBlob((blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${nomeArquivo()}.png`;
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        situacao("Imagem PNG baixada.", "ok");
      });
    });
  }

  // Cartaz A4: faixa do PET, título, QR code grande e o link escrito embaixo.
  async function baixarPdf() {
    situacao("Gerando o cartaz…");
    const [m, jsPDF, logo] = await Promise.all([matriz(link()), PDF.bibliotecas(), logoDataUrl()]);
    const doc = new jsPDF({ unit: "mm", format: "a4" });
    const L = 210;
    doc.setFillColor(...AZUL);
    doc.rect(0, 0, L, 46, "F");
    doc.setFillColor(...AMBAR);
    doc.rect(0, 46, L, 1.6, "F");
    if (logo) doc.addImage(logo.url, "PNG", (L - 30 * logo.proporcao) / 2, 8, 30 * logo.proporcao, 30, "logo", "FAST");

    doc.setTextColor(...AZUL);
    doc.setFont("helvetica", "bold");
    const titulo = $("qr-titulo").value.trim();
    let y = 70;
    if (titulo) {
      doc.setFontSize(30);
      const linhas = doc.splitTextToSize(titulo, 170);
      doc.text(linhas, L / 2, y, { align: "center" });
      y += linhas.length * 12;
    }
    const texto = $("qr-texto").value.trim();
    if (texto) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(13);
      doc.setTextColor(70, 70, 90);
      const linhas = doc.splitTextToSize(texto, 150);
      doc.text(linhas, L / 2, y, { align: "center" });
      y += linhas.length * 6 + 4;
    }
    // QR code em vetor (nítido em qualquer impressora), com borda branca.
    const lado = 130;
    const n = m.length;
    const passo = lado / (n + 8);
    const x0 = (L - lado) / 2;
    const y0 = Math.max(y + 4, 100);
    doc.setDrawColor(...AMBAR);
    doc.setLineWidth(1.2);
    doc.roundedRect(x0 - 3, y0 - 3, lado + 6, lado + 6, 4, 4, "S");
    doc.setFillColor(...AZUL);
    m.forEach((linha, r) => linha.forEach((preto, c) => preto && doc.rect(x0 + (c + 4) * passo, y0 + (r + 4) * passo, passo + 0.02, passo + 0.02, "F")));

    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
    doc.setTextColor(110, 110, 128);
    doc.text(doc.splitTextToSize(link().replace(/^https?:\/\//, ""), 180), L / 2, y0 + lado + 14, { align: "center" });
    doc.setFontSize(9);
    doc.text("PET Elétrica UFPB  ·  Feira de Engenharia e Energia", L / 2, 287, { align: "center" });
    doc.setProperties({ title: titulo || "QR code", creator: "PET Elétrica UFPB" });
    doc.save(`${nomeArquivo()}-cartaz.pdf`);
    situacao("Cartaz em PDF baixado.", "ok");
  }

  async function logoDataUrl() {
    try {
      const blob = await (await fetch("img/logo-pet-compacto.png")).blob();
      const url = await new Promise((ok) => {
        const leitor = new FileReader();
        leitor.onload = () => ok(leitor.result);
        leitor.readAsDataURL(blob);
      });
      const img = await new Promise((ok, falha) => {
        const i = new Image();
        i.onload = () => ok(i);
        i.onerror = falha;
        i.src = url;
      });
      return { url, proporcao: img.width / img.height };
    } catch {
      return null;
    }
  }

  /* Eventos */
  function iniciar() {
    if (iniciado) return;
    iniciado = true;
    $("qr-destino").innerHTML = DESTINOS.map((d) => `<option value="${d.id}">${esc(d.nome)}</option>`).join("");
    escolher("avaliacao");
  }
  $("qr-destino").addEventListener("change", (e) => escolher(e.target.value));
  ["qr-link", "qr-titulo", "qr-texto"].forEach((id) => $(id).addEventListener("input", atualizar));
  $("qr-png").addEventListener("click", () => baixarPng());
  $("qr-pdf").addEventListener("click", () => baixarPdf().catch((erro) => situacao(`Não consegui gerar o cartaz. ${erro.message}`, "alerta")));
  $("qr-copiar").addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(link());
      situacao("Link copiado.", "ok");
    } catch {
      $("qr-link").select();
      situacao("Selecionei o link: copie com Ctrl+C.");
    }
  });
  document.querySelector('.painel-topo [data-aba="qrcodes"]').addEventListener("click", iniciar);
})();
