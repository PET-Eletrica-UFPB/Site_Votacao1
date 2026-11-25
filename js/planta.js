// Planta da feira, no modelo da planta 2026.2 (mesma disposição das mesas).
// Os locais são numerados: salas 1 a 6 do prédio e os corredores 7 a 9 com mesas.
// Cada disciplina vai para o automático, para um local escolhido ou fica fora (auditório).
// O mesmo desenho sai no PDF (jsPDF) e na prévia da Área dos Petianos (canvas).
window.Planta = (() => {
  const PAGINA = [1440, 810]; // pt, 16:9 como a original
  const PRETO = [0, 0, 0];
  const CINZA_MESA = [84, 84, 84];
  const CINZA_SALA = [166, 166, 166];
  const AMBAR = [238, 166, 20];
  const AZUL = [12, 6, 92];

  // Cores das disciplinas, na ordem da legenda original e depois algumas a mais.
  const CORES = [
    [66, 156, 66], [56, 182, 255], [249, 174, 20], [140, 82, 255], [255, 87, 87], [5, 1, 93],
    [226, 169, 241], [255, 145, 77], [193, 255, 114], [12, 192, 223], [150, 95, 50], [0, 150, 136],
    [233, 30, 99], [120, 144, 156], [205, 220, 57], [63, 81, 181],
  ];

  // Mesas: número, retângulo e onde vai o código ("esq"/"dir" fora da mesa, "cima" ou "dentro").
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
  const MESA = new Map(MESAS.map((m) => [m.n, m]));

  /* Locais numerados. curso: área a que pertencem (null = serve aos dois).
     caixa: interior da sala, onde vão os nomes quando ela não tem mesas. selo: onde fica o número. */
  const LOCAIS = [
    { id: 1, nome: "Sala 1 (esquerda, em cima)", mesas: [29, 30, 31, 32, 33, 34, 35, 36, 37], curso: "renovaveis", caixa: [62.5, 44, 295, 218.7], selo: [78, 61] },
    { id: 2, nome: "Sala 2 (esquerda)", mesas: [], curso: null, caixa: [62.5, 218.7, 295, 388.8], selo: [80, 237] },
    { id: 3, nome: "Sala 3 (esquerda)", mesas: [], curso: null, caixa: [62.5, 388.8, 295, 476.6], selo: [80, 407] },
    { id: 4, nome: "Sala 4 (esquerda, embaixo)", mesas: [], curso: null, caixa: [62.5, 476.6, 295, 569.9], selo: [80, 495] },
    { id: 5, nome: "Sala 5 (direita, em cima)", mesas: [10, 11, 12, 13, 14], curso: "eletrica", caixa: [697, 44, 929.5, 130.4], selo: [717, 62] },
    { id: 6, nome: "Sala 6 (direita, embaixo)", mesas: [], curso: null, caixa: [697, 389, 929.5, 569.9], selo: [717, 408] },
    { id: 7, nome: "Corredor 7 (lado Renováveis)", mesas: [21, 22, 23, 24, 25, 26, 27, 28], curso: "renovaveis", selo: [393, 141] },
    { id: 8, nome: "Fileira 8 (no alto do pátio)", mesas: [15, 16, 17, 18, 19, 20], curso: null, selo: [636, 96] },
    { id: 9, nome: "Corredor 9 (lado Elétrica)", mesas: [1, 2, 3, 4, 5, 6, 7, 8, 9], curso: "eletrica", selo: [656, 170] },
  ];
  const LOCAL = new Map(LOCAIS.map((l) => [l.id, l]));
  const TOTAL_MESAS = MESAS.length;
  const lado = (curso) => (curso === "renovaveis" ? "renovaveis" : "eletrica");
  const nomeCurto = (l) => l.nome.replace(/\s*\(.*\)$/, "");

  /* Distribuição.
     disciplinas: [{ nome, curso, local: "auto" | "fora" | 1..9, projetos: [{ codigo, nome }] }]
     1) as que têm local escolhido ocupam as mesas dele (ou ficam escritas na sala, se ela não tem mesas);
     2) as automáticas vão inteiras para um único local sempre que couber, maiores primeiro,
        preferindo os locais da área do seu curso; só se nenhum couber, dividem entre locais. */
  function distribuir(disciplinas) {
    const livres = new Map(LOCAIS.map((l) => [l.id, [...l.mesas]]));
    const mesaDe = new Map(); // código → nº da mesa
    const localDe = new Map(); // código → id do local
    const naSala = new Map(); // id da sala sem mesas → [disciplina]
    const semMesa = [];
    const pegar = (id, d) => {
      const fila = livres.get(id);
      // Na fileira 8, que é das duas áreas, Renováveis entra pela ponta do lado dela.
      return id === 8 && lado(d.curso) === "renovaveis" ? fila.pop() : fila.shift();
    };
    const colocar = (d, p, id) => {
      const n = pegar(id, d);
      if (!n) return false;
      mesaDe.set(p.codigo, n);
      localDe.set(p.codigo, id);
      return true;
    };

    for (const d of disciplinas.filter((x) => Number.isInteger(x.local))) {
      const l = LOCAL.get(d.local);
      if (!l.mesas.length) {
        if (!naSala.has(l.id)) naSala.set(l.id, []);
        naSala.get(l.id).push(d);
        d.projetos.forEach((p) => localDe.set(p.codigo, l.id));
        continue;
      }
      for (const p of d.projetos) if (!colocar(d, p, l.id)) semMesa.push(p);
    }

    const automaticas = disciplinas
      .filter((x) => x.local === "auto" && x.projetos.length)
      .sort((a, b) => b.projetos.length - a.projetos.length || a.nome.localeCompare(b.nome, "pt-BR"));
    for (const d of automaticas) {
      const preferencia = (l) => (l.curso === lado(d.curso) ? 0 : l.curso === null ? 1 : 2);
      const comMesas = LOCAIS.filter((l) => l.mesas.length);
      const cabe = comMesas
        .filter((l) => livres.get(l.id).length >= d.projetos.length)
        .sort((a, b) => preferencia(a) - preferencia(b) || livres.get(a.id).length - livres.get(b.id).length);
      if (cabe.length) {
        d.projetos.forEach((p) => colocar(d, p, cabe[0].id));
        continue;
      }
      const ordem = comMesas.sort((a, b) => preferencia(a) - preferencia(b) || livres.get(b.id).length - livres.get(a.id).length);
      for (const p of d.projetos) if (!ordem.some((l) => colocar(d, p, l.id))) semMesa.push(p);
    }
    return { mesaDe, localDe, naSala, semMesa };
  }

  /* Pintor para canvas com os mesmos métodos do jsPDF usados aqui. */
  function pintorCanvas(canvas) {
    const ctx = canvas.getContext("2d");
    const escala = canvas.width / PAGINA[0];
    ctx.setTransform(escala, 0, 0, escala, 0, 0);
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, PAGINA[0], PAGINA[1]);
    const rgb = (c) => `rgb(${c[0]},${c[1]},${c[2]})`;
    let fonte = { estilo: "bold", tamanho: 12 };
    const aplicarFonte = () => (ctx.font = `${fonte.estilo === "bold" ? "bold " : ""}${fonte.tamanho}px Helvetica, Arial, sans-serif`);
    const desenhar = (estilo) => {
      if (estilo.includes("F")) ctx.fill();
      if (estilo.includes("D") || estilo === "S") ctx.stroke();
    };
    return {
      setDrawColor: (...c) => (ctx.strokeStyle = rgb(c)),
      setFillColor: (...c) => (ctx.fillStyle = rgb(c)),
      setTextColor: (...c) => (ctx.textColor = rgb(c)),
      setLineWidth: (w) => (ctx.lineWidth = w),
      setLineCap: (c) => (ctx.lineCap = c),
      line(x1, y1, x2, y2) {
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
      },
      rect(x, y, w, h, estilo = "S") {
        ctx.beginPath();
        ctx.rect(x, y, w, h);
        desenhar(estilo);
      },
      circle(x, y, r, estilo = "S") {
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        desenhar(estilo);
      },
      lines(segmentos, x, y, _escala, estilo = "S") {
        ctx.beginPath();
        ctx.moveTo(x, y);
        let px = x;
        let py = y;
        for (const s of segmentos) {
          ctx.bezierCurveTo(px + s[0], py + s[1], px + s[2], py + s[3], px + s[4], py + s[5]);
          px += s[4];
          py += s[5];
        }
        desenhar(estilo);
      },
      setFont(_familia, estilo) {
        fonte = { ...fonte, estilo };
        aplicarFonte();
      },
      setFontSize(t) {
        fonte = { ...fonte, tamanho: t };
        aplicarFonte();
      },
      getTextWidth: (t) => ctx.measureText(t).width,
      splitTextToSize(t, largura) {
        const linhas = [];
        let atual = "";
        for (const palavra of String(t).split(/\s+/)) {
          const teste = atual ? `${atual} ${palavra}` : palavra;
          if (atual && ctx.measureText(teste).width > largura) {
            linhas.push(atual);
            atual = palavra;
          } else atual = teste;
        }
        if (atual) linhas.push(atual);
        return linhas;
      },
      text(t, x, y, { align = "left", baseline = "alphabetic" } = {}) {
        const antes = ctx.fillStyle;
        ctx.fillStyle = ctx.textColor || "#000";
        ctx.textAlign = align;
        ctx.textBaseline = baseline;
        for (const [i, linha] of (Array.isArray(t) ? t : [t]).entries()) ctx.fillText(linha, x, y + i * fonte.tamanho * 1.15);
        ctx.fillStyle = antes;
      },
    };
  }

  const escura = ([r, g, b]) => 0.299 * r + 0.587 * g + 0.114 * b < 140;
  const clara = (c, t = 0.8) => c.map((v) => Math.round(v + (255 - v) * t));

  function texto(doc, t, x, y, tamanho, opcoes = {}) {
    doc.setFont("helvetica", opcoes.normal ? "normal" : "bold");
    doc.setFontSize(tamanho);
    doc.setTextColor(...(opcoes.cor || PRETO));
    doc.text(t, x, y, { align: opcoes.align || "left", baseline: opcoes.baseline || "alphabetic" });
  }

  // Diminui a fonte até o texto caber na largura.
  function caber(doc, t, tamanho, largura, minimo = 7) {
    doc.setFont("helvetica", "bold");
    let s = tamanho;
    doc.setFontSize(s);
    while (s > minimo && doc.getTextWidth(t) > largura) doc.setFontSize((s -= 0.5));
    return s;
  }

  /* Estrutura: paredes, salas, entrada, urnas e áreas (igual à original). */
  function estrutura(doc) {
    const parede = (x1, y1, x2, y2, largura) => {
      doc.setLineWidth(largura);
      doc.line(x1, y1, x2, y2);
    };
    doc.setDrawColor(...PRETO);
    doc.setLineCap("butt");
    doc.setFillColor(...CINZA_SALA);
    doc.rect(695.6, 130.4, 233.9, 258.6, "F"); // LABFILM

    doc.setLineWidth(3);
    doc.rect(62.5, 44, 232.5, 525, "S");
    doc.rect(697, 44, 231, 525, "S");
    for (const y of [218.7, 388.8, 476.6]) parede(61, y, 295, y, 5);
    for (const y of [130.4, 389]) parede(695.6, y, 929.5, y, 6);
    parede(295, 42.5, 295, 569.9, 5);
    parede(293, 45, 697.5, 42.6, 3.5);
    parede(695.8, 42.5, 695.8, 674.3, 4.5);

    doc.setLineWidth(1.6);
    arco(doc, 493.2, 578.2, 98);
    doc.setLineWidth(1.2);
    arco(doc, 490.15, 587.4, 81.45);
    parede(395.2, 577.4, 395.2, 674.3, 3.5);
    parede(591.2, 577.4, 591.2, 674.3, 3.5);
    parede(591.2, 672.5, 697.5, 672.5, 3.5);
    parede(408.7, 586.9, 408.7, 667.3, 2.5);
    parede(571.6, 586.9, 571.6, 667.3, 2);

    parede(295, 698.6, 295, 807.3, 4);
    doc.setFillColor(...CINZA_SALA);
    doc.setDrawColor(...CINZA_MESA);
    doc.setLineWidth(1);
    doc.rect(314.1, 711.6, 20.8, 74.9, "FD");
    texto(doc, "urnas", 354.1, 757, 21.6);
    texto(doc, "Entrada", 223.3, 623.5, 14.7);
    texto(doc, "LABFILM", 742.8, 273.5, 32.3);

    tracejado(doc, [49.5, 35, 536, 582], [137, 217, 87], [204, 227, 102], 3, 11.5, 3.5);
    tracejado(doc, [541, 34, 943, 582], [92, 223, 230], [1, 75, 173], 4.5, 13.5, 4.5);
  }

  // Semicírculo de cima com centro (cx, cy).
  function arco(doc, cx, cy, r) {
    const k = 0.5523 * r;
    doc.lines([[0, -k, r - k, -r, r, -r], [k, 0, r, r - k, r, r]], cx - r, cy, [1, 1], "S");
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

  /* Salas sem mesas que receberam disciplinas: fundo na cor e os nomes escritos dentro. */
  function fundosDasSalas(doc, naSala, corDe) {
    for (const [id, lista] of naSala) {
      const [x0, y0, x1, y1] = LOCAL.get(id).caixa;
      doc.setFillColor(...clara(corDe.get(lista[0]), 0.82));
      doc.rect(x0, y0, x1 - x0, y1 - y0, "F");
    }
  }

  function textosDasSalas(doc, naSala) {
    for (const [id, lista] of naSala) {
      const [x0, y0, x1, y1] = LOCAL.get(id).caixa;
      const largura = x1 - x0 - 48;
      let y = y0 + 26;
      for (const d of lista) {
        if (y > y1 - 14) break;
        const s = caber(doc, d.nome, 14, largura, 9);
        texto(doc, d.nome, x0 + 34, y, s);
        y += 15;
        doc.setFont("helvetica", "normal");
        doc.setFontSize(11);
        const linhas = doc.splitTextToSize(d.projetos.map((p) => p.codigo).join(", "), largura);
        for (const linha of linhas) {
          if (y > y1 - 8) break;
          texto(doc, linha, x0 + 34, y, 11, { normal: true });
          y += 13;
        }
        y += 8;
      }
    }
  }

  // Número de cada local num círculo âmbar.
  function selos(doc) {
    for (const l of LOCAIS) {
      const [x, y] = l.selo;
      doc.setFillColor(...AMBAR);
      doc.setDrawColor(...AZUL);
      doc.setLineWidth(1.2);
      doc.circle(x, y, 11, "FD");
      texto(doc, String(l.id), x, y + 0.5, 13, { align: "center", baseline: "middle", cor: AZUL });
    }
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

  function legenda(doc, itens, edicao) {
    const x = 969.1;
    const topo = 72.3;
    const fim = 500;
    const passo = Math.min(38.6, (fim - topo) / (itens.length + 2));
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

  /* Tudo da primeira página. Devolve a distribuição para a lista. */
  function montar(disciplinas) {
    const incluidas = disciplinas.filter((d) => d.local !== "fora" && d.projetos.length);
    const resultado = distribuir(incluidas);
    const corDe = new Map(incluidas.map((d, i) => [d, CORES[i % CORES.length]]));
    const disciplinaDoProjeto = new Map(incluidas.flatMap((d) => d.projetos.map((p) => [p.codigo, d])));
    const projetoDaMesa = new Map();
    for (const d of incluidas) for (const p of d.projetos) if (resultado.mesaDe.has(p.codigo)) projetoDaMesa.set(resultado.mesaDe.get(p.codigo), p);
    return { ...resultado, incluidas, corDe, disciplinaDoProjeto, projetoDaMesa };
  }

  function desenharPlanta(doc, m, edicao) {
    fundosDasSalas(doc, m.naSala, m.corDe);
    estrutura(doc);
    mesas(doc, m.projetoDaMesa, (p) => m.corDe.get(m.disciplinaDoProjeto.get(p.codigo)));
    textosDasSalas(doc, m.naSala);
    selos(doc);
    legenda(doc, m.incluidas.map((d) => ({ cor: m.corDe.get(d), rotulo: d.nome })), edicao);
  }

  // Onde cada disciplina ficou, para mostrar na lista: { disciplina → "Corredor 9 · mesas 1–6" }
  function resumo(m) {
    const faixas = (numeros) => {
      const n = [...numeros].sort((a, b) => a - b);
      const partes = [];
      for (let i = 0; i < n.length; i++) {
        let j = i;
        while (j + 1 < n.length && n[j + 1] === n[j] + 1) j++;
        partes.push(i === j ? `${n[i]}` : `${n[i]}–${n[j]}`);
        i = j;
      }
      return partes.join(", ");
    };
    const porDisciplina = new Map();
    for (const d of m.incluidas) {
      const locais = [...new Set(d.projetos.map((p) => m.localDe.get(p.codigo)).filter(Boolean))];
      const mesas = d.projetos.map((p) => m.mesaDe.get(p.codigo)).filter(Boolean);
      const sem = d.projetos.filter((p) => !m.localDe.has(p.codigo)).length;
      const partes = locais.map((id) => nomeCurto(LOCAL.get(id)));
      let texto = partes.join(" + ");
      if (mesas.length) texto += ` · mesa${mesas.length === 1 ? "" : "s"} ${faixas(mesas)}`;
      if (sem) texto += `${texto ? " · " : ""}${sem} sem mesa`;
      porDisciplina.set(d, { texto, dividida: locais.length > 1, sem });
    }
    return porDisciplina;
  }

  /* Prévia no canvas (só a planta). */
  function previa(canvas, disciplinas, { edicao }) {
    const m = montar(disciplinas);
    desenharPlanta(pintorCanvas(canvas), m, edicao);
    return { ...m, porDisciplina: resumo(m) };
  }

  async function baixar(disciplinas, { edicao, cursos }) {
    const m = montar(disciplinas);
    const jsPDF = await PDF.bibliotecas();
    const doc = new jsPDF({ unit: "pt", format: PAGINA, orientation: "landscape" });
    desenharPlanta(doc, m, edicao);

    // Página 2: onde fica cada projeto
    doc.addPage(PAGINA, "landscape");
    texto(doc, `Onde fica cada projeto  ·  Feira - ${edicao}`, 48, 64, 26);
    const fora = disciplinas.filter((d) => d.local === "fora" && d.projetos.length).map((d) => d.nome);
    const nota = [
      `${m.mesaDe.size} de ${TOTAL_MESAS} mesas ocupadas.`,
      m.semMesa.length ? `${m.semMesa.length} projeto(s) ficaram sem mesa.` : "",
      fora.length ? `Fora da planta (auditório ou não participam): ${fora.join(", ")}.` : "",
    ].filter(Boolean).join("  ");
    doc.setFont("helvetica", "normal");
    doc.setFontSize(13);
    doc.setTextColor(80, 80, 80);
    doc.text(doc.splitTextToSize(nota, PAGINA[0] - 96), 48, 88);

    const linhas = m.incluidas
      .flatMap((d) => d.projetos.map((p) => ({ d, p, local: m.localDe.get(p.codigo), mesa: m.mesaDe.get(p.codigo) })))
      .sort((a, b) => (a.local ?? 99) - (b.local ?? 99) || (a.mesa ?? 99) - (b.mesa ?? 99) || m.incluidas.indexOf(a.d) - m.incluidas.indexOf(b.d));
    const onde = ({ local, mesa }) => (local ? `${nomeCurto(LOCAL.get(local))}${mesa ? ` · mesa ${mesa}` : ""}` : "Sem mesa");
    doc.autoTable({
      startY: 112,
      margin: { left: 48, right: 48, bottom: 40 },
      theme: "grid",
      head: [["", "Código", "Projeto", "Disciplina", "Curso", "Local"]],
      body: linhas.map((l) => ["", l.p.codigo, l.p.nome, l.d.nome, cursos.find((c) => c.id === l.d.curso)?.curto || "–", onde(l)]),
      styles: { font: "helvetica", fontSize: 12, cellPadding: 6, textColor: [30, 30, 46], lineColor: [222, 222, 232], lineWidth: 0.5, valign: "middle" },
      headStyles: { fillColor: AZUL, textColor: 255, fontStyle: "bold" },
      columnStyles: { 0: { cellWidth: 16 }, 1: { cellWidth: 70, fontStyle: "bold" }, 4: { cellWidth: 110 }, 5: { cellWidth: 170 } },
      didParseCell: (c) => {
        if (c.section !== "body") return;
        if (c.column.index === 0) c.cell.styles.fillColor = m.corDe.get(linhas[c.row.index].d);
        if (c.column.index === 5 && !linhas[c.row.index].local) c.cell.styles.textColor = [190, 110, 0];
      },
    });

    doc.setProperties({ title: `Planta da Feira - ${edicao}`, creator: "PET Elétrica UFPB" });
    doc.save(`planta-da-feira-${String(edicao).replace(/[^\w.-]+/g, "-")}.pdf`);
    return { ocupadas: m.mesaDe.size, semMesa: m.semMesa.length };
  }

  return { baixar, previa, LOCAIS, TOTAL_MESAS, PAGINA };
})();
