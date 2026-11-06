// Camada de dados: o resto do site só fala com o Firebase por estas funções.
window.API = (() => {
  const BANCO = "https://fee20261-default-rtdb.firebaseio.com/urna/multiurna";
  // A chave web do Firebase é pública por natureza; quem protege os dados são as regras.
  const CHAVE_WEB = "AIzaSyA27dn6kUmDD_AtaKixZsFK-zE2DMfETP4";
  const UID_PET = "b2Ejyy4jJCYbx0edNZxB3QAnYuE2";

  const { urnas, cursos } = window.FEIRA;
  const CORES = ["amber", "green", "navy"];

  // Textos digitados no site precisam disso antes de entrar em um innerHTML.
  function esc(texto) {
    const div = document.createElement("div");
    div.textContent = texto ?? "";
    return div.innerHTML.replaceAll('"', "&quot;");
  }

  async function lerPublico(caminho) {
    const resposta = await fetch(`${BANCO}${caminho}.json`);
    if (!resposta.ok) {
      throw Object.assign(new Error(`Firebase respondeu ${resposta.status} em ${caminho}`), { status: resposta.status });
    }
    return resposta.json();
  }

  /* Projetos: o código ("5A") é a identidade do projeto em todo o sistema. */
  const CHAVE_CACHE = "feira-pet:projetos-cache";
  const cursoDe = (id) => cursos.find((c) => c.id === id);
  const codigoDe = (curso, numero) => `${numero}${cursoDe(curso).letra}`;

  function completarProjeto(p) {
    const curso = cursoDe(p.curso);
    return {
      ...p,
      id: codigoDe(p.curso, p.numero),
      codigo: codigoDe(p.curso, p.numero),
      arte: curso.artes[p.numero % curso.artes.length],
      cor: CORES[p.numero % CORES.length],
    };
  }

  const ordenar = (lista) =>
    lista.sort((a, b) => cursoDe(a.curso).tecla - cursoDe(b.curso).tecla || a.numero - b.numero);

  async function lerCadastro() {
    let dados;
    try {
      dados = (await lerPublico("/site/projetos")) || {};
    } catch (erro) {
      throw new Error(
        erro.status === 401
          ? "Projeto não salvo: o Firebase ainda não liberou o cadastro. Publique as regras de firebase_rules.json."
          : "Projeto não salvo: não consegui ler o cadastro. Confira a internet e tente de novo."
      );
    }
    return ordenar(Object.values(dados).filter((p) => cursoDe(p?.curso)).map(completarProjeto));
  }

  // Nomes como as urnas publicaram: { urna01: { "5A": { curso, numero, nome } }, ... }
  async function listasGravadas() {
    const respostas = await Promise.allSettled(urnas.map((u) => lerPublico(`/dispositivos/${u.id}/projetos`)));
    const listas = {};
    urnas.forEach((u, i) => {
      listas[u.id] = null;
      if (respostas[i].status !== "fulfilled" || !respostas[i].value) return;
      listas[u.id] = {};
      for (const curso of cursos) {
        for (const [codigo, p] of Object.entries(respostas[i].value[curso.id] || {})) {
          listas[u.id][codigo] = { curso: curso.id, numero: parseInt(codigo, 10), nome: p?.nome || codigo };
        }
      }
    });
    return listas;
  }

  // Para exibir: usa o cadastro; sem cadastro, a lista das urnas; sem rede, a última conhecida.
  async function carregarProjetos() {
    let lista = [];
    try {
      lista = await lerCadastro();
    } catch (erro) {
      console.warn("Cadastro indisponível:", erro.message);
    }
    if (!lista.length) {
      const listas = await listasGravadas();
      const juntos = Object.assign({}, ...Object.values(listas));
      lista = ordenar(Object.values(juntos).filter((p) => p.numero > 0).map(completarProjeto));
    }
    try {
      if (lista.length) localStorage.setItem(CHAVE_CACHE, JSON.stringify(lista));
      else lista = JSON.parse(localStorage.getItem(CHAVE_CACHE)) || [];
    } catch {
      // sem armazenamento, vale o que veio da rede
    }
    return lista;
  }

  /* Votos: soma as duas urnas e ignora dados de rodadas antigas. */
  async function buscarVotos() {
    const [controle, ...respostas] = await Promise.allSettled([
      lerPublico("/controle"),
      ...urnas.map((u) => lerPublico(`/dispositivos/${u.id}/projetos`)),
    ]);
    if (controle.status !== "fulfilled") throw controle.reason;

    const rodada = controle.value?.rodada_id;
    const votos = {};
    const situacao = {};

    urnas.forEach((u, i) => {
      situacao[u.id] = { votos: 0, online: false };
      if (!rodada || respostas[i].status !== "fulfilled") return;
      for (const curso of cursos) {
        for (const [codigo, p] of Object.entries(respostas[i].value?.[curso.id] || {})) {
          if (p?.rodada !== rodada) continue;
          const n = Number(p.votos) || 0;
          votos[codigo] = (votos[codigo] || 0) + n;
          situacao[u.id].votos += n;
          situacao[u.id].online = true;
        }
      }
    });

    return { votos, urnas: situacao, aberta: controle.value?.votacao_aberta !== false, rodada };
  }

  /* Login dos petianos: conta do Firebase Authentication, a senha nunca é guardada. */
  const CHAVE_SESSAO = "feira-pet:sessao";
  const MARGEM_TOKEN = 60000;
  let sessao = null;

  function gravarSessao(nova) {
    sessao = nova;
    try {
      if (nova) sessionStorage.setItem(CHAVE_SESSAO, JSON.stringify(nova));
      else sessionStorage.removeItem(CHAVE_SESSAO);
    } catch {
      // sem armazenamento, a sessão dura até recarregar a página
    }
  }

  function sessaoAtual() {
    if (sessao) return sessao;
    try {
      sessao = JSON.parse(sessionStorage.getItem(CHAVE_SESSAO));
    } catch {
      sessao = null;
    }
    return sessao;
  }

  async function entrar(email, senha) {
    let resposta;
    try {
      resposta = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${CHAVE_WEB}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password: senha, returnSecureToken: true }),
      });
    } catch {
      throw new Error("Sem conexão com o Firebase. Confira a internet e tente de novo.");
    }
    const dados = await resposta.json();
    if (!resposta.ok) {
      const muitas = dados.error?.message?.startsWith("TOO_MANY_ATTEMPTS");
      throw new Error(muitas ? "Muitas tentativas. Aguarde um pouco e tente de novo." : "E-mail ou senha incorretos.");
    }
    if (dados.localId !== UID_PET) throw new Error("Esta conta não tem permissão para gerenciar a feira.");
    gravarSessao({
      email: dados.email,
      idToken: dados.idToken,
      refreshToken: dados.refreshToken,
      expira: Date.now() + Number(dados.expiresIn) * 1000,
    });
    return sessao;
  }

  const sair = () => gravarSessao(null);

  // O Firebase envia um link para criar a nova senha, sempre para o e-mail do PET.
  async function esqueciSenha() {
    let resposta;
    try {
      resposta = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:sendOobCode?key=${CHAVE_WEB}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestType: "PASSWORD_RESET", email: window.FEIRA.emailPet }),
      });
    } catch {
      throw new Error("Sem conexão com o Firebase. Confira a internet e tente de novo.");
    }
    if (!resposta.ok) {
      const dados = await resposta.json().catch(() => ({}));
      const limite = /LIMIT|TOO_MANY/.test(dados.error?.message || "");
      throw new Error(limite ? "Muitos pedidos. Aguarde um pouco e tente de novo." : "Não consegui enviar o e-mail. Tente de novo.");
    }
    return window.FEIRA.emailPet;
  }

  async function tokenValido() {
    const atual = sessaoAtual();
    if (!atual) throw new Error("Sua sessão terminou. Entre de novo.");
    if (Date.now() < atual.expira - MARGEM_TOKEN) return atual.idToken;

    const resposta = await fetch(`https://securetoken.googleapis.com/v1/token?key=${CHAVE_WEB}`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ grant_type: "refresh_token", refresh_token: atual.refreshToken }),
    });
    if (!resposta.ok) {
      sair();
      throw new Error("Sua sessão terminou. Entre de novo.");
    }
    const dados = await resposta.json();
    gravarSessao({
      ...atual,
      idToken: dados.id_token,
      refreshToken: dados.refresh_token,
      expira: Date.now() + Number(dados.expires_in) * 1000,
    });
    return sessao.idToken;
  }

  async function escrever(metodo, caminho, corpo) {
    const token = await tokenValido();
    const resposta = await fetch(`${BANCO}${caminho}.json?auth=${encodeURIComponent(token)}`, {
      method: metodo,
      headers: { "Content-Type": "application/json" },
      body: corpo === undefined ? undefined : JSON.stringify(corpo),
    });
    if (!resposta.ok) throw new Error(`O Firebase recusou a alteração (erro ${resposta.status}).`);
  }

  /* Cadastro */
  function proximoNumero(lista, curso) {
    const usados = lista.filter((p) => p.curso === curso).map((p) => p.numero);
    if (usados.length >= GERADOR_MAX_POR_CURSO) {
      throw new Error(`${cursoDe(curso).curto} chegou ao limite de ${GERADOR_MAX_POR_CURSO} projetos da urna.`);
    }
    const seguinte = Math.max(0, ...usados) + 1;
    if (seguinte <= GERADOR_MAX_NUMERO) return seguinte;
    for (let n = 1; n <= GERADOR_MAX_NUMERO; n++) if (!usados.includes(n)) return n;
    throw new Error("Não há número livre para este curso.");
  }

  // Limites das urnas, os mesmos conferidos ao gerar o .ino.
  const GERADOR_MAX_POR_CURSO = 50;
  const GERADOR_MAX_NUMERO = 99;

  // codigoAtual: projeto em edição. Trocar de curso muda o número na urna.
  async function salvarProjeto(dados, codigoAtual) {
    const lista = await lerCadastro();
    const atual = lista.find((p) => p.codigo === codigoAtual);
    const numero = atual && atual.curso === dados.curso ? atual.numero : proximoNumero(lista, dados.curso);
    const codigo = codigoDe(dados.curso, numero);

    await escrever("PUT", `/site/projetos/${codigo}`, { ...dados, numero });
    if (atual && atual.codigo !== codigo) await escrever("DELETE", `/site/projetos/${atual.codigo}`);
    return completarProjeto({ ...dados, numero });
  }

  const removerProjeto = (codigo) => escrever("DELETE", `/site/projetos/${codigo}`);

  /* Notas: ficam só neste navegador por enquanto. */
  const CHAVE_NOTAS = "feira-pet:notas";

  function lerNotas() {
    try {
      return JSON.parse(localStorage.getItem(CHAVE_NOTAS)) || {};
    } catch {
      return {};
    }
  }

  function notasDoProfessor(professor) {
    return lerNotas()[professor] || {};
  }

  function salvarNota(professor, projetoId, avaliacao) {
    const todas = lerNotas();
    todas[professor] = { ...todas[professor], [projetoId]: avaliacao };
    try {
      localStorage.setItem(CHAVE_NOTAS, JSON.stringify(todas));
      return true;
    } catch {
      return false;
    }
  }

  return {
    esc, carregarProjetos, lerCadastro, listasGravadas, buscarVotos,
    entrar, sair, esqueciSenha, sessaoAtual, salvarProjeto, removerProjeto,
    notasDoProfessor, salvarNota,
  };
})();
