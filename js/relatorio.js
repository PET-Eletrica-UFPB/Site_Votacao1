// PDFs da Área dos Petianos, gerados no próprio navegador.
// As bibliotecas (jsPDF e AutoTable) só são baixadas quando alguém pede um PDF.
window.PDF = (() => {
  const LIBS = [
    "https://cdn.jsdelivr.net/npm/jspdf@2.5.2/dist/jspdf.umd.min.js",
    "https://cdn.jsdelivr.net/npm/jspdf-autotable@3.8.4/dist/jspdf.plugin.autotable.min.js",
  ];
  const COR = {
    navy: [12, 6, 92],
    amber: [238, 166, 20],
    green: [70, 154, 69],
    tinta: [30, 30, 46],
    cinza: [110, 110, 128],
    linha: [222, 222, 232],
    fundo: [246, 245, 240],
    alerta: [190, 110, 0],
  };
  const M = 16; // margem em mm

  function carregarScript(src) {
    return new Promise((ok, falha) => {
      if (document.querySelector(`script[src="${src}"]`)) return ok();
      const s = document.createElement("script");
      s.src = src;
      s.onload = ok;
      s.onerror = () => falha(new Error("Sem internet para baixar o gerador de PDF."));
      document.head.append(s);
    });
  }

  async function bibliotecas() {
    if (!window.jspdf) await carregarScript(LIBS[0]);
    await carregarScript(LIBS[1]);
    return window.jspdf.jsPDF;
  }

  async function imagem(url) {
    try {
      const blob = await (await fetch(url)).blob();
      const dataUrl = await new Promise((ok) => {
        const leitor = new FileReader();
        leitor.onload = () => ok(leitor.result);
        leitor.readAsDataURL(blob);
      });
      const { width, height } = await new Promise((ok, falha) => {
        const img = new Image();
        img.onload = () => ok(img);
        img.onerror = falha;
        img.src = dataUrl;
      });
      return { dataUrl, proporcao: width / height };
    } catch {
      return null; // sem logo, o PDF sai igual
    }
  }

  /* Cria um documento com a capa do PET e devolve as ferramentas de desenho. */
  async function criar({ rotulo, titulo, subtitulo, cabecalho }) {
    const jsPDF = await bibliotecas();
    const logo = await imagem("img/logo-pet-compacto.png");
    const doc = new jsPDF({ unit: "mm", format: "a4" });
    const L = doc.internal.pageSize.getWidth();
    const A = doc.internal.pageSize.getHeight();
    const agora = new Date();
    const util = L - 2 * M;

    const cor = (c) => doc.setTextColor(...c);
    // Aceita uma linha ou a lista de linhas que splitTextToSize devolve.
    const texto = (t, x, y, op) => doc.text(Array.isArray(t) ? t : String(t), x, y, op);
    const fonte = (estilo, tamanho, c = COR.tinta, familia = "helvetica") => {
      doc.setFont(familia, estilo);
      doc.setFontSize(tamanho);
      cor(c);
    };

    const p = { doc, L, A, M, util, cor, texto, fonte, COR, y: 0, agora };

    // Pula para a próxima página se não couber "altura" mm.
    p.espaco = (altura) => {
      if (p.y + altura > A - 20) {
        doc.addPage();
        p.y = 24;
      }
    };

    p.novaPagina = () => {
      doc.addPage();
      p.y = 24;
    };

    p.tituloSecao = (titulo, sub) => {
      p.espaco(24);
      fonte("bold", 15, COR.navy);
      texto(titulo, M, p.y);
      doc.setFillColor(...COR.amber);
      doc.rect(M, p.y + 2.2, 18, 1.1, "F");
      p.y += 8;
      if (sub) p.paragrafo(sub, 9);
      else p.y += 1;
    };

    p.paragrafo = (conteudo, tamanho = 8.6, c = COR.cinza) => {
      fonte("normal", tamanho, c);
      const linhas = doc.splitTextToSize(conteudo, util);
      p.espaco(linhas.length * tamanho * 0.44 + 3);
      texto(linhas, M, p.y);
      p.y += linhas.length * tamanho * 0.44 + 4;
    };

    p.subtitulo = (conteudo) => {
      p.espaco(30);
      fonte("bold", 11, COR.tinta);
      texto(conteudo, M, p.y);
      p.y += 2.5;
    };

    // Cartões de números lado a lado: [[rótulo, valor], ...]
    p.cartoes = (lista) => {
      const gap = 4;
      const larg = (util - gap * (lista.length - 1)) / lista.length;
      p.espaco(30);
      lista.forEach(([rot, valor], i) => {
        const x = M + i * (larg + gap);
        doc.setFillColor(...COR.fundo);
        doc.roundedRect(x, p.y, larg, 24, 2.5, 2.5, "F");
        fonte("bold", String(valor).length > 9 ? 12 : 17, COR.navy);
        texto(valor, x + 5, p.y + 11);
        fonte("normal", 8.2, COR.cinza);
        texto(rot, x + 5, p.y + 18);
      });
      p.y += 32;
    };

    p.estiloTabela = {
      theme: "grid",
      margin: { left: M, right: M, top: 24, bottom: 20 },
      styles: { font: "helvetica", fontSize: 8.6, cellPadding: 2.2, textColor: COR.tinta, lineColor: COR.linha, lineWidth: 0.2, valign: "middle", overflow: "linebreak" },
      headStyles: { fillColor: COR.navy, textColor: 255, fontStyle: "bold", fontSize: 8.2 },
      alternateRowStyles: { fillColor: [250, 250, 252] },
    };

    p.tabela = (opcoes, depois = 9) => {
      doc.autoTable({
        ...p.estiloTabela,
        ...opcoes,
        styles: { ...p.estiloTabela.styles, ...(opcoes.styles || {}) },
        startY: p.y,
      });
      p.y = doc.lastAutoTable.finalY + depois;
    };

    p.salvar = (nomeArquivo) => {
      const total = doc.getNumberOfPages();
      for (let i = 1; i <= total; i++) {
        doc.setPage(i);
        if (i > 1) {
          doc.setFillColor(...COR.navy);
          doc.rect(0, 0, L, 12, "F");
          fonte("bold", 8.5, [255, 255, 255]);
          texto(cabecalho || titulo, M, 7.7);
          fonte("normal", 8.5, [247, 197, 92]);
          texto("Feira de Engenharia e Energia", L - M, 7.7, { align: "right" });
        }
        doc.setDrawColor(...COR.linha);
        doc.setLineWidth(0.2);
        doc.line(M, A - 12, L - M, A - 12);
        fonte("normal", 7.8, COR.cinza);
        texto("PET Elétrica UFPB  ·  Centro de Energias Alternativas e Renováveis", M, A - 7.5);
        texto(`Página ${i} de ${total}`, L - M, A - 7.5, { align: "right" });
      }
      doc.save(`${nomeArquivo}-${agora.toISOString().slice(0, 10)}.pdf`);
    };

    /* Capa */
    doc.setFillColor(...COR.navy);
    doc.rect(0, 0, L, 64, "F");
    doc.setFillColor(...COR.amber);
    doc.rect(0, 64, L, 1.6, "F");
    if (logo) {
      const h = 26;
      doc.addImage(logo.dataUrl, "PNG", L - M - h * logo.proporcao, 14, h * logo.proporcao, h, "logo", "FAST");
    }
    fonte("normal", 9, [247, 197, 92]);
    texto(rotulo, M, 20);
    fonte("bold", 24, [255, 255, 255]);
    texto(titulo, M, 33);
    fonte("normal", 13, [255, 255, 255]);
    texto(doc.splitTextToSize(subtitulo, util - 60)[0], M, 42);
    fonte("normal", 9, [210, 208, 235]);
    texto(`Gerado em ${agora.toLocaleString("pt-BR", { dateStyle: "long", timeStyle: "short" })}`, M, 52);
    p.y = 76;

    return p;
  }

  return { criar, bibliotecas, COR };
})();

/* Relatório das avaliações dos professores */
window.Relatorio = (() => {
  const SEM_DISCIPLINA = "Sem disciplina";
  const disciplinaDe = (p) => (p.disciplina || "").trim() || SEM_DISCIPLINA;
  const fmt = (n) => (n == null ? "–" : n.toFixed(2).replace(".", ","));
  const fmtCurto = (n) => (n == null ? "–" : String(Math.round(n * 10) / 10).replace(".", ","));

  /* Junta projetos, professores e notas em uma estrutura só. */
  function montar({ projetos, professores, avaliacoes }) {
    const { criterios, cursos } = window.FEIRA;
    const porProjeto = projetos.map((p) => {
      const linhas = professores
        .filter((prof) => prof.projetos.includes(p.codigo) || avaliacoes[prof.uid]?.[p.codigo])
        .map((prof) => ({ professor: prof.nome, avaliacao: avaliacoes[prof.uid]?.[p.codigo] || null }));
      const feitas = linhas.filter((l) => l.avaliacao);
      const media = feitas.length ? feitas.reduce((s, l) => s + Number(l.avaliacao.media), 0) / feitas.length : null;
      return {
        ...p,
        curso: cursos.find((c) => c.id === p.curso)?.curto || p.curso,
        linhas,
        feitas: feitas.length,
        media,
      };
    });

    const disciplinas = new Map();
    for (const p of porProjeto) {
      const d = disciplinaDe(p);
      if (!disciplinas.has(d)) disciplinas.set(d, []);
      disciplinas.get(d).push(p);
    }
    for (const lista of disciplinas.values()) {
      lista.sort((a, b) => (b.media ?? -1) - (a.media ?? -1) || a.nome.localeCompare(b.nome, "pt-BR"));
    }

    const porProfessor = professores.map((prof) => {
      const codigos = new Set([...prof.projetos, ...Object.keys(avaliacoes[prof.uid] || {})]);
      const atribuidos = porProjeto.filter((p) => codigos.has(p.codigo));
      const feitos = atribuidos.filter((p) => avaliacoes[prof.uid]?.[p.codigo]);
      const medias = feitos.map((p) => Number(avaliacoes[prof.uid][p.codigo].media));
      return {
        nome: prof.nome,
        total: atribuidos.length,
        feitos: feitos.length,
        mediaDada: medias.length ? medias.reduce((a, b) => a + b, 0) / medias.length : null,
      };
    });

    const esperadas = porProjeto.reduce((s, p) => s + p.linhas.length, 0);
    const feitas = porProjeto.reduce((s, p) => s + p.feitas, 0);
    const comMedia = porProjeto.filter((p) => p.media != null);
    return {
      criterios,
      porProjeto,
      disciplinas: [...disciplinas.entries()].sort(([a], [b]) => a.localeCompare(b, "pt-BR")),
      porProfessor,
      esperadas,
      feitas,
      projetosAvaliados: comMedia.length,
      mediaGeral: comMedia.length ? comMedia.reduce((s, p) => s + p.media, 0) / comMedia.length : null,
    };
  }

  async function baixar(dados) {
    const r = montar(dados);
    const p = await PDF.criar({
      rotulo: "PET ELÉTRICA UFPB  ·  BANCA AVALIADORA",
      titulo: "Relatório de avaliações",
      subtitulo: "Feira de Engenharia e Energia",
    });
    const { doc, L, M, COR, texto, fonte } = p;

    p.cartoes([
      ["Projetos avaliados", `${r.projetosAvaliados}/${r.porProjeto.length}`],
      ["Professores", String(r.porProfessor.length)],
      ["Avaliações feitas", `${r.feitas}/${r.esperadas}`],
      ["Média geral", fmt(r.mediaGeral)],
    ]);

    const pesos = r.criterios.map((c) => `${c.nome} (peso ${c.peso})`).join(", ");
    p.paragrafo(
      `Cada professor dá uma nota de 0 a 10 em cada critério: ${pesos}. A média do professor é a média ponderada desses critérios, e a média final do projeto é a média simples entre os professores que o avaliaram.`
    );
    p.y += 4;

    /* 1. Resultado por disciplina */
    p.tituloSecao("Resultado por disciplina", "Projetos ordenados pela média final dentro de cada disciplina.");
    for (const [disciplina, lista] of r.disciplinas) {
      p.subtitulo(disciplina);
      p.tabela({
        head: [["Pos.", "Código", "Projeto", "Curso", "Avaliações", "Média final"]],
        body: lista.map((x, i) => [
          x.media == null ? "–" : `${i + 1}º`,
          x.codigo,
          x.nome,
          x.curso,
          x.linhas.length ? `${x.feitas}/${x.linhas.length}` : "sem avaliador",
          fmt(x.media),
        ]),
        columnStyles: {
          0: { cellWidth: 12, halign: "center" },
          1: { cellWidth: 16, halign: "center", font: "courier" },
          3: { cellWidth: 28 },
          4: { cellWidth: 22, halign: "center" },
          5: { cellWidth: 22, halign: "center", fontStyle: "bold" },
        },
        didParseCell: (c) => {
          if (c.section === "body" && c.row.index === 0 && lista[0].media != null) c.cell.styles.fillColor = [253, 243, 220];
        },
      });
    }

    /* 2. Andamento por professor */
    p.tituloSecao("Andamento por professor", "Quantos projetos cada professor recebeu e quantos já avaliou.");
    p.tabela({
      head: [["Professor", "Projetos", "Avaliados", "Pendentes", "Média das notas dadas"]],
      body: r.porProfessor.map((x) => [x.nome, x.total, x.feitos, x.total - x.feitos, fmt(x.mediaDada)]),
      columnStyles: {
        1: { cellWidth: 22, halign: "center" },
        2: { cellWidth: 22, halign: "center" },
        3: { cellWidth: 22, halign: "center" },
        4: { cellWidth: 40, halign: "center" },
      },
      didParseCell: (c) => {
        if (c.section === "body" && c.column.index === 3 && Number(c.cell.raw) > 0) c.cell.styles.textColor = COR.alerta;
      },
    });

    /* 3. Notas de cada projeto */
    p.novaPagina();
    p.tituloSecao("Notas de cada projeto", "Notas de cada professor por critério, com a média ponderada e os comentários deixados para a equipe.");
    for (const [disciplina, lista] of r.disciplinas) {
      for (const x of lista) {
        p.espaco(46);
        let y = p.y;
        doc.setFillColor(...COR.fundo);
        doc.roundedRect(M, y - 5, L - 2 * M, 15, 2, 2, "F");
        doc.setFillColor(...(x.media == null ? COR.cinza : COR.green));
        doc.rect(M, y - 5, 1.4, 15, "F");
        fonte("bold", 10, COR.navy, "courier");
        texto(x.codigo, M + 5, y + 0.5);
        fonte("bold", 11, COR.tinta);
        const partes = doc.splitTextToSize(x.nome, L - 2 * M - 52);
        texto(partes.length > 1 ? `${partes[0].replace(/[\s,.;:–-]+$/, "")}…` : partes[0], M + 17, y + 0.5);
        fonte("normal", 8.2, COR.cinza);
        texto([disciplina, x.curso, x.stand && `Stand ${x.stand}`, x.equipe].filter(Boolean).join("  ·  ").slice(0, 110), M + 17, y + 6);
        fonte("bold", 15, x.media == null ? COR.cinza : COR.navy);
        texto(fmt(x.media), L - M - 4, y + 2.5, { align: "right" });
        fonte("normal", 7, COR.cinza);
        texto("média final", L - M - 4, y + 6.5, { align: "right" });
        p.y = y + 14;

        if (!x.linhas.length) {
          fonte("normal", 9, COR.cinza);
          texto("Nenhum professor foi designado para este projeto.", M + 2, p.y);
          p.y += 10;
          continue;
        }

        p.tabela(
          {
            head: [["Professor", ...r.criterios.map((c) => `${c.curto || c.nome} (${c.peso})`), "Média"]],
            body: x.linhas.map(({ professor, avaliacao }) =>
              avaliacao
                ? [professor, ...r.criterios.map((c) => fmtCurto(avaliacao.notas?.[c.id])), fmt(Number(avaliacao.media))]
                : [professor, { content: "Ainda não avaliou", colSpan: r.criterios.length + 1, styles: { textColor: COR.alerta, fontStyle: "italic", halign: "center" } }]
            ),
            styles: { fontSize: 8.4, halign: "center" },
            columnStyles: { 0: { halign: "left", cellWidth: 46 }, [r.criterios.length + 1]: { fontStyle: "bold" } },
          },
          4
        );

        const comentarios = x.linhas.filter((l) => l.avaliacao?.comentario?.trim());
        for (const { professor, avaliacao } of comentarios) {
          fonte("normal", 8.6);
          const linhas = doc.splitTextToSize(`“${avaliacao.comentario.trim()}”`, L - 2 * M - 6);
          p.espaco(linhas.length * 3.9 + 6);
          fonte("bold", 8.6, COR.navy);
          texto(professor, M + 2, p.y + 1);
          fonte("italic", 8.6, COR.tinta);
          texto(linhas, M + 2, p.y + 5);
          p.y += linhas.length * 3.9 + 6;
        }
        p.y += 7;
      }
    }

    p.salvar("avaliacoes-feira");
  }

  // As mesmas informações do PDF, em abas de planilha.
  function abasPlanilha(dados) {
    const r = montar(dados);
    const num = (n) => (n == null ? "" : Math.round(n * 100) / 100);
    const resultado = [["Disciplina", "Posição", "Código", "Projeto", "Curso", "Avaliações feitas", "Avaliadores", "Média final"]];
    for (const [disciplina, lista] of r.disciplinas) {
      lista.forEach((x, i) => resultado.push([disciplina, x.media == null ? "" : i + 1, x.codigo, x.nome, x.curso, x.feitas, x.linhas.length, num(x.media)]));
    }
    const notas = [["Código", "Projeto", "Disciplina", "Curso", "Professor", ...r.criterios.map((c) => `${c.nome} (peso ${c.peso})`), "Média do professor", "Comentário", "Situação"]];
    for (const [disciplina, lista] of r.disciplinas) {
      for (const x of lista) {
        for (const { professor, avaliacao } of x.linhas) {
          notas.push([
            x.codigo, x.nome, disciplina, x.curso, professor,
            ...r.criterios.map((c) => (avaliacao ? num(avaliacao.notas?.[c.id]) : "")),
            avaliacao ? num(Number(avaliacao.media)) : "",
            avaliacao?.comentario || "",
            avaliacao ? "Avaliado" : "Pendente",
          ]);
        }
      }
    }
    const profs = [["Professor", "Projetos", "Avaliados", "Pendentes", "Média das notas dadas"]];
    r.porProfessor.forEach((x) => profs.push([x.nome, x.total, x.feitos, x.total - x.feitos, num(x.mediaDada)]));
    return [
      { nome: "Resultado por disciplina", linhas: resultado },
      { nome: "Notas de cada professor", linhas: notas },
      { nome: "Andamento por professor", linhas: profs },
    ];
  }

  const planilha = (dados) => Exportar.planilha("avaliacoes-feira", abasPlanilha(dados));

  return { baixar, montar, planilha };
})();

/* Pódio e votos das urnas */
window.RelatorioVotos = (() => {
  const pct = (n, total) => (total ? Math.round((n / total) * 1000) / 10 : 0);

  // Projetos de cada curso ordenados pelos votos da rodada atual.
  function montar(projetos, { votos, urnas: situacao, rodada, aberta }) {
    const { cursos, urnas } = window.FEIRA;
    const porCurso = cursos.map((c) => {
      const lista = projetos
        .filter((p) => p.curso === c.id)
        .map((p) => ({ ...p, votos: votos[p.codigo] || 0 }))
        .sort((a, b) => b.votos - a.votos || a.nome.localeCompare(b.nome, "pt-BR"));
      const total = lista.reduce((s, p) => s + p.votos, 0);
      return { curso: c, lista, total, podio: lista.filter((p) => p.votos > 0).slice(0, 3) };
    });
    return {
      porCurso,
      total: porCurso.reduce((s, c) => s + c.total, 0),
      urnas: urnas.map((u) => ({ nome: u.nome, votos: situacao[u.id]?.votos || 0, online: !!situacao[u.id]?.online })),
      rodada: rodada || "–",
      aberta,
    };
  }

  async function baixar(projetos, dadosVotos) {
    const r = montar(projetos, dadosVotos);
    const p = await PDF.criar({
      rotulo: "PET ELÉTRICA UFPB  ·  VOTO POPULAR",
      titulo: "Pódio e votos",
      subtitulo: "Feira de Engenharia e Energia",
      cabecalho: "Pódio e votos",
    });
    const { doc, COR } = p;

    p.cartoes([
      ["Votos computados", String(r.total)],
      ["Projetos", String(projetos.length)],
      ["Urnas com dados", `${r.urnas.filter((u) => u.online).length}/${r.urnas.length}`],
      ["Votação", r.aberta ? "Aberta" : "Encerrada"],
    ]);
    p.paragrafo(`Votos da rodada ${r.rodada}, somando as urnas: ${r.urnas.map((u) => `${u.nome} com ${u.votos}`).join(" e ")}. Votos de rodadas anteriores (antes de um "Zerar votação") não entram.`);
    p.y += 4;

    /* Pódio */
    p.tituloSecao("Pódio", "Os três projetos mais votados de cada curso.");
    for (const { curso, podio, total } of r.porCurso) {
      p.subtitulo(curso.nome);
      p.tabela({
        head: [["Lugar", "Código", "Projeto", "Disciplina", "Votos", "% do curso"]],
        body: podio.length
          ? podio.map((x, i) => [`${i + 1}º`, x.codigo, x.nome, x.disciplina || "", x.votos, `${String(pct(x.votos, total)).replace(".", ",")}%`])
          : [[{ content: "Ainda sem votos", colSpan: 6, styles: { halign: "center", textColor: COR.cinza, fontStyle: "italic" } }]],
        columnStyles: {
          0: { cellWidth: 14, halign: "center", fontStyle: "bold" },
          1: { cellWidth: 16, halign: "center", font: "courier" },
          4: { cellWidth: 16, halign: "center", fontStyle: "bold" },
          5: { cellWidth: 20, halign: "center" },
        },
        didParseCell: (c) => {
          if (c.section !== "body" || !podio.length) return;
          const cores = [[253, 236, 190], [232, 232, 238], [245, 222, 200]];
          c.cell.styles.fillColor = cores[c.row.index];
        },
      });
    }

    /* Todos os votos */
    p.tituloSecao("Votos de cada projeto", "Todos os projetos cadastrados, do mais ao menos votado em cada curso.");
    for (const { curso, lista, total } of r.porCurso) {
      if (!lista.length) continue;
      p.subtitulo(`${curso.nome} · ${total} voto${total === 1 ? "" : "s"}`);
      const maior = Math.max(1, ...lista.map((x) => x.votos));
      p.tabela({
        head: [["Pos.", "Código", "Projeto", "Disciplina", "Votos", "%", ""]],
        body: lista.map((x, i) => [x.votos ? `${i + 1}º` : "–", x.codigo, x.nome, x.disciplina || "", x.votos, `${String(pct(x.votos, total)).replace(".", ",")}%`, x.votos]),
        columnStyles: {
          0: { cellWidth: 12, halign: "center" },
          1: { cellWidth: 15, halign: "center", font: "courier" },
          4: { cellWidth: 14, halign: "center", fontStyle: "bold" },
          5: { cellWidth: 14, halign: "center" },
          6: { cellWidth: 30 },
        },
        didParseCell: (c) => {
          if (c.section === "body" && c.column.index === 6) c.cell.text = [""];
        },
        didDrawCell: (c) => {
          if (c.section !== "body" || c.column.index !== 6) return;
          const w = (c.cell.width - 4) * (Number(c.row.raw[6]) / maior);
          doc.setFillColor(...COR.amber);
          if (w > 0) doc.roundedRect(c.cell.x + 2, c.cell.y + c.cell.height / 2 - 1.5, w, 3, 1, 1, "F");
        },
      });
    }

    p.salvar("podio-e-votos");
  }

  function planilha(projetos, dadosVotos) {
    const r = montar(projetos, dadosVotos);
    const podio = [["Curso", "Lugar", "Código", "Projeto", "Disciplina", "Votos"]];
    const votos = [["Curso", "Posição", "Código", "Projeto", "Disciplina", "Equipe", "Votos", "% do curso"]];
    for (const { curso, podio: tres, lista, total } of r.porCurso) {
      tres.forEach((x, i) => podio.push([curso.nome, `${i + 1}º`, x.codigo, x.nome, x.disciplina || "", x.votos]));
      lista.forEach((x, i) => votos.push([curso.nome, x.votos ? i + 1 : "", x.codigo, x.nome, x.disciplina || "", x.equipe || "", x.votos, pct(x.votos, total)]));
    }
    const urnas = [["Urna", "Votos na rodada", "Com dados", "Rodada"], ...r.urnas.map((u) => [u.nome, u.votos, u.online ? "Sim" : "Não", r.rodada])];
    return Exportar.planilha("podio-e-votos", [
      { nome: "Pódio", linhas: podio },
      { nome: "Votos por projeto", linhas: votos },
      { nome: "Urnas", linhas: urnas },
    ]);
  }

  return { baixar, planilha, montar };
})();

/* Relatório das respostas de um formulário de inscrição */
window.RelatorioInscricoes = (() => {
  const NOMES = { alunos: "alunos", professores: "professores", escolas: "escolas" };

  // Colunas: perguntas atuais na ordem do formulário e, no fim, as que já foram removidas.
  function colunas(formulario, inscricoes) {
    const lista = formulario.perguntas.map((q) => ({ id: q.id, texto: q.texto, tipo: q.tipo, opcoes: q.opcoes || [] }));
    const conhecidas = new Set(lista.map((c) => c.id));
    for (const r of inscricoes) {
      for (const [id, resp] of Object.entries(r.respostas)) {
        if (conhecidas.has(id)) continue;
        conhecidas.add(id);
        lista.push({ id, texto: `${resp?.p || id} (pergunta removida)`, tipo: "curta", opcoes: [] });
      }
    }
    return lista;
  }

  const valorTexto = (v) => (Array.isArray(v) ? v.join("; ") : v == null ? "" : String(v));
  const dataHora = (ms) =>
    ms ? new Date(ms).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "–";

  // Linhas prontas para planilha: [cabeçalho, ...linhas]
  function tabela(formulario, inscricoes) {
    const cols = colunas(formulario, inscricoes);
    return [
      ["Nº", "Enviado em", ...cols.map((c) => c.texto)],
      ...inscricoes.map((r, i) => [i + 1, dataHora(r.enviadoEm), ...cols.map((c) => valorTexto(r.respostas[c.id]?.v))]),
    ];
  }

  async function baixar(tipo, formulario, inscricoes) {
    const cols = colunas(formulario, inscricoes);
    const p = await PDF.criar({
      rotulo: `PET ELÉTRICA UFPB  ·  INSCRIÇÕES DE ${NOMES[tipo].toUpperCase()}`,
      titulo: `Inscrições de ${NOMES[tipo]}`,
      subtitulo: formulario.titulo || "Feira de Engenharia e Energia",
      cabecalho: `Inscrições de ${NOMES[tipo]}`,
    });
    const { doc, M, L, COR, texto, fonte } = p;

    const datas = inscricoes.map((r) => r.enviadoEm).filter(Boolean);
    const dia = (ms) => (ms ? new Date(ms).toLocaleDateString("pt-BR") : "–");
    p.cartoes([
      ["Respostas", String(inscricoes.length)],
      ["Perguntas", String(formulario.perguntas.length)],
      ["Primeira resposta", datas.length ? dia(Math.min(...datas)) : "–"],
      ["Última resposta", datas.length ? dia(Math.max(...datas)) : "–"],
    ]);
    if (formulario.descricao) p.paragrafo(formulario.descricao);
    p.y += 4;

    if (!inscricoes.length) {
      p.tituloSecao("Nenhuma resposta ainda", "Quando alguém enviar o formulário, as respostas aparecem aqui.");
      return p.salvar(`inscricoes-${tipo}`);
    }

    /* Resumo das perguntas de escolha */
    const deEscolha = cols.filter((c) => ["unica", "varias", "lista"].includes(c.tipo));
    if (deEscolha.length) {
      p.tituloSecao("Resumo das escolhas", "Quantas pessoas marcaram cada opção. Nas caixas de seleção, uma pessoa pode marcar várias.");
      for (const c of deEscolha) {
        const contagem = new Map(c.opcoes.map((o) => [o, 0]));
        let responderam = 0;
        for (const r of inscricoes) {
          const v = r.respostas[c.id]?.v;
          const marcadas = Array.isArray(v) ? v : v ? [v] : [];
          if (marcadas.length) responderam++;
          for (const o of marcadas) contagem.set(o, (contagem.get(o) || 0) + 1);
        }
        p.subtitulo(c.texto);
        const maior = Math.max(1, ...contagem.values());
        p.tabela({
          head: [["Opção", "Respostas", "%", ""]],
          body: [...contagem.entries()].map(([o, n]) => [o, n, `${responderam ? Math.round((n / responderam) * 100) : 0}%`, n]),
          columnStyles: {
            1: { cellWidth: 22, halign: "center" },
            2: { cellWidth: 16, halign: "center" },
            3: { cellWidth: 52 },
          },
          didParseCell: (d) => {
            if (d.section === "body" && d.column.index === 3) d.cell.text = [""];
          },
          didDrawCell: (d) => {
            if (d.section !== "body" || d.column.index !== 3) return;
            const n = Number(d.row.raw[3]);
            const w = (d.cell.width - 6) * (n / maior);
            doc.setFillColor(...COR.amber);
            if (w > 0) doc.roundedRect(d.cell.x + 3, d.cell.y + d.cell.height / 2 - 1.6, w, 3.2, 1, 1, "F");
          },
        });
      }
    }

    /* Respostas, uma ficha por pessoa */
    p.novaPagina();
    p.tituloSecao("Respostas", `${inscricoes.length} resposta${inscricoes.length === 1 ? "" : "s"}, na ordem de envio.`);
    inscricoes.forEach((r, i) => {
      p.espaco(40);
      const y = p.y;
      const primeira = cols.map((c) => valorTexto(r.respostas[c.id]?.v)).find((v) => v.trim()) || "Sem nome";
      doc.setFillColor(...COR.fundo);
      doc.roundedRect(M, y - 5, L - 2 * M, 12, 2, 2, "F");
      doc.setFillColor(...COR.amber);
      doc.rect(M, y - 5, 1.4, 12, "F");
      fonte("bold", 10, COR.navy, "courier");
      texto(`#${i + 1}`, M + 5, y + 2.6);
      fonte("bold", 11, COR.tinta);
      texto(doc.splitTextToSize(primeira, L - 2 * M - 70)[0], M + 18, y + 2.6);
      fonte("normal", 8, COR.cinza);
      texto(dataHora(r.enviadoEm), L - M - 4, y + 2.6, { align: "right" });
      p.y = y + 10;
      p.tabela(
        {
          showHead: "never",
          body: cols.map((c) => [c.texto, valorTexto(r.respostas[c.id]?.v) || "–"]),
          columnStyles: { 0: { cellWidth: 62, fontStyle: "bold", textColor: COR.navy, fillColor: [250, 250, 252] } },
          alternateRowStyles: {},
        },
        10
      );
    });

    p.salvar(`inscricoes-${tipo}`);
  }

  return { baixar, tabela, colunas, valorTexto, dataHora };
})();
