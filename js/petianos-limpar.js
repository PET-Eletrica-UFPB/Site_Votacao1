// Aba "Limpar dados": cópia de segurança e limpeza do banco para uma nova feira. Usa $ e recarregar de petianos.js.
(() => {
  const PALAVRA = "APAGAR";
  const NOMES = {
    votacao: "votação anterior",
    inscricoesAlunos: "respostas dos alunos",
    inscricoesProfessores: "respostas dos professores",
    inscricoesEscolas: "respostas das escolas",
    avaliacoes: "notas",
    projetos: "projetos",
    professores: "professores",
  };
  let contagem = {};

  const caixas = () => [...document.querySelectorAll("#limpar-opcoes [data-parte]")];

  // Apagar projetos ou professores leva as notas junto: a caixa das notas acompanha.
  function escolha() {
    const e = Object.fromEntries(caixas().map((c) => [c.dataset.parte, c.checked]));
    if (e.projetos || e.professores) e.avaliacoes = true;
    return e;
  }

  let notasDoUsuario = false; // o que a pessoa marcou nas notas antes de elas virarem obrigatórias

  function atualizar(ev) {
    const notas = document.querySelector('[data-parte="avaliacoes"]');
    if (ev?.target === notas) notasDoUsuario = notas.checked;
    const forcada = document.querySelector('[data-parte="projetos"]').checked || document.querySelector('[data-parte="professores"]').checked;
    notas.checked = forcada || notasDoUsuario;
    notas.disabled = forcada;
    const e = escolha();

    const partes = Object.keys(NOMES).filter((p) => e[p]);
    $("limpar-resumo").textContent = partes.length
      ? `Vai apagar: ${partes.map((p) => `${NOMES[p]}${contagem[p] != null ? ` (${contagem[p]})` : ""}`).join(", ")}.`
      : "Nada selecionado.";
    $("limpar-apagar").disabled = !partes.length || $("limpar-confirmacao").value.trim().toUpperCase() !== PALAVRA;
  }

  async function contar() {
    try {
      contagem = await API.contarDados();
      for (const [parte, n] of Object.entries(contagem)) {
        const el = document.querySelector(`[data-conta="${parte}"]`);
        if (el) el.textContent = n ?? "–";
        const info = document.querySelector(`[data-info="${parte}"]`);
        if (info) info.textContent = n == null ? "sem dados" : `${n} ${INFO[parte]}${n === 1 ? "" : "s"}`;
      }
    } catch (erro) {
      $("limpar-feedback").textContent = `Não consegui contar os dados. ${erro.message}`;
      $("limpar-feedback").classList.add("erro");
    }
    atualizar();
  }

  function baixarJson(nome, objeto) {
    const url = URL.createObjectURL(new Blob([JSON.stringify(objeto, null, 2)], { type: "application/json" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = nome;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  let copiaFeita = false;
  const INFO = { inscricoesAlunos: "resposta", inscricoesProfessores: "resposta", inscricoesEscolas: "resposta", avaliacoes: "nota", votacao: "voto" };

  /* Relatórios de backup: cada item em PDF ou Excel */
  const GERADORES = {
    async alunos(formato) { return formulario("alunos", formato); },
    async professores(formato) { return formulario("professores", formato); },
    async escolas(formato) { return formulario("escolas", formato); },
    async notas(formato) {
      const [projetos, professores, avaliacoes] = await Promise.all([API.lerCadastro(), API.listarProfessores(), API.lerAvaliacoes()]);
      const dados = { projetos, professores, avaliacoes };
      return formato === "pdf" ? Relatorio.baixar(dados) : Relatorio.planilha(dados);
    },
    async votos(formato) {
      const [projetos, votos] = await Promise.all([API.lerCadastro(), API.buscarVotos()]);
      return formato === "pdf" ? RelatorioVotos.baixar(projetos, votos) : RelatorioVotos.planilha(projetos, votos);
    },
  };

  async function formulario(tipo, formato) {
    const [form, inscricoes] = await Promise.all([API.lerFormulario(tipo), API.lerInscricoes(tipo)]);
    return formato === "pdf"
      ? RelatorioInscricoes.baixar(tipo, form, inscricoes)
      : Exportar.tabela(`inscricoes-${tipo}`, `Inscrições ${tipo}`, RelatorioInscricoes.tabela(form, inscricoes));
  }

  function situacaoCopia(texto, classe = "") {
    $("copia-situacao").className = `urna-situacao ${classe}`;
    $("copia-situacao").textContent = texto;
  }

  const NOMES_BACKUP = { alunos: "formulário dos alunos", professores: "formulário dos professores", escolas: "formulário das escolas", notas: "notas dos professores", votos: "pódio e votos" };

  async function gerar(item, formato) {
    await GERADORES[item](formato);
    copiaFeita = true;
  }

  $("backups").addEventListener("click", async (e) => {
    const botao = e.target.closest("[data-formato]");
    if (!botao) return;
    const item = botao.closest("[data-backup]").dataset.backup;
    const formato = botao.dataset.formato;
    botao.disabled = true;
    situacaoCopia(`Gerando ${formato === "pdf" ? "o PDF" : "a planilha"}: ${NOMES_BACKUP[item]}…`);
    try {
      await gerar(item, formato);
      situacaoCopia(`Baixado: ${NOMES_BACKUP[item]} (${formato === "pdf" ? "PDF" : "Excel"}).`, "ok");
    } catch (erro) {
      console.error(erro);
      situacaoCopia(`Não consegui gerar: ${NOMES_BACKUP[item]}. ${erro.message}`, "alerta");
    } finally {
      botao.disabled = false;
    }
  });

  // Tudo de uma vez: o navegador pode perguntar se permite baixar vários arquivos.
  $("baixar-tudo").addEventListener("click", async () => {
    const botoes = document.querySelectorAll("#backups button, #baixar-tudo");
    botoes.forEach((b) => (b.disabled = true));
    const falhas = [];
    let feitos = 0;
    const itens = Object.keys(GERADORES);
    for (const item of itens) {
      for (const formato of ["pdf", "excel"]) {
        situacaoCopia(`Gerando ${++feitos} de ${itens.length * 2}: ${NOMES_BACKUP[item]} (${formato === "pdf" ? "PDF" : "Excel"})…`);
        try {
          await gerar(item, formato);
        } catch (erro) {
          console.error(erro);
          falhas.push(`${NOMES_BACKUP[item]} (${formato})`);
        }
        await new Promise((r) => setTimeout(r, 700));
      }
    }
    botoes.forEach((b) => (b.disabled = false));
    situacaoCopia(
      falhas.length
        ? `Baixei ${itens.length * 2 - falhas.length} arquivos; falharam: ${falhas.join(", ")}.`
        : `Pronto: ${itens.length * 2} arquivos baixados. Se faltar algum, confira se o navegador bloqueou downloads múltiplos.`,
      falhas.length ? "alerta" : "ok"
    );
  });

  $("baixar-copia").addEventListener("click", async () => {
    $("baixar-copia").disabled = true;
    $("copia-situacao").className = "urna-situacao";
    $("copia-situacao").textContent = "Lendo o banco…";
    try {
      baixarJson(`copia-feira-${new Date().toISOString().slice(0, 10)}.json`, await API.copiaDeSeguranca());
      copiaFeita = true;
      $("copia-situacao").className = "urna-situacao ok";
      $("copia-situacao").textContent = "Cópia baixada. Guarde o arquivo junto com os PDFs da feira.";
    } catch (erro) {
      $("copia-situacao").className = "urna-situacao alerta";
      $("copia-situacao").textContent = `Não consegui gerar a cópia. ${erro.message}`;
    } finally {
      $("baixar-copia").disabled = false;
    }
  });

  $("limpar-opcoes").addEventListener("change", atualizar);
  $("limpar-confirmacao").addEventListener("input", atualizar);

  $("limpar-apagar").addEventListener("click", async () => {
    const e = escolha();
    if (!copiaFeita && !confirm("Você ainda não baixou a cópia de segurança nesta sessão. Apagar mesmo assim? Isso não pode ser desfeito.")) return;
    $("limpar-apagar").disabled = true;
    $("limpar-feedback").classList.remove("erro");
    $("limpar-feedback").textContent = "Apagando…";
    try {
      await API.limparDados(e);
      $("limpar-confirmacao").value = "";
      $("limpar-feedback").textContent = "Pronto: os dados selecionados foram apagados.";
      await recarregar();
      PainelFormularios.recarregar();
      await contar();
    } catch (erro) {
      $("limpar-feedback").classList.add("erro");
      $("limpar-feedback").textContent = `Não consegui apagar tudo. ${erro.message}`;
      atualizar();
    }
  });

  // Recontar sempre que a aba for aberta.
  document.querySelector('.painel-topo [data-aba="limpar"]').addEventListener("click", contar);
})();
