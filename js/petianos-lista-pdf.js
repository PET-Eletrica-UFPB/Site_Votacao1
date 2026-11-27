// "Lista de projetos (PDF)" (aba Projetos): todos os projetos do cadastro, separados por curso e,
// dentro de cada curso, por disciplina, na ordem dos códigos das urnas. Usa $, cursos, projetos,
// disciplinaDe e aviso de petianos.js.
(() => {
  const plural = (n, um, varios) => `${n} ${n === 1 ? um : varios}`;

  async function baixarLista() {
    if (!projetos.length) throw new Error("Nenhum projeto cadastrado ainda.");
    const porCurso = cursos
      .map((c) => ({ curso: c, lista: projetos.filter((p) => p.curso === c.id).sort((a, b) => a.numero - b.numero) }))
      .filter((x) => x.lista.length);
    const nDisc = new Set(projetos.map(disciplinaDe)).size;

    const p = await PDF.criar({
      rotulo: "PET ELÉTRICA UFPB  ·  FEIRA DE ENGENHARIA E ENERGIA",
      titulo: "Lista de projetos",
      subtitulo: "Todos os projetos cadastrados, separados por curso",
      cabecalho: "Lista de projetos",
    });
    p.cartoes([
      ["projetos", projetos.length],
      ...porCurso.map(({ curso, lista }) => [curso.curto, lista.length]),
      ["disciplinas", nDisc],
    ]);

    porCurso.forEach(({ curso, lista }, i) => {
      if (i > 0) p.novaPagina();
      const grupos = new Map();
      for (const projeto of lista) {
        if (!grupos.has(disciplinaDe(projeto))) grupos.set(disciplinaDe(projeto), []);
        grupos.get(disciplinaDe(projeto)).push(projeto);
      }
      p.tituloSecao(
        curso.nome,
        `${plural(lista.length, "projeto", "projetos")} · ${plural(grupos.size, "disciplina", "disciplinas")} · na urna: tecla ${curso.tecla}, código terminado em ${curso.letra}`
      );
      for (const [disciplina, doGrupo] of grupos) {
        p.subtitulo(`${disciplina}  (${plural(doGrupo.length, "projeto", "projetos")})`);
        p.tabela({
          head: [["Código", "Projeto", "Integrantes"]],
          body: doGrupo.map((x) => [x.codigo, x.nome, (x.equipe || "").trim() || "–"]),
          columnStyles: {
            0: { cellWidth: 18, halign: "center", fontStyle: "bold" },
            1: { cellWidth: 82, fontStyle: "bold" },
          },
        });
      }
    });

    p.salvar("lista-de-projetos");
  }

  $("lista-pdf").addEventListener("click", async () => {
    $("lista-pdf").disabled = true;
    aviso("Gerando o PDF da lista de projetos…");
    try {
      await baixarLista();
      aviso("PDF da lista de projetos baixado.");
    } catch (erro) {
      console.error(erro);
      aviso(`Não consegui gerar o PDF. ${erro.message}`, true);
    } finally {
      $("lista-pdf").disabled = false;
    }
  });
})();
