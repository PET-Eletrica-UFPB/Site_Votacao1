// Planta da feira em PDF, no modelo da planta 2026.2 (mesma disposição das mesas).
// Cada mesa recebe um projeto do pátio e mostra o código de votação; a cor é a da disciplina.
// A segunda página lista onde fica cada projeto (pátio, auditório ou sala).
window.Planta = (() => {
  const PAGINA = [1440, 810]; // pt, 16:9 como a original
  const PRETO = [0, 0, 0];
  const CINZA_MESA = [84, 84, 84];
  const CINZA_SALA = [166, 166, 166];

  // Cores das disciplinas, na ordem da legenda original e depois algumas a mais.
  const CORES = [
    [66, 156, 66], [56, 182, 255], [249, 174, 20], [140, 82, 255], [255, 87, 87], [5, 1, 93],
    [226, 169, 241], [255, 145, 77], [193, 255, 114], [12, 192, 223], [150, 95, 50], [0, 150, 136],
    [233, 30, 99], [120, 144, 156], [205, 220, 57], [63, 81, 181],
  ];

  // Mesas: número, retângulo [x0, y0, x1, y1] e onde vai o código.
  // lado: "esq"/"dir" (fora da mesa), "cima" (acima) ou "dentro".
  const MESAS = [
    [1, 647.4, 536.7, 664.6, 566.3, "esq", 17], [2, 647.4, 493.0, 664.6, 522.7, "esq", 17],
    [3, 647.4, 449.3, 664.6, 479.0, "esq", 17], [4, 647.4, 405.7, 664.6, 435.3, "esq", 17],
    [5, 647.4, 362.0, 664.6, 391.7, "esq", 17], [6, 647.4, 318.3, 664.6, 348.0, "esq", 17],
    [7, 647.4, 274.7, 664.6, 304.3, "esq", 17], [8, 647.4, 231.0, 664.6, 260.6, "esq", 17],
    [9, 647.4, 187.3, 664.6, 217.0, "esq", 17],
    [10, 755.3, 103.5, 791.0, 124.3, "dentro", 12], [11, 825.2, 103.5, 860.9, 124.3, "dentro", 12],
    [12, 883.4, 68.6, 904.1, 104.3, "dir", 10], [13, 825.2, 48.7, 860.9, 69.4, "dentro", 12],
    [14, 755.3, 48.7, 791.0, 69.4, "dentro", 12],
    [15, 585.0, 87.0, 614.7, 104.3, "cima", 16], [16, 541.4, 87.0, 571.0, 104.3, "cima", 16],
    [17, 497.7, 87.0, 527.3, 104.3, "cima", 16], [18, 454.0, 87.0, 483.7, 104.3, "cima", 16],
    [19, 410.3, 87.0, 440.0, 104.3, "cima", 16], [20, 366.7, 87.0, 396.3, 104.3, "cima", 16],
    [21, 349.4, 126.6, 366.6, 156.2, "esq", 19], [22, 349.4, 228.4, 366.6, 258.1, "esq", 19],
    [23, 349.4, 272.1, 366.6, 301.8, "esq", 19], [24, 349.4, 315.8, 366.6, 345.4, "esq", 19],
    [25, 349.4, 359.4, 366.6, 389.1, "esq", 19], [26, 349.4, 403.1, 366.6, 432.8, "esq", 19],
    [27, 349.4, 446.8, 366.6, 476.4, "esq", 19], [28, 349.4, 490.5, 366.6, 520.1, "esq", 19],
    [29, 171.6, 180.6, 207.3, 201.4, "dentro", 10.5], [30, 119.0, 180.6, 154.7, 201.4, "dentro", 10.5],
    [31, 81.1, 144.9, 101.8, 180.6, "dir", 10.5], [32, 81.1, 92.3, 101.8, 128.0, "dir", 10.5],
    [33, 107.1, 59.9, 142.8, 80.7, "dentro", 10.5], [34, 159.7, 59.9, 195.4, 80.7, "dentro", 10.5],
    [35, 212.3, 59.9, 248.0, 80.7, "dentro", 10.5], [36, 252.2, 92.3, 273.0, 128.0, "esq", 10.5],
    [37, 252.2, 144.9, 273.0, 180.6, "esq", 10.5],
  ].map(([n, x0, y0, x1, y1, lado, tamanho]) => ({ n, x0, y0, x1, y1, lado, tamanho }));

  // Área Elétrica: mesas 1 a 16; Área Renováveis: 17 a 37.
  const MESAS_DO_CURSO = {
    eletrica: MESAS.filter((m) => m.n <= 16).map((m) => m.n),
    renovaveis: MESAS.filter((m) => m.n >= 17).map((m) => m.n),
  };
  const TOTAL_MESAS = MESAS.length;

  /* Distribuição: disciplinas do pátio ocupam as mesas da área do seu curso, na ordem da lista.
     O que sobrar de um curso vai para as mesas livres da outra área. */
  function distribuir(disciplinas) {
    const doPatio = disciplinas.filter((d) => d.local === "patio");
    const livres = { eletrica: [...MESAS_DO_CURSO.eletrica], renovaveis: [...MESAS_DO_CURSO.renovaveis] };
    const mesaDe = new Map(); // código do projeto → nº da mesa
    const sobra = [];
    for (const curso of ["eletrica", "renovaveis"]) {
      for (const d of doPatio.filter((x) => (x.curso === "renovaveis" ? "renovaveis" : "eletrica") === curso)) {
        for (const p of d.projetos) {
          const n = livres[curso].shift();
          if (n) mesaDe.set(p.codigo, n);
          else sobra.push(p);
        }
      }
    }
    const semMesa = [];
    for (const p of sobra) {
      const outra = livres.eletrica.length ? "eletrica" : "renovaveis";
      const n = livres[outra].shift();
      if (n) mesaDe.set(p.codigo, n);
      else semMesa.push(p);
    }
    return { mesaDe, semMesa };
  }

  const escura = ([r, g, b]) => 0.299 * r + 0.587 * g + 0.114 * b < 140;

  /* Desenho da estrutura (paredes, salas, entrada, urnas, áreas). */
  function estrutura(doc) {
    const parede = (x1, y1, x2, y2, largura) => {
      doc.setLineWidth(largura);
      doc.line(x1, y1, x2, y2);
    };
    doc.setDrawColor(...PRETO);
    doc.setLineCap("butt");

    // LABFILM
    doc.setFillColor(...CINZA_SALA);
    doc.rect(695.6, 130.4, 233.9, 258.6, "F");

    // Prédio da esquerda (salas) e da direita
    doc.setLineWidth(3);
    doc.rect(62.5, 44, 232.5, 525, "S");
    doc.rect(697, 44, 231, 525, "S");
    for (const y of [218.7, 388.8, 476.6]) parede(61, y, 295, y, 5);
    for (const y of [130.4, 389]) parede(695.6, y, 929.5, y, 6);
    parede(295, 42.5, 295, 569.9, 5);
    parede(293, 45, 697.5, 42.6, 3.5);
    parede(695.8, 42.5, 695.8, 674.3, 4.5);

    // Entrada: arco duplo e corredor
    doc.setLineWidth(1.6);
    arco(doc, 493.2, 578.2, 98);
    doc.setLineWidth(1.2);
    arco(doc, 490.15, 587.4, 81.45);
    parede(395.2, 577.4, 395.2, 674.3, 3.5);
    parede(591.2, 577.4, 591.2, 674.3, 3.5);
    parede(591.2, 672.5, 697.5, 672.5, 3.5);
    parede(408.7, 586.9, 408.7, 667.3, 2.5);
    parede(571.6, 586.9, 571.6, 667.3, 2);

    // Urnas
    parede(295, 698.6, 295, 807.3, 4);
    doc.setFillColor(...CINZA_SALA);
    doc.setDrawColor(...CINZA_MESA);
    doc.setLineWidth(1);
    doc.rect(314.1, 711.6, 20.8, 74.9, "FD");
    texto(doc, "urnas", 354.1, 757, 21.6);
    texto(doc, "Entrada", 223.3, 623.5, 14.7);
    texto(doc, "LABFILM", 742.8, 273.5, 32.3);

    // Áreas tracejadas, com o degradê da original (da esquerda para a direita)
    tracejado(doc, [49.5, 35, 536, 582], [137, 217, 87], [204, 227, 102], 3, 11.5, 3.5);
    tracejado(doc, [541, 34, 943, 582], [92, 223, 230], [1, 75, 173], 4.5, 13.5, 4.5);
  }

  // Semicírculo de cima (de 180° a 360°) com centro (cx, cy).
  function arco(doc, cx, cy, r) {
    const k = 0.5523 * r;
    doc.lines(
      [
        [0, -k, r - k, -r, r, -r],
        [k, 0, r, r - k, r, r],
      ],
      cx - r,
      cy,
      [1, 1],
      "S"
    );
  }

  // Retângulo tracejado com a cor variando na horizontal.
  function tracejado(doc, [x0, y0, x1, y1], corA, corB, largura, traco, vao) {
    const cor = (x) => {
      const t = Math.min(1, Math.max(0, (x - x0) / (x1 - x0)));
      return corA.map((c, i) => Math.round(c + (corB[i] - c) * t));
    };
    doc.setLineWidth(largura);
    const lado = (ax, ay, bx, by) => {
      const comp = Math.hypot(bx - ax, by - ay);
      for (let s = 0; s < comp; s += traco + vao) {
        const e = Math.min(comp, s + traco);
        const px = ax + ((bx - ax) * s) / comp;
        const py = ay + ((by - ay) * s) / comp;
        const qx = ax + ((bx - ax) * e) / comp;
        const qy = ay + ((by - ay) * e) / comp;
        doc.setDrawColor(...cor((px + qx) / 2));
        doc.line(px, py, qx, qy);
      }
    };
    lado(x0, y0, x1, y0);
    lado(x1, y0, x1, y1);
    lado(x1, y1, x0, y1);
    lado(x0, y1, x0, y0);
  }

  function texto(doc, t, x, y, tamanho, opcoes = {}) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(tamanho);
    doc.setTextColor(...(opcoes.cor || PRETO));
    doc.text(t, x, y, { align: opcoes.align || "left", baseline: opcoes.baseline || "alphabetic" });
  }

  // Diminui a fonte até o texto caber na largura.
  function caber(doc, t, tamanho, largura) {
    doc.setFont("helvetica", "bold");
    let s = tamanho;
    doc.setFontSize(s);
    while (s > 7 && doc.getTextWidth(t) > largura) doc.setFontSize((s -= 0.5));
    return s;
  }

  /* Mesas com o código do projeto e a cor da disciplina. */
  function mesas(doc, projetoDaMesa, corDoProjeto) {
    for (const m of MESAS) {
      const p = projetoDaMesa.get(m.n);
      const cor = p ? corDoProjeto(p) : [255, 255, 255];
      doc.setFillColor(...cor);
      doc.setDrawColor(...CINZA_MESA);
      doc.setLineWidth(1);
      doc.rect(m.x0, m.y0, m.x1 - m.x0, m.y1 - m.y0, "FD");
      if (!p) continue;
      const codigo = String(p.codigo);
      const meioX = (m.x0 + m.x1) / 2;
      const meioY = (m.y0 + m.y1) / 2;
      if (m.lado === "dentro") {
        const s = caber(doc, codigo, m.tamanho, m.x1 - m.x0 - 4);
        texto(doc, codigo, meioX, meioY, s, { align: "center", baseline: "middle", cor: escura(cor) ? [255, 255, 255] : PRETO });
      } else if (m.lado === "cima") {
        const s = caber(doc, codigo, m.tamanho, 42);
        texto(doc, codigo, meioX, m.y0 - 4, s, { align: "center" });
      } else if (m.lado === "esq") {
        texto(doc, codigo, m.x0 - 5, meioY, m.tamanho, { align: "right", baseline: "middle" });
      } else {
        texto(doc, codigo, m.x1 + 3, meioY, m.tamanho, { baseline: "middle" });
      }
    }
  }

  /* Legenda: disciplinas (com o local, se não for o pátio), áreas e título. */
  function legenda(doc, itens, edicao) {
    const x = 969.1;
    const topo = 72.3;
    const fim = 500;
    const linhas = itens.length + 2;
    const passo = Math.min(38.6, (fim - topo) / linhas);
    const quadrado = Math.min(22.5, passo * 0.6);
    const tamanho = Math.min(18.5, passo * 0.5);
    texto(doc, "Legenda:", x, 54.2, 19.1);
    const largura = PAGINA[0] - (x + 44) - 18;
    const linha = (i, desenhar, rotulo) => {
      const y = topo + i * passo;
      desenhar(y);
      const s = caber(doc, rotulo, tamanho, largura);
      texto(doc, rotulo, x + 44, y + quadrado / 2, s, { baseline: "middle" });
    };
    itens.forEach((item, i) =>
      linha(i, (y) => {
        doc.setFillColor(...item.cor);
        doc.rect(x, y, quadrado, quadrado, "F");
      }, item.rotulo)
    );
    linha(itens.length, (y) => tracejado(doc, [x + 1, y + 1, x + quadrado + 6, y + quadrado], [137, 217, 87], [204, 227, 102], 2.5, 7, 3), "Área Renováveis");
    linha(itens.length + 1, (y) => tracejado(doc, [x + 1, y + 1, x + quadrado + 6, y + quadrado], [92, 223, 230], [1, 75, 173], 2.5, 7, 3), "Área Elétrica");
    texto(doc, "Planta da", x, 556.2, 34.9);
    texto(doc, `Feira - ${edicao}`, x, 590.7, 34.9);
  }

  const LOCAIS = { patio: "Pátio", auditorio: "Auditório", sala: "Sala" };
  const nomeDoLocal = (d) => (d.local === "sala" ? (d.sala ? `Sala ${d.sala.replace(/^sala\s+/i, "")}` : "Sala") : LOCAIS[d.local]);

  /* disciplinas: [{ nome, curso, local, sala, projetos: [{ codigo, nome }] }] na ordem da lista. */
  async function baixar(disciplinas, { edicao, cursos }) {
    const incluidas = disciplinas.filter((d) => d.local !== "fora" && d.projetos.length);
    const { mesaDe, semMesa } = distribuir(incluidas);
    const corDe = new Map(incluidas.map((d, i) => [d, CORES[i % CORES.length]]));
    const disciplinaDoProjeto = new Map(incluidas.flatMap((d) => d.projetos.map((p) => [p.codigo, d])));
    const projetoDaMesa = new Map();
    for (const d of incluidas) for (const p of d.projetos) if (mesaDe.has(p.codigo)) projetoDaMesa.set(mesaDe.get(p.codigo), p);

    const jsPDF = await PDF.bibliotecas();
    const doc = new jsPDF({ unit: "pt", format: PAGINA, orientation: "landscape" });

    estrutura(doc);
    mesas(doc, projetoDaMesa, (p) => corDe.get(disciplinaDoProjeto.get(p.codigo)));
    legenda(
      doc,
      incluidas.map((d) => ({ cor: corDe.get(d), rotulo: d.local === "patio" ? d.nome : `${d.nome} (${nomeDoLocal(d)})` })),
      edicao
    );

    // Página 2: onde fica cada projeto
    doc.addPage(PAGINA, "landscape");
    texto(doc, `Onde fica cada projeto  ·  Feira - ${edicao}`, 48, 64, 26);
    const fora = disciplinas.filter((d) => d.local === "fora" && d.projetos.length).map((d) => d.nome);
    const nota = [
      `${mesaDe.size} de ${TOTAL_MESAS} mesas do pátio ocupadas.`,
      semMesa.length ? `${semMesa.length} projeto(s) do pátio ficaram sem mesa: escolha outro local para alguma disciplina.` : "",
      fora.length ? `Fora da planta: ${fora.join(", ")}.` : "",
    ].filter(Boolean).join("  ");
    doc.setFont("helvetica", "normal");
    doc.setFontSize(13);
    doc.setTextColor(80, 80, 80);
    doc.text(doc.splitTextToSize(nota, PAGINA[0] - 96), 48, 88);

    const ordemLocal = (d) => ({ patio: 0, auditorio: 1, sala: 2 })[d.local];
    const linhas = incluidas
      .flatMap((d) => d.projetos.map((p) => ({ d, p, mesa: mesaDe.get(p.codigo) })))
      .sort((a, b) => ordemLocal(a.d) - ordemLocal(b.d) || nomeDoLocal(a.d).localeCompare(nomeDoLocal(b.d), "pt-BR") || (a.mesa ?? 99) - (b.mesa ?? 99) || incluidas.indexOf(a.d) - incluidas.indexOf(b.d));
    doc.autoTable({
      startY: 112,
      margin: { left: 48, right: 48, bottom: 40 },
      theme: "grid",
      head: [["", "Código", "Projeto", "Disciplina", "Curso", "Local"]],
      body: linhas.map(({ d, p, mesa }) => [
        "",
        p.codigo,
        p.nome,
        d.nome,
        cursos.find((c) => c.id === d.curso)?.curto || "–",
        d.local === "patio" ? (mesa ? `Pátio (mesa ${mesa})` : "Pátio: sem mesa") : nomeDoLocal(d),
      ]),
      styles: { font: "helvetica", fontSize: 12, cellPadding: 6, textColor: [30, 30, 46], lineColor: [222, 222, 232], lineWidth: 0.5, valign: "middle" },
      headStyles: { fillColor: [12, 6, 92], textColor: 255, fontStyle: "bold" },
      columnStyles: { 0: { cellWidth: 16 }, 1: { cellWidth: 70, fontStyle: "bold" }, 4: { cellWidth: 110 }, 5: { cellWidth: 170 } },
      didParseCell: (c) => {
        if (c.section === "body" && c.column.index === 0) c.cell.styles.fillColor = corDe.get(linhas[c.row.index].d);
        if (c.section === "body" && c.column.index === 5 && !linhas[c.row.index].mesa && linhas[c.row.index].d.local === "patio") {
          c.cell.styles.textColor = [190, 110, 0];
        }
      },
    });

    doc.setProperties({ title: `Planta da Feira - ${edicao}`, creator: "PET Elétrica UFPB" });
    doc.save(`planta-da-feira-${String(edicao).replace(/[^\w.-]+/g, "-")}.pdf`);
    return { ocupadas: mesaDe.size, semMesa: semMesa.length };
  }

  return { baixar, distribuir, TOTAL_MESAS, MESAS_DO_CURSO };
})();
