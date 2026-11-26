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

  // Mesas da original: número, retângulo e o número escrito como na original (x, topo, tamanho).
  const MESAS = [
    [1, 647.4, 536.7, 664.6, 566.3, 672.4, 543.7, 24.35], [2, 647.4, 493.0, 664.6, 522.7, 672.4, 500.0, 24.35],
    [3, 647.4, 449.3, 664.6, 479.0, 672.4, 456.3, 24.35], [4, 647.4, 405.7, 664.6, 435.3, 672.4, 412.6, 24.35],
    [5, 647.4, 362.0, 664.6, 391.7, 672.4, 368.8, 24.35], [6, 647.4, 318.3, 664.6, 348.0, 672.4, 325.0, 24.35],
    [7, 647.4, 274.7, 664.6, 304.3, 672.4, 281.1, 24.35], [8, 647.4, 231.0, 664.6, 260.6, 672.1, 237.3, 24.35],
    [9, 647.4, 187.3, 664.6, 217.0, 672.4, 193.5, 24.35],
    [10, 755.3, 103.5, 791.0, 124.3, 761.3, 108.1, 15.68], [11, 825.2, 103.5, 860.9, 124.3, 833.0, 108.1, 15.68],
    [12, 883.4, 68.6, 904.1, 104.3, 906.0, 80.6, 15.68], [13, 825.2, 48.7, 860.9, 69.4, 833.0, 52.3, 15.68],
    [14, 755.3, 48.7, 791.0, 69.4, 762.6, 52.3, 15.68],
    [15, 585.0, 87.0, 614.7, 104.3, 585.9, 64.4, 24.35], [16, 541.4, 87.0, 571.0, 104.3, 542.3, 64.4, 24.35],
    [17, 497.7, 87.0, 527.3, 104.3, 498.6, 64.4, 24.35], [18, 454.0, 87.0, 483.7, 104.3, 454.9, 64.4, 24.35],
    [19, 410.3, 87.0, 440.0, 104.3, 411.3, 64.4, 24.35], [20, 366.7, 87.0, 396.3, 104.3, 367.6, 64.4, 24.35],
    [21, 349.4, 126.6, 366.6, 156.2, 313.9, 133.9, 24.35], [22, 349.4, 228.4, 366.6, 258.1, 313.9, 235.7, 24.35],
    [23, 349.4, 272.1, 366.6, 301.8, 313.9, 279.0, 24.35], [24, 349.4, 315.8, 366.6, 345.4, 313.9, 323.1, 24.35],
    [25, 349.4, 359.4, 366.6, 389.1, 313.9, 367.2, 24.35], [26, 349.4, 403.1, 366.6, 432.8, 313.9, 411.3, 24.35],
    [27, 349.4, 446.8, 366.6, 476.4, 313.9, 455.4, 24.35], [28, 349.4, 490.5, 366.6, 520.1, 313.9, 499.5, 24.35],
    [29, 171.6, 180.6, 207.3, 201.4, 182.6, 183.3, 12.18], [30, 119.0, 180.6, 154.7, 201.4, 130.5, 183.3, 12.18],
    [31, 81.1, 144.9, 101.8, 180.6, 106.2, 159.9, 12.18], [32, 81.1, 92.3, 101.8, 128.0, 106.2, 102.3, 12.18],
    [33, 107.1, 59.9, 142.8, 80.7, 116.5, 63.2, 12.18], [34, 159.7, 59.9, 195.4, 80.7, 168.7, 65.5, 12.18],
    [35, 212.3, 59.9, 248.0, 80.7, 220.8, 64.5, 12.18], [36, 252.2, 92.3, 273.0, 128.0, 227.8, 100.2, 12.18],
    [37, 252.2, 144.9, 273.0, 180.6, 227.8, 159.5, 12.18],
  ].map(([n, x0, y0, x1, y1, tx, ty, tamanho]) => ({ n, x0, y0, x1, y1, rotulo: { x: tx, topo: ty, tamanho } }));
  const MESA = new Map(MESAS.map((m) => [m.n, m]));

  /* Locais: salas numeradas de 1 a 6 e as três partes do pátio. curso: área a que pertencem (null = serve aos dois).
     caixa: interior da sala (onde as mesas são desenhadas se ela não tem mesas fixas). selo: onde fica o número. */
  const LOCAIS = [
    { id: 1, nome: "Sala 1 (esquerda, em cima)", mesas: [29, 30, 31, 32, 33, 34, 35, 36, 37], curso: "renovaveis", caixa: [62.5, 44, 295, 218.7], selo: [78, 61] },
    { id: 2, nome: "Sala 2 (esquerda)", mesas: [], curso: "renovaveis", porta: "dir", caixa: [62.5, 218.7, 295, 388.8], selo: [80, 237] },
    { id: 3, nome: "Sala 3 (esquerda)", mesas: [], curso: "renovaveis", porta: "dir", caixa: [62.5, 388.8, 295, 476.6], selo: [80, 407] },
    { id: 4, nome: "Sala 4 (esquerda, embaixo)", mesas: [], curso: "renovaveis", porta: "dir", caixa: [62.5, 476.6, 295, 569.9], selo: [80, 495] },
    { id: 5, nome: "Sala 5 (direita, em cima)", mesas: [10, 11, 12, 13, 14], curso: "eletrica", caixa: [697, 44, 929.5, 130.4], selo: [717, 62] },
    { id: 6, nome: "Sala 6 (direita, embaixo)", mesas: [], curso: "eletrica", porta: "esq", caixa: [697, 389, 929.5, 569.9], selo: [711, 407] },
    // Pátio: sem número (as cores já separam as disciplinas); só o automático usa.
    { id: 7, nome: "Pátio (lado Renováveis)", mesas: [21, 22, 23, 24, 25, 26, 27, 28], curso: "renovaveis", patio: true },
    { id: 8, nome: "Pátio (fileira do alto)", mesas: [15, 16, 17, 18, 19, 20], curso: null, patio: true },
    { id: 9, nome: "Pátio (lado Elétrica)", mesas: [1, 2, 3, 4, 5, 6, 7, 8, 9], curso: "eletrica", patio: true },
  ];
  const LOCAL = new Map(LOCAIS.map((l) => [l.id, l]));
  const TOTAL_MESAS = MESAS.length;
  const lado = (curso) => (curso === "renovaveis" ? "renovaveis" : "eletrica");
  const nomeCurto = (l) => l.nome.replace(/\s*\(.*\)$/, "");

  /* Mesas desenhadas numa sala sem mesas fixas, como nas salas da original: encostadas nas
     paredes (fileira de cima, parede do fundo e fileira de baixo), com o lado da porta livre.
     A porta fica sempre na parede de frente para o pátio. Devolve [{ x0, y0, x1, y1 }]. */
  const PAREDE = 12; // distância da mesa à parede
  const LIVRE_PORTA = 30; // espaço livre junto à porta

  // As três paredes com mesas, na ordem em volta da sala: fileira de baixo (da porta para o fundo),
  // parede do fundo (de baixo para cima) e fileira de cima (do fundo para a porta).
  function paredesDaSala(local, escala) {
    const [x0, y0, x1, y1] = local.caixa;
    const w = 36 * escala; // mesa deitada
    const h = 21 * escala;
    const g = 12 * escala;
    const fundoEsq = local.porta === "dir"; // a parede do fundo é a oposta à porta
    const xFundo = fundoEsq ? x0 + PAREDE : x1 - PAREDE - h;
    const xa = fundoEsq ? xFundo + h + g : x0 + LIVRE_PORTA;
    const xb = fundoEsq ? x1 - LIVRE_PORTA : xFundo - g;
    // Número da mesa como nas salas da original: dentro da mesa deitada, ao lado da em pé.
    const tamanho = (local.porta === "esq" ? 15.68 : 12.18) * Math.max(escala, 0.8);
    const daPortaProFundo = (xs) => (fundoEsq ? xs.reverse() : xs);
    return [
      { a: xa, b: xb, t: w, g, ordem: daPortaProFundo, // baixo: porta → fundo
        mesa: (x) => ({ x0: x, y0: y1 - PAREDE - h, x1: x + w, y1: y1 - PAREDE, rotulo: { lado: "dentro", tamanho } }) },
      { a: y0 + PAREDE + h + g, b: y1 - PAREDE - h, t: w, g, ordem: (ys) => ys.reverse(), // fundo: de baixo para cima, até a fileira de baixo
        mesa: (y) => ({ x0: xFundo, y0: y, x1: xFundo + h, y1: y + w, rotulo: { lado: fundoEsq ? "dir" : "esq", tamanho } }) },
      { a: xa, b: xb, t: w, g, ordem: (xs) => (fundoEsq ? xs : xs.reverse()), // cima: fundo → porta
        mesa: (x) => ({ x0: x, y0: y0 + PAREDE, x1: x + w, y1: y0 + PAREDE + h, rotulo: { lado: "dentro", tamanho } }) },
    ].map((p) => ({ ...p, cabem: Math.max(0, Math.floor((p.b - p.a + p.g) / (p.t + p.g))) }));
  }

  // "k" peças de tamanho t entre a e b, com o mesmo espaço entre elas.
  function espalhar(a, b, t, k) {
    if (k <= 0) return [];
    if (k === 1) return [a + (b - a - t) / 2];
    return Array.from({ length: k }, (_, i) => a + (i * (b - a - t)) / (k - 1));
  }

  // Divide "n" mesas entre as paredes na proporção do que cabe em cada uma.
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
      const paredes = paredesDaSala(local, 1 - passo * 0.05); // de 100% até 55%
      const cabem = paredes.reduce((s, p) => s + p.cabem, 0);
      if (cabem < quantidade && passo < 9) continue;
      const cotas = repartir(paredes, Math.min(quantidade, cabem));
      return paredes.flatMap((p, i) => p.ordem(espalhar(p.a, p.b, p.t, cotas[i])).map(p.mesa));
    }
    return [];
  }
  const capacidadeDaSala = (l) => gradeDaSala(l, 999).length;

  /* Pátio como uma fila contínua, no percurso da numeração original (um "U"):
     corredor da Elétrica de baixo para cima (1→9), fileira do alto da direita para a
     esquerda (15→20) e corredor das Renováveis de cima para baixo (21→28).
     As disciplinas entram na ordem da lista, cada uma inteira numa só fileira; a fileira do
     alto é preenchida primeiro e os corredores ficam encostados nela, de modo que as mesas
     vazias sobram embaixo, perto da entrada, e nunca no alto do pátio. */
  const FILEIRAS = [
    { id: 9, mesas: [1, 2, 3, 4, 5, 6, 7, 8, 9], alinhar: "fim" }, // encostado no alto
    { id: 8, mesas: [15, 16, 17, 18, 19, 20], alinhar: "centro" },
    { id: 7, mesas: [21, 22, 23, 24, 25, 26, 27, 28], alinhar: "inicio" }, // encostado no alto
  ];
  const emPares = (lista) => Array.from({ length: Math.ceil(lista.length / 2) }, (_, i) => lista.slice(2 * i, 2 * i + 2));
  const mesasDe = (d) => Math.ceil(d.projetos.length / 2);

  // Melhor corte da lista em três trechos seguidos (um por fileira), ou null se não couber.
  function cortarNoPatio(lista) {
    const [c1, c2, c3] = FILEIRAS.map((f) => f.mesas.length);
    const m = lista.map(mesasDe);
    const soma = (i, j) => m.slice(i, j).reduce((s, x) => s + x, 0);
    let melhor = null;
    for (let a = 0; a <= lista.length; a++) {
      for (let b = a; b <= lista.length; b++) {
        const s1 = soma(0, a);
        const s2 = soma(a, b);
        const s3 = soma(b, lista.length);
        if (s1 > c1 || s2 > c2 || s3 > c3) continue;
        // Curso no lado errado: Renováveis no corredor da Elétrica e vice-versa.
        const ladoErrado =
          lista.slice(0, a).filter((d) => lado(d.curso) === "renovaveis").reduce((s, d) => s + mesasDe(d), 0) +
          lista.slice(b).filter((d) => lado(d.curso) === "eletrica").reduce((s, d) => s + mesasDe(d), 0);
        // Fileira do alto cheia primeiro; depois cada curso no seu lado; depois as sobras divididas entre os corredores.
        const custo = (c2 - s2) * 1000 + ladoErrado * 10 + Math.abs((c1 - s1) - (c3 - s3));
        if (!melhor || custo < melhor.custo) melhor = { custo, cortes: [0, a, b, lista.length] };
      }
    }
    return melhor;
  }

  /* Distribuição. Cada mesa é dividida ao meio entre dois projetos da mesma disciplina
     (uma disciplina com número ímpar de projetos deixa meia mesa livre).
     disciplinas: [{ nome, curso, local: "auto" | "fora" | 1..6, projetos: [{ codigo, nome }] }], na ordem da lista.
     1) as que têm sala escolhida vão para ela;
     2) as do pátio entram na fila contínua; se o pátio lotar, as maiores vão para as salas
        (primeiro as que têm mesas fixas, 1 e 5, depois as vazias), sempre inteiras. */
  function distribuir(disciplinas) {
    const livres = new Map(LOCAIS.map((l) => [l.id, [...l.mesas]]));
    const mesaDe = new Map(); // código → nº da mesa
    const localDe = new Map(); // código → id do local
    const projetosDaMesa = new Map(); // nº da mesa fixa → [projeto, projeto?]
    const naSala = new Map(); // id da sala sem mesas fixas → [[projeto, projeto?], ...]
    const semMesa = [];
    const foiParaSala = new Map(); // disciplina do pátio que não coube → id da sala
    const mesasLivres = (l) => (l.mesas.length ? livres.get(l.id).length : capacidadeDaSala(l) - (naSala.get(l.id)?.length || 0));
    const ocuparMesa = (par, id, n) => {
      projetosDaMesa.set(n, par);
      par.forEach((p) => {
        mesaDe.set(p.codigo, n);
        localDe.set(p.codigo, id);
      });
    };
    const ocuparSala = (par, id) => {
      const l = LOCAL.get(id);
      if (mesasLivres(l) <= 0) return false;
      if (l.mesas.length) ocuparMesa(par, id, livres.get(id).shift());
      else {
        if (!naSala.has(id)) naSala.set(id, []);
        naSala.get(id).push(par);
        par.forEach((p) => localDe.set(p.codigo, id));
      }
      return true;
    };

    // 1) Salas escolhidas.
    for (const d of disciplinas.filter((x) => Number.isInteger(x.local))) {
      for (const par of emPares(d.projetos)) if (!ocuparSala(par, d.local)) semMesa.push(...par);
    }

    // 2) Pátio. Se a fila não couber, algumas disciplinas vão inteiras para salas: o mínimo
    //    possível, escolhidas para a fileira do alto ficar cheia e o pátio continuar na ordem.
    const naFila = disciplinas.filter((x) => x.local === "auto" && x.projetos.length);
    let patio = naFila;
    let paraSalas = [];
    let corte = cortarNoPatio(patio);
    for (let k = 1; !corte && k <= Math.min(4, naFila.length); k++) {
      let melhor = null;
      const tentar = (inicio, fora) => {
        if (fora.length === k) {
          const resto = naFila.filter((d) => !fora.includes(d));
          const c = cortarNoPatio(resto);
          if (!c) return;
          const custo = c.custo + fora.reduce((s, d) => s + mesasDe(d), 0); // tira o mínimo de mesas
          if (!melhor || custo < melhor.custo) melhor = { custo, corte: c, resto, fora: [...fora] };
          return;
        }
        for (let i = inicio; i < naFila.length; i++) tentar(i + 1, [...fora, naFila[i]]);
      };
      tentar(0, []);
      if (melhor) ({ corte, resto: patio, fora: paraSalas } = melhor);
    }
    if (!corte) {
      // Nem tirando quatro coube: as maiores vão para as salas até caber.
      while (!corte && patio.length) {
        const maior = patio.reduce((a, b) => (mesasDe(b) > mesasDe(a) ? b : a));
        patio = patio.filter((d) => d !== maior);
        paraSalas.push(maior);
        corte = cortarNoPatio(patio);
      }
    }
    if (corte) {
      FILEIRAS.forEach((f, i) => {
        const trecho = patio.slice(corte.cortes[i], corte.cortes[i + 1]);
        const usadas = trecho.reduce((s, d) => s + mesasDe(d), 0);
        const sobra = f.mesas.length - usadas;
        // Corredores: encostados no alto (sobra embaixo). Fileira do alto: as pontas ficam ocupadas
        // e a sobra vai entre as disciplinas, para nunca abrir vão no canto; com uma só, fica no meio.
        const vaos = trecho.map(() => 0);
        let k = f.alinhar === "fim" ? sobra : 0;
        if (f.alinhar === "centro") {
          if (trecho.length === 1) k = Math.floor(sobra / 2);
          else for (let i = 0; i < sobra; i++) vaos[i % (trecho.length - 1)]++;
        }
        trecho.forEach((d, i) => {
          for (const par of emPares(d.projetos)) ocuparMesa(par, f.id, f.mesas[k++]);
          k += vaos[i];
        });
      });
    }

    // 3) O que não coube no pátio vai inteiro para uma sala: as de mesas fixas do lado do curso
    //    primeiro, depois as outras com mesas fixas e por último as vazias.
    for (const d of paraSalas) {
      const pares = emPares(d.projetos);
      // Sala com mesas fixas antes das vazias; do lado do curso; e sem outra disciplina dentro.
      const ocupada = (l) => (l.mesas.length ? livres.get(l.id).length < l.mesas.length : naSala.has(l.id));
      const preferencia = (l) => (l.mesas.length ? 0 : 3) + (l.curso === lado(d.curso) ? 0 : l.curso === null ? 1 : 2) + (ocupada(l) ? 10 : 0);
      const salas = LOCAIS.filter((l) => !l.patio);
      const cabe = salas.filter((l) => mesasLivres(l) >= pares.length).sort((a, b) => preferencia(a) - preferencia(b) || mesasLivres(a) - mesasLivres(b));
      if (cabe.length) {
        pares.forEach((par) => ocuparSala(par, cabe[0].id));
        foiParaSala.set(d, cabe[0].id);
        continue;
      }
      const ordem = [...salas].sort((a, b) => preferencia(a) - preferencia(b) || mesasLivres(b) - mesasLivres(a));
      for (const par of pares) if (!ordem.some((l) => ocuparSala(par, l.id))) semMesa.push(...par);
    }

    // Mesas desenhadas nas salas ganham números depois das 37 da original, sala por sala.
    let proximo = MESAS.length + 1;
    const numerosNaSala = new Map();
    for (const l of LOCAIS.filter((x) => naSala.has(x.id))) {
      numerosNaSala.set(l.id, naSala.get(l.id).map((par) => {
        const n = proximo++;
        par.forEach((p) => mesaDe.set(p.codigo, n));
        return n;
      }));
    }
    return { mesaDe, localDe, projetosDaMesa, naSala, numerosNaSala, semMesa, foiParaSala };
  }

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

  /* Mesa como na original (cor da disciplina, contorno cinza e o número da mesa),
     com uma linha no meio: cada metade é de um projeto. Meia mesa sem projeto fica branca. */
  function mesa(doc, m, numero, par, corDe) {
    const emPe = m.y1 - m.y0 > m.x1 - m.x0;
    const meioX = (m.x0 + m.x1) / 2;
    const meioY = (m.y0 + m.y1) / 2;
    const metades = emPe
      ? [[m.x0, m.y0, m.x1, meioY], [m.x0, meioY, m.x1, m.y1]]
      : [[m.x0, m.y0, meioX, m.y1], [meioX, m.y0, m.x1, m.y1]];
    metades.forEach(([a, b, c, d], i) => {
      doc.setFillColor(...(par[i] ? corDe(par[i]) : [255, 255, 255]));
      doc.rect(a, b, c - a, d - b, "F");
    });
    doc.setDrawColor(...CINZA_MESA);
    doc.setLineWidth(0.9);
    doc.rect(m.x0, m.y0, m.x1 - m.x0, m.y1 - m.y0, "S");
    const r = m.rotulo;
    // Com o número dentro da mesa, a divisão vira dois tracinhos nas bordas para não cortar o número.
    const numeroDentro = r.lado === "dentro" || (r.x != null && r.x >= m.x0 && r.x <= m.x1);
    if (emPe) doc.line(m.x0, meioY, m.x1, meioY);
    else if (!numeroDentro) doc.line(meioX, m.y0, meioX, m.y1);
    else {
      const traco = (m.y1 - m.y0) * 0.2;
      doc.line(meioX, m.y0, meioX, m.y0 + traco);
      doc.line(meioX, m.y1 - traco, meioX, m.y1);
    }

    const t = String(numero);
    if (r.x != null) return texto(doc, t, r.x, r.topo + r.tamanho * BASE, r.tamanho); // mesas da original
    if (r.lado === "dentro") return texto(doc, t, meioX, meioY + r.tamanho * 0.36, r.tamanho, { align: "center" });
    if (r.lado === "dir") return texto(doc, t, m.x1 + 4, meioY + r.tamanho * 0.36, r.tamanho);
    texto(doc, t, m.x0 - 4, meioY + r.tamanho * 0.36, r.tamanho, { align: "right" });
  }

  function mesas(doc, m) {
    const cor = (p) => m.corDe.get(m.disciplinaDoProjeto.get(p.codigo));
    for (const [n, par] of m.projetosDaMesa) mesa(doc, MESA.get(n), n, par, cor);
    for (const [id, pares] of m.naSala) {
      const grade = gradeDaSala(LOCAL.get(id), pares.length);
      const numeros = m.numerosNaSala.get(id);
      pares.forEach((par, i) => grade[i] && mesa(doc, grade[i], numeros[i], par, cor));
    }
  }

  // Legenda como a original: quadrados de 22,5 a cada 38,6 pt, texto de 18,5 e o título embaixo.
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
    mesas(doc, m);
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

  return { baixar, previa, prepararFonte, ordemPadrao, localPadrao, LOCAIS, TOTAL_MESAS, PAGINA };
})();
