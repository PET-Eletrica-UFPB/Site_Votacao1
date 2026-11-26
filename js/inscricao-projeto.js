// Liga as respostas do formulário dos alunos aos projetos cadastrados.
// Usado pela importação (resposta → projeto novo) e pela correção de respostas na aba Formulários:
// o que muda na resposta muda também no projeto que veio dela.
window.InscricaoProjeto = (() => {
  const { cursos } = window.FEIRA;
  const { valorTexto } = RelatorioInscricoes;

  // Campo do projeto ← pergunta do formulário. "padrao" é o id da pergunta no modelo; "parecido" acha a pergunta se o id mudou.
  const CAMPOS = [
    { campo: "nome", rotulo: "Nome do projeto", padrao: "projeto", parecido: /nome d[oa] (projeto|equipe)|^\s*projeto/i, obrigatorio: true, limite: 80 },
    { campo: "curso", rotulo: "Curso", padrao: "curso", parecido: /^\s*curso/i, obrigatorio: true },
    { campo: "disciplina", rotulo: "Disciplina", padrao: "disciplina", parecido: /disciplina/i, obrigatorio: true, limite: 80 },
    { campo: "equipe", rotulo: "Equipe", padrao: "equipe", parecido: /integrantes|quais alunos/i, limite: 80 },
    { campo: "resumo", rotulo: "Resumo", padrao: "resumo", parecido: /resumo|descri|do que se trata/i, limite: 400 },
    { campo: "stand", rotulo: "Stand", padrao: "stand", parecido: /^\s*(n[uú]mero do )?stand\s*$/i, limite: 10 },
  ];
  // Campos gravados em cada projeto (os mesmos da ficha da aba Projetos).
  const DO_PROJETO = ["nome", "curso", "disciplina", "equipe", "stand", "resumo"];

  const normalizar = (t) => String(t ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
  const cortar = (texto, limite) => (limite && texto.length > limite ? `${texto.slice(0, limite - 1).trimEnd()}…` : texto);

  // Resposta escrita → curso do site. Aceita o nome completo, o curto ou só a palavra principal.
  function acharCurso(resposta) {
    const r = normalizar(resposta);
    if (!r) return null;
    const exato = cursos.find((c) => [c.nome, c.curto, c.id].some((t) => normalizar(t) === r));
    if (exato) return exato.id;
    if (/renov|alternativ/.test(r)) return "renovaveis";
    if (/eletric/.test(r)) return "eletrica";
    return null;
  }

  // Qual pergunta alimenta cada campo. cols: colunas(formulario, inscricoes) do relatório.
  function mapaPadrao(cols) {
    const mapa = {};
    for (const c of CAMPOS) {
      mapa[c.campo] = cols.find((q) => q.id === c.padrao)?.id || cols.find((q) => c.parecido.test(q.texto))?.id || "";
    }
    // O nome de quem se inscreveu não é o nome do projeto.
    if (mapa.nome && /complet|quem/i.test(cols.find((q) => q.id === mapa.nome)?.texto || "")) mapa.nome = "";
    return mapa;
  }

  // Texto de um campo nas respostas.
  function valor(respostas, mapa, campo) {
    const id = mapa[campo];
    if (!id) return "";
    const v = valorTexto(respostas?.[id]?.v);
    // Equipe com um nome por linha vira uma lista separada por vírgulas.
    return campo === "equipe" ? v.split(/\s*[\n;]\s*/).filter(Boolean).join(", ") : v.replace(/\s+/g, " ").trim();
  }

  // Dados do projeto tirados das respostas (curso já como "eletrica"/"renovaveis", ou null).
  function dados(respostas, mapa) {
    const d = {};
    for (const c of CAMPOS) d[c.campo] = c.campo === "curso" ? acharCurso(valor(respostas, mapa, "curso")) : cortar(valor(respostas, mapa, c.campo), c.limite);
    return d;
  }

  // Projeto que veio desta resposta: pelo vínculo gravado ou pelo mesmo nome (de antes ou de depois da correção).
  function projetoDa(projetos, id, ...nomes) {
    const ligado = projetos.find((p) => p.inscricao === id);
    if (ligado) return ligado;
    const procurados = nomes.map(normalizar).filter(Boolean);
    return projetos.find((p) => !p.inscricao && procurados.includes(normalizar(p.nome))) || null;
  }

  // Campos que mudaram entre duas versões das respostas. Nome, curso e disciplina nunca ficam vazios.
  // soSeIgual: só troca o que o projeto ainda tem igual à versão antiga (não desfaz o que foi mudado à mão na aba Projetos).
  function diferencas(antes, depois, projeto, { soSeIgual = false } = {}) {
    const mudou = {};
    for (const campo of DO_PROJETO) {
      const novo = depois[campo] ?? "";
      const velho = antes[campo] ?? "";
      if (novo === velho) continue;
      if (!novo && ["nome", "curso", "disciplina"].includes(campo)) continue;
      const noProjeto = projeto[campo] ?? "";
      if (noProjeto === novo) continue;
      // (o curso pode ter sido escolhido na importação, quando a resposta não dizia o curso)
      if (soSeIgual && noProjeto !== velho && !(campo === "curso" && !velho)) continue;
      mudou[campo] = novo;
    }
    return mudou;
  }

  // Aplica as mudanças nos projetos (uma gravação por projeto). Se algum curso mudou, os códigos
  // são reorganizados por disciplina quando ainda não há votos. Devolve [{ antes, depois, campos }].
  async function aplicar(pendentes) {
    const feitos = [];
    for (const { projeto, mudou, inscricao } of pendentes) {
      const base = Object.fromEntries(DO_PROJETO.map((c) => [c, projeto[c] ?? ""]));
      const salvo = await API.salvarProjeto({ ...base, ...mudou, inscricao }, projeto.codigo);
      feitos.push({ antes: projeto.codigo, depois: salvo.codigo, nome: salvo.nome, campos: Object.keys(mudou) });
    }
    if (feitos.some((f) => f.antes !== f.depois) && window.OrganizarCodigos) {
      try {
        const { mapa, mudaram } = await OrganizarCodigos.executar({ automatico: true });
        if (mapa) feitos.forEach((f) => (f.depois = mapa.get(f.depois) || f.depois));
        feitos.reorganizou = mudaram > 0;
      } catch (erro) {
        console.error(erro);
      }
    }
    if (feitos.length && typeof recarregar === "function") await recarregar();
    return feitos;
  }

  const ROTULOS = { nome: "nome", curso: "curso", disciplina: "disciplina", equipe: "equipe", resumo: "descrição", stand: "stand" };
  // "5A → 3B (curso, disciplina)"
  const descrever = (f) => `${f.antes === f.depois ? f.depois : `${f.antes} → ${f.depois}`} (${f.campos.map((c) => ROTULOS[c]).join(", ")})`;
  // Texto para o aviso: a lista de projetos mudados e, se for o caso, a reorganização dos códigos.
  const resumo = (feitos) =>
    feitos.map(descrever).join("; ") + "." + (feitos.reorganizou ? " Os códigos foram reorganizados para cada disciplina ficar com números seguidos." : "");

  // Depois de corrigir uma resposta na aba Formulários: leva a correção para o projeto.
  // Devolve { projeto: null } se a resposta ainda não virou projeto.
  async function depoisDeEditar(formulario, inscricoes, id, respostasAntes, respostasDepois) {
    if (!(await AjusteAutomatico.ligado())) return { desligado: true };
    const mapa = mapaPadrao(RelatorioInscricoes.colunas(formulario, inscricoes));
    const antes = dados(respostasAntes, mapa);
    const depois = dados(respostasDepois, mapa);
    const lista = await API.lerCadastro();
    const projeto = projetoDa(lista, id, antes.nome, depois.nome);
    if (!projeto) return { projeto: null };
    const mudou = diferencas(antes, depois, projeto);
    if (!Object.keys(mudou).length) {
      // Sem mudança nos dados do projeto; grava o vínculo se ele ainda não existia.
      if (!projeto.inscricao) await aplicar([{ projeto, mudou: {}, inscricao: id }]);
      return { projeto, feitos: [] };
    }
    return { projeto, feitos: await aplicar([{ projeto, mudou, inscricao: id }]) };
  }

  // Respostas corrigidas antes desta ligação existir: compara a original com a corrigida e leva para os projetos
  // o que ainda estiver com o valor antigo. Rodar de novo não muda nada.
  async function sincronizarCorrigidas() {
    if (!(await AjusteAutomatico.ligado())) return [];
    const [formulario, inscricoes, lista] = await Promise.all([API.lerFormulario("alunos"), API.lerInscricoes("alunos"), API.lerCadastro()]);
    const corrigidas = inscricoes.filter((r) => r.original);
    if (!corrigidas.length) return [];
    const mapa = mapaPadrao(RelatorioInscricoes.colunas(formulario, inscricoes));
    const pendentes = [];
    for (const r of corrigidas) {
      const antes = dados(r.original, mapa);
      const depois = dados(r.respostas, mapa);
      const projeto = projetoDa(lista, r.id, antes.nome, depois.nome);
      if (!projeto) continue;
      const mudou = diferencas(antes, depois, projeto, { soSeIgual: true });
      if (Object.keys(mudou).length) pendentes.push({ projeto, mudou, inscricao: r.id });
    }
    return aplicar(pendentes);
  }

  return { CAMPOS, acharCurso, mapaPadrao, valor, dados, projetoDa, depoisDeEditar, sincronizarCorrigidas, descrever, resumo };
})();
