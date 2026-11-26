// Placas de mesa dos projetos: uma folha A4 por projeto, para dobrar ao meio.
// A metade de cima sai de cabeça para baixo, assim a placa dobrada fica legível dos dois lados.
window.Placas = (() => {
  const L = 210; // A4 em mm
  const A = 297;
  const DOBRA = A / 2;
  const CINZA = [170, 170, 170];
  // Placa de baixo (a de cima é a mesma girada 180° em volta do centro da folha).
  const CAIXA = { x: 9.5, y: DOBRA + 7.5, l: L - 19, a: 62 };
  const MARGEM_TEXTO = 10;
  const PT = 0.3528; // mm por ponto

  // Maior fonte em que o texto cabe: numa linha só até "quebrarAbaixo"; abaixo disso, em até "linhas" linhas.
  function caber(doc, texto, { fonte, estilo, maximo, minimo, largura, linhas = 1, quebrarAbaixo = minimo }) {
    doc.setFont(fonte, estilo);
    for (let t = maximo; t >= minimo; t -= 1) {
      doc.setFontSize(t);
      if (doc.getTextWidth(texto) <= largura) return { tamanho: t, linhas: [texto] };
      if (t <= quebrarAbaixo) {
        const partes = doc.splitTextToSize(texto, largura);
        if (partes.length <= linhas) return { tamanho: t, linhas: partes };
      }
    }
    // Último recurso: corta o que não couber.
    doc.setFontSize(minimo);
    const partes = doc.splitTextToSize(texto, largura).slice(0, linhas);
    partes[linhas - 1] = `${partes[linhas - 1].replace(/\s*\S*$/, "")}…`;
    return { tamanho: minimo, linhas: partes };
  }

  function desenharPlaca(doc, projeto) {
    // Escreve na placa de baixo e repete, girado, na de cima.
    const escrever = (texto, x, y, fonte, estilo, tamanho) => {
      doc.setFont(fonte, estilo);
      doc.setFontSize(tamanho);
      doc.text(texto, x, y);
      doc.text(texto, L - x, A - y, { angle: 180 });
    };
    const centro = (texto) => CAIXA.x + (CAIXA.l - doc.getTextWidth(texto)) / 2;

    // Linhas de corte e de dobra, e as molduras.
    doc.setDrawColor(...CINZA);
    doc.setLineWidth(0.6);
    for (const y of [DOBRA - 74, DOBRA, DOBRA + 74]) doc.line(0, y, L, y);
    doc.rect(CAIXA.x, CAIXA.y, CAIXA.l, CAIXA.a);
    doc.rect(L - CAIXA.x - CAIXA.l, A - CAIXA.y - CAIXA.a, CAIXA.l, CAIXA.a);

    doc.setTextColor(0, 0, 0);
    const largura = CAIXA.l - 2 * MARGEM_TEXTO;
    const nome = caber(doc, projeto.nome || `Projeto ${projeto.codigo}`, { fonte: "times", estilo: "bold", maximo: 54, minimo: 24, largura, linhas: 3, quebrarAbaixo: 38 });
    const disciplina = projeto.disciplina
      ? caber(doc, `(${projeto.disciplina})`, { fonte: "times", estilo: "normal", maximo: 18, minimo: 10, largura: largura - 30 })
      : null;

    // Uma linha de nome: como na placa modelo. Duas ou três: o bloco sobe para caber a disciplina.
    const alturaNome = nome.tamanho * PT * 1.08;
    let y = CAIXA.y + [30, 22, 15][nome.linhas.length - 1];
    for (const linha of nome.linhas) {
      doc.setFont("times", "bold");
      doc.setFontSize(nome.tamanho);
      escrever(linha, centro(linha), y, "times", "bold", nome.tamanho);
      y += alturaNome;
    }
    if (disciplina) {
      const linha = disciplina.linhas[0];
      doc.setFont("times", "normal");
      doc.setFontSize(disciplina.tamanho);
      escrever(linha, centro(linha), y - alturaNome + 13.5, "times", "normal", disciplina.tamanho);
    }

    // Código de votação no canto, como "16B".
    doc.setFont("helvetica", "bold");
    doc.setFontSize(34);
    const codigo = String(projeto.codigo);
    escrever(codigo, CAIXA.x + CAIXA.l - 6 - doc.getTextWidth(codigo), CAIXA.y + CAIXA.a - 6.5, "helvetica", "bold", 34);
  }

  async function documento(projetos, titulo = "Placas de mesa") {
    const jsPDF = await PDF.bibliotecas();
    const doc = new jsPDF({ unit: "mm", format: "a4" });
    projetos.forEach((p, i) => {
      if (i > 0) doc.addPage();
      desenharPlaca(doc, p);
    });
    doc.setProperties({ title: titulo, creator: "PET Elétrica UFPB" });
    return doc;
  }

  // nomeArquivo sem a data e sem ".pdf"
  async function baixar(projetos, nomeArquivo = "placas-de-mesa", titulo) {
    (await documento(projetos, titulo)).save(`${nomeArquivo}-${new Date().toISOString().slice(0, 10)}.pdf`);
  }

  // O PDF em bytes, para juntar vários num .zip.
  const bytes = async (projetos, titulo) => (await documento(projetos, titulo)).output("arraybuffer");

  return { baixar, bytes };
})();
