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
