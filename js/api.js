// Camada de dados: o resto do site só fala com o Firebase por estas funções.
window.API = (() => {
  const BANCO = "https://fee20261-default-rtdb.firebaseio.com/urna/multiurna";
  // A chave web do Firebase é pública por natureza; quem protege os dados são as regras.
  const CHAVE_WEB = "AIzaSyA27dn6kUmDD_AtaKixZsFK-zE2DMfETP4";
  const UID_PET = "b2Ejyy4jJCYbx0edNZxB3QAnYuE2";
  const CONTAS = "https://identitytoolkit.googleapis.com/v1/accounts";
  // Cada professor ganha uma conta própria no Firebase Authentication. O e-mail é
  // só um identificador interno (nunca recebe mensagens): o professor entra
  // escolhendo o nome e digitando o código de acesso, que é a senha dessa conta.
  const DOMINIO_PROFESSOR = "professores.feira-pet-ufpb.example.com";

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
          ? "Projeto não salvo: o Firebase ainda não liberou o cadastro. Publique as regras de REGRAS_FIREBASE.md."
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

  /* Contas do Firebase Authentication. A senha nunca é guardada, só os tokens da
     sessão, e cada área (petianos e professores) tem a sua. */
  const MARGEM_TOKEN = 60000;

  function criarConta(chave) {
    let sessao = null;

    function gravar(nova) {
      sessao = nova;
      try {
        if (nova) sessionStorage.setItem(chave, JSON.stringify(nova));
        else sessionStorage.removeItem(chave);
      } catch {
        // sem armazenamento, a sessão dura até recarregar a página
      }
    }

    function atual() {
      if (sessao) return sessao;
      try {
        sessao = JSON.parse(sessionStorage.getItem(chave));
      } catch {
        sessao = null;
      }
      return sessao;
    }

    async function token() {
      const s = atual();
      if (!s) throw new Error("Sua sessão terminou. Entre de novo.");
      if (Date.now() < s.expira - MARGEM_TOKEN) return s.idToken;

      const resposta = await fetch(`https://securetoken.googleapis.com/v1/token?key=${CHAVE_WEB}`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ grant_type: "refresh_token", refresh_token: s.refreshToken }),
      });
      if (!resposta.ok) {
        gravar(null);
        throw new Error("Sua sessão terminou. Entre de novo.");
      }
      const dados = await resposta.json();
      gravar({
        ...s,
        idToken: dados.id_token,
        refreshToken: dados.refresh_token,
        expira: Date.now() + Number(dados.expires_in) * 1000,
      });
      return sessao.idToken;
    }

    return { gravar, atual, token, sair: () => gravar(null) };
  }

  const contaPet = criarConta("feira-pet:sessao");
  const contaProfessor = criarConta("feira-pet:professor");

  async function chamarContas(acao, corpo) {
    let resposta;
    try {
      resposta = await fetch(`${CONTAS}:${acao}?key=${CHAVE_WEB}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(corpo),
      });
    } catch {
      throw new Error("Sem conexão com o Firebase. Confira a internet e tente de novo.");
    }
    const dados = await resposta.json().catch(() => ({}));
    if (!resposta.ok) {
      const codigo = dados.error?.message || "";
      throw Object.assign(new Error(codigo || `Erro ${resposta.status}`), { codigo });
    }
    return dados;
  }

  async function login(email, senha, msgErrada) {
    try {
      return await chamarContas("signInWithPassword", { email, password: senha, returnSecureToken: true });
    } catch (erro) {
      if (!erro.codigo) throw erro;
      throw new Error(erro.codigo.startsWith("TOO_MANY_ATTEMPTS") ? "Muitas tentativas. Aguarde um pouco e tente de novo." : msgErrada);
    }
  }

  const sessaoDe = (dados, extra = {}) => ({
    ...extra,
    email: dados.email,
    idToken: dados.idToken,
    refreshToken: dados.refreshToken,
    expira: Date.now() + Number(dados.expiresIn) * 1000,
  });

  /* Login dos petianos */
  async function entrar(email, senha) {
    const dados = await login(email, senha, "E-mail ou senha incorretos.");
    if (dados.localId !== UID_PET) throw new Error("Esta conta não tem permissão para gerenciar a feira.");
    contaPet.gravar(sessaoDe(dados));
    return contaPet.atual();
  }

  // O Firebase envia um link para criar a nova senha, sempre para o e-mail do PET.
  async function esqueciSenha() {
    try {
      await chamarContas("sendOobCode", { requestType: "PASSWORD_RESET", email: window.FEIRA.emailPet });
    } catch (erro) {
      if (!erro.codigo) throw erro;
      throw new Error(/LIMIT|TOO_MANY/.test(erro.codigo) ? "Muitos pedidos. Aguarde um pouco e tente de novo." : "Não consegui enviar o e-mail. Tente de novo.");
    }
    return window.FEIRA.emailPet;
  }

  async function pedir(conta, metodo, caminho, corpo) {
    const token = await conta.token();
    let resposta;
    try {
      resposta = await fetch(`${BANCO}${caminho}.json?auth=${encodeURIComponent(token)}`, {
        method: metodo,
        headers: { "Content-Type": "application/json" },
        body: corpo === undefined ? undefined : JSON.stringify(corpo),
      });
    } catch {
      throw new Error("Sem conexão com o Firebase. Confira a internet e tente de novo.");
    }
    if (resposta.status === 401) {
      throw Object.assign(new Error("O Firebase recusou o acesso. Confira se as regras de REGRAS_FIREBASE.md já foram publicadas."), { status: 401 });
    }
    if (!resposta.ok) throw new Error(`O Firebase recusou a alteração (erro ${resposta.status}).`);
    return resposta.json();
  }

  const escrever = (metodo, caminho, corpo) => pedir(contaPet, metodo, caminho, corpo);
  // Grava vários caminhos de /site de uma vez: ou tudo entra, ou nada muda.
  const atualizarSite = (mudancas) => escrever("PATCH", "/site", mudancas);

  /* Cadastro */
  // Limites das urnas, os mesmos conferidos ao gerar o .ino.
  const GERADOR_MAX_POR_CURSO = 50;
  const GERADOR_MAX_NUMERO = 99;

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

  // Quando o código de um projeto muda (ou ele sai), leva junto as atribuições e notas.
  async function mudancasDeCodigo(antigo, novo) {
    const [professores, avaliacoes] = await Promise.all([
      lerPublico("/site/professores").then((d) => d || {}),
      escrever("GET", "/site/avaliacoes").then((d) => d || {}),
    ]);
    const mudancas = {};
    for (const [uid, prof] of Object.entries(professores)) {
      if (!prof?.projetos?.[antigo]) continue;
      mudancas[`professores/${uid}/projetos/${antigo}`] = null;
      if (novo) mudancas[`professores/${uid}/projetos/${novo}`] = true;
    }
    for (const [uid, notas] of Object.entries(avaliacoes)) {
      if (!notas?.[antigo]) continue;
      mudancas[`avaliacoes/${uid}/${antigo}`] = null;
      if (novo) mudancas[`avaliacoes/${uid}/${novo}`] = notas[antigo];
    }
    return mudancas;
  }

  // codigoAtual: projeto em edição. Trocar de curso muda o número na urna.
  async function salvarProjeto(dados, codigoAtual) {
    const lista = await lerCadastro();
    const atual = lista.find((p) => p.codigo === codigoAtual);
    const numero = atual && atual.curso === dados.curso ? atual.numero : proximoNumero(lista, dados.curso);
    const codigo = codigoDe(dados.curso, numero);

    // Mantém o vínculo com a inscrição de onde o projeto veio, se houver.
    const extra = atual?.inscricao ? { inscricao: atual.inscricao } : {};
    const mudancas = { [`projetos/${codigo}`]: { ...dados, ...extra, numero } };
    if (atual && atual.codigo !== codigo) {
      mudancas[`projetos/${atual.codigo}`] = null;
      Object.assign(mudancas, await mudancasDeCodigo(atual.codigo, codigo));
    }
    await atualizarSite(mudancas);
    return completarProjeto({ ...dados, numero });
  }

  async function removerProjeto(codigo) {
    await atualizarSite({ [`projetos/${codigo}`]: null, ...(await mudancasDeCodigo(codigo, null)) });
  }

  // Cadastra vários projetos de uma vez (vindos das inscrições): ou entram todos, ou nenhum.
  async function importarProjetos(novos) {
    const lista = await lerCadastro();
    const mudancas = {};
    const criados = [];
    for (const dados of novos) {
      const numero = proximoNumero(lista, dados.curso);
      const projeto = { ...dados, numero };
      lista.push(projeto);
      mudancas[`projetos/${codigoDe(dados.curso, numero)}`] = projeto;
      criados.push(completarProjeto(projeto));
    }
    if (criados.length) await atualizarSite(mudancas);
    return criados;
  }

  /* Frequência dos alunos: { presenca: { chave: true }, extras: { id: aluno }, removidos: { chave: true } } */
  const lerFrequencia = async () => (await escrever("GET", "/site/frequencia")) || {};
  // mudancas: caminhos dentro de /site/frequencia (ex.: "presenca/abc": true)
  const salvarFrequencia = (mudancas) =>
    atualizarSite(Object.fromEntries(Object.entries(mudancas).map(([k, v]) => [`frequencia/${k}`, v])));

  /* Planta da feira: { edicao, disciplinas: { chave: { local, sala, ordem } } } */
  const lerPlanta = async () => (await escrever("GET", "/site/planta")) || {};
  // PATCH: não apaga a prioridade dos códigos, que fica na mesma pasta.
  const salvarPlanta = (planta) => escrever("PATCH", "/site/planta", planta);
  // Prioridade das disciplinas nos códigos: ["eletrica|integradora-i", "renovaveis|…", …]
  // Interruptor "Ajuste automático" da aba Projetos (true/false).
  const salvarAjusteAutomatico = (ligado) => escrever("PUT", "/site/planta/ajusteAutomatico", !!ligado);
  const salvarPrioridade = (lista) => escrever("PUT", "/site/planta/prioridade", lista.length ? lista : null);

  /* Códigos em sequência por disciplina: em cada curso, os projetos de uma mesma disciplina
     ficam com números seguidos (1A, 2A, 3A da mesma disciplina, depois a próxima…).
     ordemDe(nomeDaDisciplina, curso) dá a posição de cada disciplina (a ordem da planta).
     Leva junto as atribuições dos professores e as notas, tudo numa gravação só. */
  async function organizarCodigos(ordemDe) {
    const lista = await lerCadastro();
    const chave = (t) => String(t || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
    const novoNumero = new Map(); // código antigo → número novo
    for (const curso of cursos) {
      const grupos = new Map();
      for (const p of lista.filter((x) => x.curso === curso.id)) {
        const k = chave(p.disciplina);
        if (!grupos.has(k)) grupos.set(k, { nome: (p.disciplina || "").trim(), projetos: [] });
        grupos.get(k).projetos.push(p);
      }
      let n = 1;
      [...grupos.values()]
        .sort((a, b) => ordemDe(a.nome, curso.id) - ordemDe(b.nome, curso.id) || a.nome.localeCompare(b.nome, "pt-BR"))
        .forEach((g) => g.projetos.sort((a, b) => a.numero - b.numero).forEach((p) => novoNumero.set(p.codigo, n++)));
    }
    const mapa = new Map(lista.map((p) => [p.codigo, codigoDe(p.curso, novoNumero.get(p.codigo))]));
    const mudaram = [...mapa].filter(([antes, depois]) => antes !== depois).length;
    if (!mudaram) return { mudaram: 0, mapa };

    const projetos = {};
    for (const p of lista) {
      const { id, codigo, arte, cor, ...guardado } = p; // campos calculados não vão para o banco
      projetos[mapa.get(p.codigo)] = { ...guardado, numero: novoNumero.get(p.codigo) };
    }
    const [professores, avaliacoes] = await Promise.all([
      lerPublico("/site/professores").then((d) => d || {}),
      escrever("GET", "/site/avaliacoes").then((d) => d || {}),
    ]);
    const mudancas = { projetos };
    const trocar = (obj) => Object.fromEntries(Object.entries(obj || {}).map(([c, v]) => [mapa.get(c) || c, v]));
    for (const [uid, prof] of Object.entries(professores)) if (prof?.projetos) mudancas[`professores/${uid}/projetos`] = trocar(prof.projetos);
    for (const [uid, notas] of Object.entries(avaliacoes)) if (notas) mudancas[`avaliacoes/${uid}`] = trocar(notas);
    await atualizarSite(mudancas);
    return { mudaram, mapa };
  }

  /* Professores (cadastrados pelos petianos) */
  function listaDeProfessores(dados) {
    return Object.entries(dados || {})
      .filter(([, p]) => p?.nome && p?.login)
      .map(([uid, p]) => ({ uid, nome: p.nome, login: p.login, curso: p.curso || "", projetos: Object.keys(p.projetos || {}) }))
      .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
  }

  const listarProfessores = async () => listaDeProfessores(await lerPublico("/site/professores"));

  // Só os petianos leem os códigos, para poder lembrar um professor que esqueceu o dele.
  const codigosDosProfessores = async () => (await escrever("GET", "/site/professores_codigos")) || {};

  function conferirCodigo(codigo) {
    if (String(codigo).length < 6) throw new Error("O código de acesso precisa ter pelo menos 6 caracteres.");
  }

  const projetosComoObjeto = (codigos) => Object.fromEntries(codigos.map((c) => [c, true]));

  // curso: "eletrica" ou "renovaveis" (professor de Elétrica ou de Renováveis); vazio = não informado.
  async function cadastrarProfessor({ nome, codigo, projetos, curso }) {
    conferirCodigo(codigo);
    const login = `prof-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}@${DOMINIO_PROFESSOR}`;
    let conta;
    try {
      conta = await chamarContas("signUp", { email: login, password: codigo, returnSecureToken: true });
    } catch (erro) {
      if (/OPERATION_NOT_ALLOWED|ADMIN_ONLY/.test(erro.codigo)) {
        throw new Error("O Firebase não está deixando criar contas. Ative o login por e-mail/senha no Firebase Authentication.");
      }
      if (/WEAK_PASSWORD/.test(erro.codigo)) throw new Error("Código fraco demais: use pelo menos 6 caracteres.");
      throw new Error(`Não consegui criar a conta do professor (${erro.message}).`);
    }
    try {
      await atualizarSite({
        [`professores/${conta.localId}`]: { nome, login, projetos: projetosComoObjeto(projetos), ...(curso ? { curso } : {}) },
        [`professores_codigos/${conta.localId}`]: codigo,
      });
    } catch (erro) {
      // sem o cadastro no banco a conta não serve para nada: desfaz
      chamarContas("delete", { idToken: conta.idToken }).catch(() => {});
      throw erro;
    }
    return conta.localId;
  }

  // Entra na conta do professor com o código atual para trocar a senha ou apagá-la.
  async function contaDoProfessor(uid) {
    const [prof, codigo] = await Promise.all([lerPublico(`/site/professores/${uid}`), escrever("GET", `/site/professores_codigos/${uid}`)]);
    if (!prof?.login || !codigo) return null;
    try {
      return await chamarContas("signInWithPassword", { email: prof.login, password: codigo, returnSecureToken: true });
    } catch {
      return null;
    }
  }

  // curso fica como está se não vier (undefined); "" apaga.
  async function atualizarProfessor(uid, { nome, codigo, projetos, curso }) {
    conferirCodigo(codigo);
    const codigoAntigo = await escrever("GET", `/site/professores_codigos/${uid}`);
    if (codigo !== codigoAntigo) {
      const conta = await contaDoProfessor(uid);
      if (!conta) throw new Error("Não consegui trocar o código deste professor. Exclua e cadastre de novo.");
      await chamarContas("update", { idToken: conta.idToken, password: codigo, returnSecureToken: false });
    }
    await atualizarSite({
      [`professores/${uid}/nome`]: nome,
      [`professores/${uid}/projetos`]: projetosComoObjeto(projetos),
      [`professores_codigos/${uid}`]: codigo,
      ...(curso !== undefined ? { [`professores/${uid}/curso`]: curso || null } : {}),
    });
  }

  async function removerProfessor(uid) {
    const conta = await contaDoProfessor(uid);
    if (conta) await chamarContas("delete", { idToken: conta.idToken }).catch(() => {});
    await atualizarSite({ [`professores/${uid}`]: null, [`professores_codigos/${uid}`]: null, [`avaliacoes/${uid}`]: null });
  }

  // Todas as notas: { uid: { "5A": { notas, comentario, media, salvoEm } } }
  const lerAvaliacoes = async () => (await escrever("GET", "/site/avaliacoes")) || {};

  /* Área do professor */
  async function entrarProfessor(uid, codigo) {
    const prof = await lerPublico(`/site/professores/${uid}`);
    if (!prof?.login) throw new Error("Professor não encontrado. Fale com a organização.");
    const dados = await login(prof.login, codigo, "Código de acesso incorreto.");
    if (dados.localId !== uid) throw new Error("Código de acesso incorreto.");
    contaProfessor.gravar(sessaoDe(dados, { uid, nome: prof.nome }));
    return contaProfessor.atual();
  }

  // Dados do professor logado, sempre relidos (os petianos podem mudar a lista).
  async function meuPerfil() {
    const { uid } = contaProfessor.atual();
    const prof = await lerPublico(`/site/professores/${uid}`);
    if (!prof) throw new Error("Seu cadastro não foi encontrado. Fale com a organização.");
    return { uid, nome: prof.nome, projetos: Object.keys(prof.projetos || {}) };
  }

  async function minhasAvaliacoes() {
    const { uid } = contaProfessor.atual();
    return (await pedir(contaProfessor, "GET", `/site/avaliacoes/${uid}`)) || {};
  }

  async function salvarAvaliacao(codigo, avaliacao) {
    const { uid } = contaProfessor.atual();
    await pedir(contaProfessor, "PUT", `/site/avaliacoes/${uid}/${codigo}`, avaliacao);
  }

  /* Inscrições: um formulário para alunos e outro para professores, montados pelos petianos. */
  const TIPOS_FORMULARIO = ["alunos", "professores", "escolas", "avaliacao"];

  function conferirTipo(tipo) {
    if (!TIPOS_FORMULARIO.includes(tipo)) throw new Error(`Formulário desconhecido: ${tipo}`);
  }

  // Formulário como está no Firebase, ou o modelo de data.js se ainda não foi salvo.
  async function lerFormulario(tipo) {
    conferirTipo(tipo);
    const salvo = await lerPublico(`/site/formularios/${tipo}`);
    const base = salvo || { ...window.FEIRA.formulariosPadrao[tipo], aberto: false };
    return { ...base, perguntas: (base.perguntas || []).filter(Boolean), salvo: !!salvo };
  }

  async function salvarFormulario(tipo, { titulo, descricao, aberto, perguntas }) {
    conferirTipo(tipo);
    await escrever("PUT", `/site/formularios/${tipo}`, { titulo, descricao, aberto: !!aberto, perguntas });
  }

  async function definirInscricoesAbertas(tipo, aberto) {
    conferirTipo(tipo);
    await escrever("PUT", `/site/formularios/${tipo}/aberto`, !!aberto);
  }

  // Envio público: ninguém precisa entrar para se inscrever, mas só se o formulário estiver aberto.
  async function enviarInscricao(tipo, respostas) {
    conferirTipo(tipo);
    let resposta;
    try {
      resposta = await fetch(`${BANCO}/site/inscricoes/${tipo}.json`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enviadoEm: { ".sv": "timestamp" }, respostas }),
      });
    } catch {
      throw new Error("Sem conexão. Confira a internet e tente de novo; suas respostas continuam aqui.");
    }
    if (resposta.status === 401) throw new Error("As inscrições foram fechadas pela organização.");
    if (!resposta.ok) throw new Error(`Não consegui enviar (erro ${resposta.status}). Tente de novo.`);
  }

  // Respostas: { id: { enviadoEm, respostas: { idPergunta: { p: texto da pergunta, v: valor } } } }
  async function lerInscricoes(tipo) {
    conferirTipo(tipo);
    const dados = (await escrever("GET", `/site/inscricoes/${tipo}`)) || {};
    return Object.entries(dados)
      .map(([id, r]) => ({ id, enviadoEm: Number(r?.enviadoEm) || 0, respostas: r?.respostas || {}, editadoEm: Number(r?.editadoEm) || 0, original: r?.original || null }))
      .sort((a, b) => a.enviadoEm - b.enviadoEm);
  }

  // Corrige as respostas de uma inscrição. Na primeira correção, guarda as respostas originais em "original".
  async function editarInscricao(tipo, id, respostas) {
    conferirTipo(tipo);
    const atual = await escrever("GET", `/site/inscricoes/${tipo}/${id}`);
    if (!atual) throw new Error("Esta resposta não existe mais.");
    await escrever("PATCH", `/site/inscricoes/${tipo}/${id}`, {
      respostas,
      editadoEm: { ".sv": "timestamp" },
      ...(atual.original ? {} : { original: atual.respostas || {} }),
    });
  }

  async function removerInscricao(tipo, id) {
    conferirTipo(tipo);
    await escrever("DELETE", `/site/inscricoes/${tipo}/${id}`);
  }

  // Respostas vindas de uma planilha (ex.: Google Forms), gravadas de uma vez com a data original.
  // linhas: [{ enviadoEm, respostas, planilha }]; "planilha" identifica a linha para não importar duas vezes.
  async function importarInscricoes(tipo, linhas, perguntasNovas) {
    conferirTipo(tipo);
    const mudancas = {};
    linhas.forEach((l, i) => {
      const id = `pl${Date.now().toString(36)}${String(i).padStart(4, "0")}${Math.random().toString(36).slice(2, 5)}`;
      mudancas[`inscricoes/${tipo}/${id}`] = { enviadoEm: l.enviadoEm, respostas: l.respostas, planilha: l.planilha };
    });
    if (perguntasNovas) mudancas[`formularios/${tipo}/perguntas`] = perguntasNovas;
    if (Object.keys(mudancas).length) await atualizarSite(mudancas);
  }

  // Assinaturas das linhas de planilha já importadas.
  async function assinaturasImportadas(tipo) {
    conferirTipo(tipo);
    const dados = (await escrever("GET", `/site/inscricoes/${tipo}`)) || {};
    return new Set(Object.values(dados).map((r) => r?.planilha).filter(Boolean));
  }

  /* Edições anteriores (página Feiras). Sem nada no Firebase, a página usa feiras-dados.js. */
  const numeroEdicao = (f) => parseFloat(String(f.edicao).replace(",", ".")) || 0;

  async function lerFeiras() {
    const dados = await lerPublico("/site/feiras");
    if (!dados) return null;
    return Object.entries(dados)
      .map(([id, f]) => ({ ...f, id, fotos: f.fotos || [], numeros: f.numeros || [], vencedores: f.vencedores || [] }))
      .sort((a, b) => numeroEdicao(b) - numeroEdicao(a));
  }

  async function salvarFeira(id, feira) {
    const chave = id || `f${Date.now().toString(36)}`;
    await escrever("PUT", `/site/feiras/${chave}`, feira);
    return chave;
  }

  const removerFeira = (id) => escrever("DELETE", `/site/feiras/${id}`);

  // Grava de uma vez as edições que estavam fixas no código do site.
  async function publicarFeirasIniciais(lista) {
    const mudancas = {};
    lista.forEach((f, i) => {
      mudancas[`feiras/f${String(i).padStart(2, "0")}${f.edicao.replace(/\W/g, "")}`] = f;
    });
    await atualizarSite(mudancas);
  }

  /* Nova feira: cópia de segurança e limpeza do que ficou da anterior. */
  const PARTES_SITE = ["projetos", "professores", "professores_codigos", "avaliacoes", "formularios", "inscricoes", "feiras", "frequencia", "planta"];

  // Tudo que o site guarda, num objeto só (para baixar em .json antes de apagar).
  async function copiaDeSeguranca() {
    // A frequência só pode ser lida depois que as regras novas forem publicadas; sem elas, a cópia sai sem ela.
    const partes = await Promise.all(
      PARTES_SITE.map((p) => escrever("GET", `/site/${p}`).catch((erro) => (["frequencia", "planta"].includes(p) ? null : Promise.reject(erro))))
    );
    return { geradoEm: new Date().toISOString(), banco: "urna/multiurna/site", ...Object.fromEntries(PARTES_SITE.map((p, i) => [p, partes[i]])) };
  }

  // Quanto existe hoje de cada coisa que pode ser apagada.
  async function contarDados() {
    const [projetos, professores, avaliacoes, alunos, profs, escolas, satisfacao] = await Promise.all([
      lerPublico("/site/projetos"),
      lerPublico("/site/professores"),
      escrever("GET", "/site/avaliacoes"),
      escrever("GET", "/site/inscricoes/alunos"),
      escrever("GET", "/site/inscricoes/professores"),
      escrever("GET", "/site/inscricoes/escolas"),
      escrever("GET", "/site/inscricoes/avaliacao"),
    ]);
    const n = (o) => Object.keys(o || {}).length;
    let votos = null;
    try {
      votos = Object.values((await buscarVotos()).votos).reduce((s, v) => s + v, 0);
    } catch {
      // sem o controle das urnas, a contagem fica em branco
    }
    return {
      votacao: votos,
      inscricoesAlunos: n(alunos),
      inscricoesProfessores: n(profs),
      inscricoesEscolas: n(escolas),
      inscricoesAvaliacao: n(satisfacao),
      projetos: n(projetos),
      avaliacoes: Object.values(avaliacoes || {}).reduce((s, x) => s + n(x), 0),
      professores: n(professores),
    };
  }

  // escolha: { inscricoesAlunos, inscricoesProfessores, projetos, avaliacoes, professores } (true = apagar)
  async function limparDados(escolha) {
    const mudancas = {};
    if (escolha.inscricoesAlunos) {
      mudancas["inscricoes/alunos"] = null;
      mudancas.frequencia = null; // a lista de frequência sai das respostas dos alunos
    }
    if (escolha.inscricoesProfessores) mudancas["inscricoes/professores"] = null;
    if (escolha.inscricoesEscolas) mudancas["inscricoes/escolas"] = null;
    if (escolha.inscricoesAvaliacao) mudancas["inscricoes/avaliacao"] = null;
    if (escolha.projetos) mudancas.projetos = null;
    if (escolha.avaliacoes || escolha.professores || escolha.projetos) mudancas.avaliacoes = null;
    if (escolha.professores) {
      // Apaga também as contas de login de cada professor.
      const professores = await listarProfessores();
      await Promise.allSettled(
        professores.map(async (p) => {
          const conta = await contaDoProfessor(p.uid);
          if (conta) await chamarContas("delete", { idToken: conta.idToken });
        })
      );
      mudancas.professores = null;
      mudancas.professores_codigos = null;
    } else if (escolha.projetos) {
      // Sem projetos, as atribuições dos professores perdem o sentido.
      for (const p of await listarProfessores()) mudancas[`professores/${p.uid}/projetos`] = null;
    }
    if (Object.keys(mudancas).length) await atualizarSite(mudancas);
    if (escolha.votacao) await zerarVotacao();
  }

  // Igual ao "Zerar votação" do modo operador: cria uma rodada nova em /controle.
  // O site passa a ignorar os votos da rodada antiga na hora, e cada urna zera
  // a própria contagem assim que sincroniza com o Firebase.
  async function zerarVotacao() {
    let aberta = true;
    try {
      aberta = (await lerPublico("/controle"))?.votacao_aberta !== false;
    } catch {
      // sem leitura, a rodada nova começa aberta, como na urna
    }
    await escrever("PUT", "/controle", {
      rodada_id: `R_site_${Date.now().toString(36)}`,
      votacao_aberta: aberta,
      origem: "site",
      ultima_alteracao: { ".sv": "timestamp" },
    });
  }

  return {
    esc, carregarProjetos, lerCadastro, listasGravadas, buscarVotos,
    entrar, sair: contaPet.sair, esqueciSenha, sessaoAtual: contaPet.atual, salvarProjeto, removerProjeto,
    listarProfessores, codigosDosProfessores, cadastrarProfessor, atualizarProfessor, removerProfessor, lerAvaliacoes,
    entrarProfessor, sairProfessor: contaProfessor.sair, sessaoProfessor: contaProfessor.atual,
    meuPerfil, minhasAvaliacoes, salvarAvaliacao,
    lerFormulario, salvarFormulario, definirInscricoesAbertas, enviarInscricao, lerInscricoes, removerInscricao, editarInscricao,
    lerFrequencia, salvarFrequencia, lerPlanta, salvarPlanta, salvarPrioridade, salvarAjusteAutomatico,
    importarProjetos, organizarCodigos, copiaDeSeguranca, contarDados, limparDados, importarInscricoes, assinaturasImportadas,
    lerFeiras, salvarFeira, removerFeira, publicarFeirasIniciais,
  };
})();
