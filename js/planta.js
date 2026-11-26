// Planta da feira, no modelo da planta 2026.2 (mesma disposição das mesas).
// As salas do prédio são numeradas de 1 a 6; o pátio não tem número (as cores separam as disciplinas).
// Cada disciplina vai para o pátio, para uma sala escolhida ou fica fora (auditório).
// O mesmo desenho sai no PDF (jsPDF) e na prévia da Área dos Petianos (canvas).
window.Planta = (() => {
  const PAGINA = [1440, 810]; // pt, 16:9 como a original
  const PRETO = [0, 0, 0];
  const CINZA_MESA = [84, 84, 84];
  const CINZA_SALA = [166, 166, 166];
  const AZUL = [12, 6, 92];
  // Fonte da original (Open Sans Bold). Sem ela, usa Helvetica.
  const ARQUIVO_FONTE = "fonts/OpenSans-Bold.ttf";
  const FONTE_CANVAS = '"Open Sans PET", Helvetica, Arial, sans-serif';
  const BASE = 0.705; // distância do topo do texto (como na original) até a linha de base, em tamanhos de fonte

  // Cores da legenda original para as disciplinas que já estavam nela.
  const CORES_DA_ORIGINAL = [
    [/introducao a engenharia eletrica/, [66, 156, 66]],
    [/^integradora (i|1)$/, [56, 182, 255]],
    [/profissional (iii|3)/, [249, 174, 20]],
    [/projeto integrador (iii|3)/, [140, 82, 255]],
    [/ciencia dos materiais/, [255, 87, 87]],
    [/unidade curricular de extensao/, [5, 1, 93]],
    [/eletronica digital/, [226, 169, 241]],
    [/projeto integrador (i|1)$/, [255, 145, 77]],
    [/projeto integrador (ii|2)$/, [193, 255, 114]],
  ];
  const semAcento = (t) => String(t ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
  // Demais disciplinas: cores que não se confundem com as da original.
  const CORES = [
    [12, 192, 223], [150, 95, 50], [0, 150, 136], [233, 30, 99], [120, 144, 156], [205, 220, 57],
    [63, 81, 181], [121, 85, 72], [0, 96, 100], [255, 193, 7], [96, 125, 139], [156, 39, 176],
  ];

  /* ---------------- Locais ----------------
     Salas 1 a 6 do prédio: mesas encostadas nas paredes, com o lado da porta (virado para o pátio) livre.
     Pátio: mesas ao longo das paredes, num percurso em "U", e ilhas no centro só se faltar espaço. */
  const LOCAIS = [
    { id: 1, nome: "Sala 1 (esquerda, em cima)", curso: "renovaveis", porta: "dir", caixa: [62.5, 44, 295, 218.7], selo: [80, 62] },
    { id: 2, nome: "Sala 2 (esquerda)", curso: "renovaveis", porta: "dir", caixa: [62.5, 218.7, 295, 388.8], selo: [80, 237] },
    { id: 3, nome: "Sala 3 (esquerda)", curso: "renovaveis", porta: "dir", caixa: [62.5, 388.8, 295, 476.6], selo: [80, 407] },
    { id: 4, nome: "Sala 4 (esquerda, embaixo)", curso: "renovaveis", porta: "dir", caixa: [62.5, 476.6, 295, 569.9], selo: [80, 495] },
    { id: 5, nome: "Sala 5 (direita, em cima)", curso: "eletrica", porta: "esq", caixa: [697, 44, 929.5, 130.4], selo: [711, 62] },
    { id: 6, nome: "Sala 6 (direita, embaixo)", curso: "eletrica", porta: "esq", caixa: [697, 389, 929.5, 569.9], selo: [711, 407] },
    { id: 9, nome: "Pátio (lado Elétrica)", patio: true },
    { id: 8, nome: "Pátio (no alto)", patio: true },
    { id: 7, nome: "Pátio (lado Renováveis)", patio: true },
    { id: 10, nome: "Pátio (ilhas no centro)", patio: true },
  ];
  const LOCAL = new Map(LOCAIS.map((l) => [l.id, l]));
  const SALAS = LOCAIS.filter((l) => !l.patio);
  const lado = (curso) => (curso === "renovaveis" ? "renovaveis" : "eletrica");
  const nomeCurto = (l) => l.nome.replace(/\s*\(.*\)$/, "");

  /* Mesas: cada uma tem 30 x 17 pt e é dividida ao meio entre dois projetos da mesma disciplina. */
  const COMPRIMENTO = 30;
  const LARGURA = 17;
  const VAO_MESA = 6; // entre mesas da mesma disciplina
  const VAO_GRUPO = 22; // mínimo entre disciplinas
  const emPares = (lista) => Array.from({ length: Math.ceil(lista.length / 2) }, (_, i) => lista.slice(2 * i, 2 * i + 2));
  const mesasDe = (d) => Math.ceil(d.projetos.length / 2);
  const comprimentoDe = (grupo) => grupo.reduce((s, d) => s + mesasDe(d) * (COMPRIMENTO + VAO_MESA) - VAO_MESA, 0) + Math.max(0, grupo.length - 1) * VAO_GRUPO;

  /* Trechos do pátio, na ordem do percurso. "de" → "ate" é o sentido de quem percorre;
     "encosta" diz para que ponta vão as mesas quando sobra espaço (nunca deixar vão no alto). */
  const TRECHOS = [
    { id: 9, eixo: "y", fixo: 656, de: 566, ate: 100, encosta: "ate", rotulo: "esq", numero: "dir", curso: "eletrica" }, // sobe pela parede da Elétrica
    { id: 8, eixo: "x", fixo: 62, de: 660, ate: 330, encosta: "centro", rotulo: "baixo", curso: null }, // atravessa o alto
    { id: 7, eixo: "y", fixo: 318, de: 100, ate: 566, encosta: "de", rotulo: "dir", numero: "esq", curso: "renovaveis" }, // desce pela parede das Renováveis
  ];
  // Ilhas no centro, usadas só quando as paredes lotam.
  const ILHAS = [175, 255, 335, 415].map((y) => ({ id: 10, eixo: "x", fixo: y, de: 410, ate: 575, encosta: "centro", rotulo: "cima", curso: null, ilha: true }));
  const tamanhoDo = (t) => Math.abs(t.ate - t.de);

  /* Mesas de uma sala, encostadas nas paredes (fileira de baixo, parede do fundo, fileira de cima),
     com o lado da porta livre. Diminuem se não couberem. Devolve [{ x0, y0, x1, y1 }]. */
  const PAREDE = 12;
  const LIVRE_PORTA = 30;
  function paredesDaSala(local, escala) {
    const [x0, y0, x1, y1] = local.caixa;
    const w = 36 * escala;
    const h = 21 * escala;
    const g = 12 * escala;
    const fundoEsq = local.porta === "dir";
    const xFundo = fundoEsq ? x0 + PAREDE : x1 - PAREDE - h;
    const xa = fundoEsq ? xFundo + h + g : x0 + LIVRE_PORTA;
    const xb = fundoEsq ? x1 - LIVRE_PORTA : xFundo - g;
    const daPortaProFundo = (xs) => (fundoEsq ? xs.reverse() : xs);
    return [
      { a: xa, b: xb, t: w, g, ordem: daPortaProFundo, mesa: (x) => ({ x0: x, y0: y1 - PAREDE - h, x1: x + w, y1: y1 - PAREDE }) },
      { a: y0 + PAREDE + h + g, b: y1 - PAREDE - h, t: w, g, ordem: (ys) => ys.reverse(), mesa: (y) => ({ x0: xFundo, y0: y, x1: xFundo + h, y1: y + w, numeroFora: fundoEsq ? "dir" : "esq" }) },
      { a: xa, b: xb, t: w, g, ordem: (xs) => (fundoEsq ? xs : xs.reverse()), mesa: (x) => ({ x0: x, y0: y0 + PAREDE, x1: x + w, y1: y0 + PAREDE + h }) },
    ].map((p) => ({ ...p, cabem: Math.max(0, Math.floor((p.b - p.a + p.g) / (p.t + p.g))) }));
  }
  function espalhar(a, b, t, k) {
    if (k <= 0) return [];
    if (k === 1) return [a + (b - a - t) / 2];
    return Array.from({ length: k }, (_, i) => a + (i * (b - a - t)) / (k - 1));
  }
  function repartir(paredes, n) {
    const total = paredes.reduce((s, p) => s + p.cabem, 0);
    const cotas = paredes.map((p) => Math.floor((n * p.cabem) / total));
    let resto = n - cotas.reduce((s, c) => s + c, 0);
    const ordem = paredes.map((p, i) => [i, (n * p.cabem) / total - cotas[i]]).sort((a, b) => b[1] - a[1]);
    for (const [i] of ordem) {
      if (resto <= 0) break;
      if (cotas[i] < paredes[i].cabem) {
        cotas[i]++;
        resto--;
      }
    }
    return cotas;
  }
  function gradeDaSala(local, quantidade) {
    for (let passo = 0; passo <= 9; passo++) {
      const paredes = paredesDaSala(local, 1 - passo * 0.05);
      const cabem = paredes.reduce((s, p) => s + p.cabem, 0);
      if (cabem < quantidade && passo < 9) continue;
      const cotas = repartir(paredes, Math.min(quantidade, cabem));
      return paredes.flatMap((p, i) => p.ordem(espalhar(p.a, p.b, p.t, cotas[i])).map(p.mesa));
    }
    return [];
  }
  const capacidadeDaSala = (l) => gradeDaSala(l, 999).length;

  /* Divide a lista do pátio em trechos seguidos (três paredes e, se precisar, as ilhas),
     sem quebrar disciplina. Prefere: não usar ilhas; cada curso na parede do seu lado;
     paredes igualmente ocupadas (assim não sobra parede vazia nem apertada). */
  function cortarNoPatio(lista) {
    const trechos = [...TRECHOS, ...ILHAS];
    let melhor = null;
    const cortes = [0];
    const avaliar = () => {
      const partes = trechos.map((t, i) => lista.slice(cortes[i], cortes[i + 1]));
      let custo = 0;
      let maior = 0;
      const ocupacao = [];
      for (let i = 0; i < trechos.length; i++) {
        const t = trechos[i];
        const usado = comprimentoDe(partes[i]);
        if (usado > tamanhoDo(t)) return;
        if (t.ilha && partes[i].length) custo += 1e5;
        if (t.curso) custo += partes[i].filter((d) => lado(d.curso) !== t.curso).reduce((s, d) => s + mesasDe(d), 0) * 1e3;
        if (!t.ilha) {
          ocupacao.push(usado / tamanhoDo(t));
          maior = Math.max(maior, usado / tamanhoDo(t));
        }
      }
      const media = ocupacao.reduce((s, x) => s + x, 0) / ocupacao.length;
      custo += maior * 100 + ocupacao.reduce((s, x) => s + Math.abs(x - media), 0) * 50;
      if (!melhor || custo < melhor.custo) melhor = { custo, partes };
    };
    const cortar = (i) => {
      if (i === trechos.length) {
        cortes[i] = lista.length;
        return avaliar();
      }
      for (let c = cortes[i - 1]; c <= lista.length; c++) {
        // Sem espaço para o que já entrou neste trecho? Não adianta avançar o corte.
        if (comprimentoDe(lista.slice(cortes[i - 1], c)) > tamanhoDo(trechos[i - 1])) break;
        cortes[i] = c;
        cortar(i + 1);
      }
    };
    cortar(1);
    return melhor && { trechos, partes: melhor.partes };
  }

  // Posições das mesas de um trecho: grupos inteiros, sobra de espaço entre os grupos e na ponta de baixo.
  function posicionar(trecho, grupo) {
    const total = tamanhoDo(trecho);
    const usado = comprimentoDe(grupo);
    let sobra = total - usado;
    const extra = grupo.length > 1 ? Math.min(sobra / (grupo.length - 1), 26) : 0;
    sobra -= extra * Math.max(0, grupo.length - 1);
    let t = trecho.encosta === "ate" ? sobra : trecho.encosta === "centro" ? sobra / 2 : 0;
    const sentido = Math.sign(trecho.ate - trecho.de);
    const ret = (a, b) => {
      const p0 = trecho.de + sentido * a;
      const p1 = trecho.de + sentido * b;
      const [m0, m1] = [Math.min(p0, p1), Math.max(p0, p1)];
      return trecho.eixo === "y"
        ? { x0: trecho.fixo, y0: m0, x1: trecho.fixo + LARGURA, y1: m1 }
        : { x0: m0, y0: trecho.fixo, x1: m1, y1: trecho.fixo + LARGURA };
    };
    return grupo.map((d) => {
      const mesas = emPares(d.projetos).map((par) => {
        const m = { ...ret(t, t + COMPRIMENTO), par, numeroFora: trecho.numero };
        t += COMPRIMENTO + VAO_MESA;
        return m;
      });
      t += VAO_GRUPO - VAO_MESA + extra;
      return { d, mesas, trecho };
    });
  }

  /* Distribuição.
     disciplinas: [{ nome, curso, local: "auto" | "fora" | 1..6, projetos: [{ codigo, nome }] }], na ordem da lista.
     Devolve os grupos já com as mesas desenhadas e numeradas (pátio no percurso, depois as salas). */
  function distribuir(disciplinas) {
    const grupos = []; // { d, mesas: [{ x0, y0, x1, y1, par, numero }], trecho?, sala? }
    const semMesa = [];
    const foiParaSala = new Map();
    const naSala = new Map(SALAS.map((l) => [l.id, []])); // id → [disciplina]
    const vagasNaSala = (l) => capacidadeDaSala(l) - naSala.get(l.id).reduce((s, d) => s + mesasDe(d), 0);

    // Locais antigos do pátio (corredores 7 a 9) contam como "pátio".
    const naSalaEscolhida = (x) => Number.isInteger(x.local) && LOCAL.get(x.local) && !LOCAL.get(x.local).patio;
    const noPatio = (x) => x.local === "auto" || (Number.isInteger(x.local) && !naSalaEscolhida(x));

    // 1) Salas escolhidas (o que não couber fica sem mesa).
    for (const d of disciplinas.filter(naSalaEscolhida)) {
      const l = LOCAL.get(d.local);
      if (vagasNaSala(l) >= mesasDe(d)) naSala.get(l.id).push(d);
      else semMesa.push(...d.projetos);
    }

    // 2) Pátio. Se nem com as ilhas couber, as maiores vão inteiras para salas até caber.
    let patio = disciplinas.filter((x) => noPatio(x) && x.projetos.length);
    const paraSalas = [];
    let corte = cortarNoPatio(patio);
    while (!corte && patio.length) {
      const maior = patio.reduce((a, b) => (mesasDe(b) > mesasDe(a) ? b : a));
      patio = patio.filter((d) => d !== maior);
      paraSalas.push(maior);
      corte = cortarNoPatio(patio);
    }
    if (corte) corte.trechos.forEach((t, i) => grupos.push(...posicionar(t, corte.partes[i])));

    // 3) O que não coube no pátio: sala vazia do lado do curso, inteira.
    for (const d of paraSalas) {
      const preferencia = (l) => (l.curso === lado(d.curso) ? 0 : 1) + (naSala.get(l.id).length ? 10 : 0);
      const sala = SALAS.filter((l) => vagasNaSala(l) >= mesasDe(d)).sort((a, b) => preferencia(a) - preferencia(b) || vagasNaSala(a) - vagasNaSala(b))[0];
      if (!sala) {
        semMesa.push(...d.projetos);
        continue;
      }
      naSala.get(sala.id).push(d);
      foiParaSala.set(d, sala.id);
    }
    for (const l of SALAS) {
      const lista = naSala.get(l.id);
      if (!lista.length) continue;
      const grade = gradeDaSala(l, lista.reduce((s, d) => s + mesasDe(d), 0));
      let k = 0;
      for (const d of lista) grupos.push({ d, sala: l, mesas: emPares(d.projetos).map((par) => ({ ...grade[k++], par })) });
    }

    // Números das mesas: pátio no percurso, ilhas, depois salas 1 a 6.
    const mesaDe = new Map();
    const localDe = new Map();
    let n = 1;
    for (const g of grupos) {
      const id = g.sala ? g.sala.id : g.trecho.id;
      for (const m of g.mesas) {
        m.numero = n++;
        for (const p of m.par) {
          mesaDe.set(p.codigo, m.numero);
          localDe.set(p.codigo, id);
        }
      }
    }
    return { grupos, mesaDe, localDe, semMesa, foiParaSala };
  }
  const TOTAL_MESAS = TRECHOS.reduce((s, t) => s + Math.floor((tamanhoDo(t) + VAO_MESA) / (COMPRIMENTO + VAO_MESA)), 0);

  // Ordem e lugar das disciplinas na planta original (percurso das mesas 1 → 37).
  const ORDEM_ORIGINAL = [
    [/introducao a engenharia eletrica/, "auto"],
    [/^integradora (i|1)$/, "auto"],
    [/profissional (iii|3)/, 5],
    [/unidade curricular de extensao/, "auto"],
    [/ciencia dos materiais/, "auto"],
    [/projeto integrador (i|1)$/, "auto"],
    [/projeto integrador (ii|2)$/, "auto"],
    [/projeto integrador (iii|3)/, "auto"],
    [/eletronica digital/, 1],
  ];
  const naOriginal = (nome) => ORDEM_ORIGINAL.findIndex(([r]) => r.test(semAcento(nome)));

  // Posição padrão na lista: a da original; disciplinas novas depois, Elétrica antes de Renováveis.
  function ordemPadrao(nome, curso) {
    const i = naOriginal(nome);
    return i >= 0 ? i : 100 + (lado(curso) === "eletrica" ? 0 : 50);
  }
  // Lugar padrão: o da original (Profissional III na sala 5, Eletrônica Digital na sala 1); as outras no pátio.
  function localPadrao(nome) {
    const i = naOriginal(nome);
    return i >= 0 ? ORDEM_ORIGINAL[i][1] : "auto";
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
    const aplicarFonte = () => (ctx.font = `${fonte.estilo === "bold" ? "bold " : ""}${fonte.tamanho}px ${FONTE_CANVAS}`);
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
      roundedRect(x, y, w, h, rx, _ry, estilo = "S") {
        ctx.beginPath();
        ctx.roundRect ? ctx.roundRect(x, y, w, h, rx) : ctx.rect(x, y, w, h);
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

  const clara = (c, t = 0.8) => c.map((v) => Math.round(v + (255 - v) * t));
  const escura = ([r, g, b]) => 0.299 * r + 0.587 * g + 0.114 * b < 140;
  
  const familia = (doc) => (doc.fonteOriginal ? "OpenSans" : "helvetica");

  function texto(doc, t, x, y, tamanho, opcoes = {}) {
    doc.setFont(opcoes.normal ? "helvetica" : familia(doc), opcoes.normal ? "normal" : "bold");
    doc.setFontSize(tamanho);
    doc.setTextColor(...(opcoes.cor || PRETO));
    doc.text(t, x, y, { align: opcoes.align || "left", baseline: opcoes.baseline || "alphabetic" });
  }

  // Diminui a fonte até o texto caber na largura.
  function caber(doc, t, tamanho, largura, minimo = 7) {
    doc.setFont(familia(doc), "bold");
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
    texto(doc, "urnas", 354.1, 740.7 + 21.6 * BASE, 21.6);
    texto(doc, "Entrada", 223.3, 612.3 + 14.7 * BASE, 14.7);
    texto(doc, "LABFILM", 742.8, 248.6 + 32.3 * BASE, 32.3);

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

  // Número de cada sala: círculo de contorno preto, no estilo preto e branco da original.
  function selos(doc) {
    for (const l of LOCAIS.filter((x) => !x.patio)) {
      const [x, y] = l.selo;
      doc.setFillColor(255, 255, 255);
      doc.setDrawColor(...PRETO);
      doc.setLineWidth(1.4);
      doc.circle(x, y, 10, "FD");
      texto(doc, String(l.id), x, y + 13 * 0.36, 13, { align: "center" });
    }
  }

  /* Mesa: metade de cada projeto na cor da disciplina, contorno cinza, número no meio. */
  function mesa(doc, m, cor) {
    const emPe = m.y1 - m.y0 > m.x1 - m.x0;
    const meioX = (m.x0 + m.x1) / 2;
    const meioY = (m.y0 + m.y1) / 2;
    const metades = emPe
      ? [[m.x0, m.y0, m.x1, meioY], [m.x0, meioY, m.x1, m.y1]]
      : [[m.x0, m.y0, meioX, m.y1], [meioX, m.y0, m.x1, m.y1]];
    metades.forEach(([a, b, c, d], i) => {
      doc.setFillColor(...(m.par[i] ? cor : [255, 255, 255]));
      doc.rect(a, b, c - a, d - b, "F");
    });
    doc.setDrawColor(...CINZA_MESA);
    doc.setLineWidth(0.8);
    doc.rect(m.x0, m.y0, m.x1 - m.x0, m.y1 - m.y0, "S");
    // Número fora da mesa (pátio, do lado da parede): divisão em linha inteira.
    // Número dentro (salas): a divisão vira tracinhos nas bordas, para não cortar o número.
    doc.setLineWidth(0.7);
    const fora = m.numeroFora;
    if (emPe) {
      const t = fora ? (m.x1 - m.x0) / 2 : (m.x1 - m.x0) * 0.16;
      doc.line(m.x0, meioY, m.x0 + t, meioY);
      doc.line(m.x1 - t, meioY, m.x1, meioY);
    } else {
      const t = fora ? (m.y1 - m.y0) / 2 : (m.y1 - m.y0) * 0.2;
      doc.line(meioX, m.y0, meioX, m.y0 + t);
      doc.line(meioX, m.y1 - t, meioX, m.y1);
    }
    const n = String(m.numero);
    if (fora === "esq") return texto(doc, n, m.x0 - 2.5, meioY + 8 * 0.36, 8, { align: "right" });
    if (fora === "dir") return texto(doc, n, m.x1 + 2.5, meioY + 8 * 0.36, 8);
    if (fora === "cima") return texto(doc, n, meioX, m.y0 - 3, 8, { align: "center" });
    if (fora === "baixo") return texto(doc, n, meioX, m.y1 + 8.5, 8, { align: "center" });
    const tamanho = Math.min(9, (Math.min(m.x1 - m.x0, m.y1 - m.y0) - 2) * 0.55 + 1.5);
    texto(doc, n, meioX, meioY + tamanho * 0.36, tamanho, { align: "center", cor: escura(cor) ? [255, 255, 255] : PRETO });
  }

  // Caixa que envolve as mesas de um grupo.
  function caixaDe(mesas, folga) {
    return {
      x0: Math.min(...mesas.map((m) => m.x0)) - folga,
      y0: Math.min(...mesas.map((m) => m.y0)) - folga,
      x1: Math.max(...mesas.map((m) => m.x1)) + folga,
      y1: Math.max(...mesas.map((m) => m.y1)) + folga,
    };
  }

  // Texto em até "linhas" linhas que cabem na largura, diminuindo a fonte se precisar.
  function rotuloEmLinhas(doc, t, largura, tamanho, linhas = 3) {
    for (let s = tamanho; s >= 6.5; s -= 0.5) {
      doc.setFont(familia(doc), "bold");
      doc.setFontSize(s);
      const partes = doc.splitTextToSize(t, largura);
      if (partes.length <= linhas) return { partes, s };
    }
    doc.setFontSize(6.5);
    return { partes: doc.splitTextToSize(t, largura).slice(0, linhas), s: 6.5 };
  }
  function escreverLinhas(doc, partes, s, x, yCentro, align) {
    const altura = s * 1.12;
    let y = yCentro - ((partes.length - 1) * altura) / 2 + s * 0.36;
    for (const linha of partes) {
      texto(doc, linha, x, y, s, { align, cor: [45, 45, 60] });
      y += altura;
    }
  }

  /* Grupos do pátio: um fundo arredondado na cor da disciplina em volta das mesas dela
     e o nome da disciplina ao lado, do lado de dentro do pátio. */
  function grupos(doc, m) {
    for (const g of m.grupos.filter((x) => x.trecho)) {
      const cor = m.corDe.get(g.d);
      const c = caixaDe(g.mesas, 5);
      // O fundo cobre também os números, quando eles ficam do lado da mesa.
      if (g.trecho.numero === "esq") c.x0 -= 10;
      if (g.trecho.numero === "dir") c.x1 += 10;
      doc.setFillColor(...clara(cor, 0.8));
      doc.setDrawColor(...cor);
      doc.setLineWidth(1);
      doc.roundedRect(c.x0, c.y0, c.x1 - c.x0, c.y1 - c.y0, 5, 5, "FD");
    }
  }
  function nomesDosGrupos(doc, m) {
    for (const g of m.grupos) {
      if (g.sala) continue;
      const c = caixaDe(g.mesas, 5);
      const lado = g.trecho.rotulo;
      if (lado === "esq" || lado === "dir") {
        const { partes, s } = rotuloEmLinhas(doc, g.d.nome, 74, 9.5, Math.max(2, Math.floor((c.y1 - c.y0) / 11)));
        if (lado === "esq") escreverLinhas(doc, partes, s, c.x0 - 6, (c.y0 + c.y1) / 2, "right");
        else escreverLinhas(doc, partes, s, c.x1 + 6, (c.y0 + c.y1) / 2, "left");
      } else {
        const largura = Math.max(56, c.x1 - c.x0 + 14);
        const { partes, s } = rotuloEmLinhas(doc, g.d.nome, largura, 9, 3);
        const altura = partes.length * s * 1.12;
        const meio = lado === "baixo" ? c.y1 + 4 + altura / 2 : c.y0 - 4 - altura / 2;
        escreverLinhas(doc, partes, s, (c.x0 + c.x1) / 2, meio, "center");
      }
    }
  }

  // Salas: mesas nas paredes e, no meio da sala, o nome das disciplinas que estão nela.
  function nomesNasSalas(doc, m) {
    for (const l of SALAS) {
      const daSala = m.grupos.filter((g) => g.sala === l);
      if (!daSala.length) continue;
      const [x0, y0, x1, y1] = l.caixa;
      const largura = x1 - x0 - 110;
      const blocos = daSala.map((g) => ({ g, ...rotuloEmLinhas(doc, g.d.nome, largura - 14, 10, 2) }));
      const altura = blocos.reduce((s, b) => s + b.partes.length * b.s * 1.12 + 6, -6);
      let y = (y0 + y1) / 2 - altura / 2;
      for (const b of blocos) {
        const h = b.partes.length * b.s * 1.12;
        doc.setFillColor(...m.corDe.get(b.g.d));
        doc.rect(x0 + 55, y + h / 2 - 4, 8, 8, "F");
        escreverLinhas(doc, b.partes, b.s, x0 + 69, y + h / 2, "left");
        y += h + 6;
      }
    }
  }

  function mesas(doc, m) {
    for (const g of m.grupos) for (const x of g.mesas) mesa(doc, x, m.corDe.get(g.d));
  }

  function legenda(doc, itens, edicao) {
    const x = 969.1;
    const topo = 80.2;
    const fim = 515;
    const passo = Math.min(38.6, (fim - topo) / (itens.length + 2));
    const quadrado = Math.min(22.5, passo * 0.6);
    const tamanho = Math.min(18.5, passo * 0.48);
    texto(doc, "Legenda:", x, 39 + 19.1 * BASE, 19.1);
    const largura = PAGINA[0] - (x + 44) - 18;
    const linha = (i, desenhar, rotulo) => {
      const y = topo + i * passo;
      desenhar(y);
      const s = caber(doc, rotulo, tamanho, largura);
      texto(doc, rotulo, x + 43.9, y + quadrado / 2 + s * 0.36, s);
    };
    itens.forEach((item, i) =>
      linha(i, (y) => {
        doc.setFillColor(...item.cor);
        doc.rect(x, y, quadrado, quadrado, "F");
      }, item.rotulo)
    );
    const area = (corA, corB) => (y) => tracejado(doc, [x + 1.5, y + 1.5, x + quadrado + 9, y + quadrado + 2], corA, corB, 2.6, 6, 2.6);
    linha(itens.length, area([137, 217, 87], [204, 227, 102]), "Área Renováveis");
    linha(itens.length + 1, area([92, 223, 230], [1, 75, 173]), "Área Elétrica");
    texto(doc, "Planta da", x, 529.1 + 34.9 * BASE, 34.9);
    texto(doc, `Feira - ${edicao}`, x, 563.6 + 34.9 * BASE, 34.9);
  }

  /* Tudo da primeira página. Devolve a distribuição para a lista. */
  function montar(disciplinas) {
    const incluidas = disciplinas.filter((d) => d.local !== "fora" && d.projetos.length);
    const resultado = distribuir(incluidas);
    const corDe = new Map();
    let extra = 0;
    for (const d of incluidas) {
      const conhecida = CORES_DA_ORIGINAL.find(([r]) => r.test(semAcento(d.nome)));
      corDe.set(d, conhecida ? conhecida[1] : CORES[extra++ % CORES.length]);
    }
    const disciplinaDoProjeto = new Map(incluidas.flatMap((d) => d.projetos.map((p) => [p.codigo, d])));
    return { ...resultado, incluidas, corDe, disciplinaDoProjeto };
  }

  function desenharPlanta(doc, m, edicao) {
    estrutura(doc);
    grupos(doc, m);
    mesas(doc, m);
    nomesDosGrupos(doc, m);
    nomesNasSalas(doc, m);
    selos(doc);
    // Legenda na ordem da original; disciplinas novas no fim.
    const posicao = (d) => {
      const i = CORES_DA_ORIGINAL.findIndex(([r]) => r.test(semAcento(d.nome)));
      return i < 0 ? 99 : i;
    };
    const itens = [...m.incluidas].sort((a, b) => posicao(a) - posicao(b));
    legenda(doc, itens.map((d) => ({ cor: m.corDe.get(d), rotulo: d.nome })), edicao);
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
      const mesas = [...new Set(d.projetos.map((p) => m.mesaDe.get(p.codigo)).filter(Boolean))];
      const sem = d.projetos.filter((p) => !m.localDe.has(p.codigo)).length;
      const partes = [...new Set(locais.map((id) => nomeCurto(LOCAL.get(id))))]; // as partes do pátio contam como um lugar só
      let texto = partes.join(" + ");
      if (mesas.length) texto += ` · mesa${mesas.length === 1 ? "" : "s"} ${faixas(mesas)}`;
      if (sem) texto += `${texto ? " · " : ""}${sem} sem mesa`;
      if (m.foiParaSala.has(d)) texto = `pátio lotado → ${texto}`;
      porDisciplina.set(d, { texto, dividida: partes.length > 1, sem });
    }
    return porDisciplina;
  }

  /* Fonte da original: no PDF entra no arquivo; na prévia, é carregada uma vez no navegador. */
  let fonteBytes = null;
  async function bytesDaFonte() {
    if (!fonteBytes) {
      const resposta = await fetch(ARQUIVO_FONTE);
      if (!resposta.ok) throw new Error("fonte indisponível");
      fonteBytes = new Uint8Array(await resposta.arrayBuffer());
    }
    return fonteBytes;
  }
  async function usarFonteNoPdf(doc) {
    try {
      const bytes = await bytesDaFonte();
      let binario = "";
      for (let i = 0; i < bytes.length; i += 0x8000) binario += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
      doc.addFileToVFS("OpenSans-Bold.ttf", btoa(binario));
      doc.addFont("OpenSans-Bold.ttf", "OpenSans", "bold");
      doc.fonteOriginal = true;
    } catch (erro) {
      console.warn("Planta sem a fonte original:", erro.message);
    }
  }
  let fonteDaPrevia = null;
  function prepararFonte() {
    if (!fonteDaPrevia) {
      fonteDaPrevia = new FontFace("Open Sans PET", `url(${ARQUIVO_FONTE})`, { weight: "700" })
        .load()
        .then((f) => document.fonts.add(f))
        .catch(() => null);
    }
    return fonteDaPrevia;
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
    await usarFonteNoPdf(doc);
    desenharPlanta(doc, m, edicao);

    // Página 2: onde fica cada projeto
    doc.addPage(PAGINA, "landscape");
    texto(doc, `Mesas e projetos  ·  Feira - ${edicao}`, 48, 64, 26);
    const fora = disciplinas.filter((d) => d.local === "fora" && d.projetos.length).map((d) => d.nome);
    const nota = [
      `${m.localDe.size} projeto(s) com lugar na planta.`,
      m.semMesa.length ? `${m.semMesa.length} projeto(s) ficaram sem mesa.` : "",
      fora.length ? `Fora da planta (auditório ou não participam): ${fora.join(", ")}.` : "",
    ].filter(Boolean).join("  ");
    doc.setFont("helvetica", "normal");
    doc.setFontSize(13);
    doc.setTextColor(80, 80, 80);
    doc.text(doc.splitTextToSize(nota, PAGINA[0] - 96), 48, 88);

    const linhas = m.incluidas
      .flatMap((d) => d.projetos.map((p) => ({ d, p, local: m.localDe.get(p.codigo), mesa: m.mesaDe.get(p.codigo) })))
      .sort((a, b) => (a.mesa ?? 999) - (b.mesa ?? 999) || m.incluidas.indexOf(a.d) - m.incluidas.indexOf(b.d));
    const onde = ({ local }) => (local ? nomeCurto(LOCAL.get(local)) : "Sem mesa");
    doc.autoTable({
      startY: 112,
      margin: { left: 48, right: 48, bottom: 40 },
      theme: "grid",
      head: [["", "Mesa", "Código", "Projeto", "Disciplina", "Curso", "Local"]],
      body: linhas.map((l) => ["", l.mesa ?? "–", l.p.codigo, l.p.nome, l.d.nome, cursos.find((c) => c.id === l.d.curso)?.curto || "–", onde(l)]),
      styles: { font: "helvetica", fontSize: 12, cellPadding: 6, textColor: [30, 30, 46], lineColor: [222, 222, 232], lineWidth: 0.5, valign: "middle" },
      headStyles: { fillColor: AZUL, textColor: 255, fontStyle: "bold" },
      columnStyles: { 0: { cellWidth: 16 }, 1: { cellWidth: 56, fontStyle: "bold", halign: "center" }, 2: { cellWidth: 70, fontStyle: "bold" }, 5: { cellWidth: 110 }, 6: { cellWidth: 150 } },
      didParseCell: (c) => {
        if (c.section !== "body") return;
        if (c.column.index === 0) c.cell.styles.fillColor = m.corDe.get(linhas[c.row.index].d);
        if (c.column.index === 6 && !linhas[c.row.index].local) c.cell.styles.textColor = [190, 110, 0];
      },
    });

    doc.setProperties({ title: `Planta da Feira - ${edicao}`, creator: "PET Elétrica UFPB" });
    doc.save(`planta-da-feira-${String(edicao).replace(/[^\w.-]+/g, "-")}.pdf`);
    return { ocupadas: m.localDe.size, semMesa: m.semMesa.length };
  }

  // Quantos projetos cabem numa sala (2 por mesa).
  const projetosNaSala = (id) => capacidadeDaSala(LOCAL.get(id)) * 2;

  return { baixar, previa, prepararFonte, ordemPadrao, localPadrao, projetosNaSala, LOCAIS, TOTAL_MESAS, PAGINA };
})();
