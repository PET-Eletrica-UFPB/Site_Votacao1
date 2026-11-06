const { cursos, disciplinas, urnas } = window.FEIRA;
const { esc } = API;
const CAMPOS = ["nome", "curso", "disciplina", "equipe", "stand", "resumo"];

const $ = (id) => document.getElementById(id);

let projetos = [];
let editandoCodigo = null;
let alterado = false;
let urnaEscolhida = null;

/* Entrada */
function abrirPainel() {
  $("tela-login").hidden = true;
  $("tela-painel").hidden = false;
  $("painel-nome").textContent = API.sessaoAtual().email;
  novoProjeto();
  recarregar();
}

async function recarregar() {
  try {
    projetos = await API.lerCadastro();
    $("aviso-cadastro").hidden = true;
  } catch (erro) {
    console.error(erro);
    $("aviso-cadastro").textContent =
      "Não consegui ler o cadastro. Confira a internet e se as regras de firebase_rules.json já foram publicadas no Firebase.";
    $("aviso-cadastro").hidden = false;
  }
  renderLista();
  renderUrnas();
}

/* Lista lateral */
function renderLista() {
  const n = projetos.length;
  $("total-projetos").textContent = n;
  $("total-txt").textContent = n === 1 ? "projeto inscrito" : "projetos inscritos";

  const busca = $("busca").value.trim().toLowerCase();
  const visiveis = projetos.filter((p) =>
    [p.nome, p.disciplina, p.equipe, p.codigo].some((t) => (t || "").toLowerCase().includes(busca))
  );

  $("lista").innerHTML = visiveis.length
    ? visiveis
        .map((p) => `
          <li>
            <button class="item-projeto" data-codigo="${esc(p.codigo)}" aria-current="${p.codigo === editandoCodigo}">
              <span class="item-stand">${esc(p.codigo)}</span>
              <span>
                <span class="item-nome">${esc(p.nome)}</span>
                <span class="item-sub">${esc(p.disciplina)}</span>
              </span>
            </button>
          </li>`)
        .join("")
    : `<li class="lista-vazia">${n ? "Nenhum projeto encontrado." : "Nenhum projeto inscrito ainda."}</li>`;
}

/* Urnas: compara o que cada urna publicou no Firebase com o cadastro atual. */
function situacaoDaUrna(gravada) {
  if (!gravada) return { texto: "Sem resposta do Firebase", classe: "" };
  const { nomeParaUrna } = GeradorUrna;
  const codigos = Object.keys(gravada);
  const igual =
    codigos.length === projetos.length &&
    projetos.every((p) => gravada[p.codigo] && nomeParaUrna(gravada[p.codigo].nome) === nomeParaUrna(p.nome));
  return igual
    ? { texto: "Gravada com a lista atual", classe: "ok" }
    : { texto: "Lista diferente do cadastro: baixe e grave de novo", classe: "alerta" };
}

async function renderUrnas() {
  const listas = await API.listasGravadas();
  const problema = GeradorUrna.problemaNaLista(projetos);
  $("urnas-ino").innerHTML = urnas
    .map((u) => {
      const { texto, classe } = situacaoDaUrna(listas[u.id]);
      return `
        <button class="btn btn-vidro" type="button" data-urna="${u.id}" ${problema ? "disabled" : ""}>Baixar .ino da ${u.nome}</button>
        <span class="urna-situacao ${classe}">${esc(texto)}</span>`;
    })
    .join("") + (problema ? `<span class="urna-situacao alerta">${esc(problema)}</span>` : "");
}

/* Formulário */
function preencher(projeto) {
  CAMPOS.forEach((c) => {
    $(c).value = projeto?.[c] ?? "";
  });
  $("ficha-titulo").textContent = projeto ? projeto.nome : "Novo projeto";
  $("salvar").textContent = projeto ? "Salvar alterações" : "Cadastrar projeto";
  $("excluir").hidden = !projeto;
  $("numero-urna").hidden = !projeto;
  if (projeto) {
    const curso = cursos.find((c) => c.id === projeto.curso);
    $("numero-urna").textContent = `Na urna: tecla ${curso.tecla} (${curso.curto}), número ${projeto.numero}`;
  }
  atualizarContador();
  alterado = false;
  renderLista();
}

function novoProjeto() {
  editandoCodigo = null;
  preencher(null);
}

function atualizarContador() {
  $("contador").textContent = `${$("resumo").value.length}/${$("resumo").maxLength}`;
}

function podeDescartar() {
  return !alterado || confirm("Você tem alterações não salvas neste projeto. Descartar?");
}

function aviso(texto, erro = false) {
  $("feedback").textContent = texto;
  $("feedback").classList.toggle("erro", erro);
}

/* Eventos */
$("curso").innerHTML =
  `<option value="">Selecione o curso</option>` +
  cursos.map((c) => `<option value="${c.id}">${c.nome}</option>`).join("");
$("lista-disciplinas").innerHTML = disciplinas.map((d) => `<option value="${esc(d)}"></option>`).join("");

$("form-login").addEventListener("submit", async (e) => {
  e.preventDefault();
  $("login-erro").classList.remove("sucesso");
  $("login-erro").textContent = "";
  $("login-entrar").disabled = true;
  try {
    await API.entrar($("login-email").value.trim(), $("login-senha").value);
    $("login-senha").value = "";
    abrirPainel();
  } catch (erro) {
    $("login-erro").textContent = erro.message;
  } finally {
    $("login-entrar").disabled = false;
  }
});

$("login-email").value = window.FEIRA.emailPet;

$("esqueci").addEventListener("click", async () => {
  $("login-erro").classList.remove("sucesso");
  $("login-erro").textContent = "";
  $("esqueci").disabled = true;
  try {
    const email = await API.esqueciSenha();
    $("login-erro").classList.add("sucesso");
    $("login-erro").textContent = `Enviamos um link para ${email}. Abra o e-mail para criar a nova senha e confira também o spam.`;
  } catch (erro) {
    $("login-erro").textContent = erro.message;
  } finally {
    $("esqueci").disabled = false;
  }
});

$("sair").addEventListener("click", () => {
  if (!podeDescartar()) return;
  API.sair();
  location.reload();
});

$("form-projeto").addEventListener("input", () => {
  alterado = true;
  aviso("");
  atualizarContador();
});

$("busca").addEventListener("input", renderLista);

$("novo").addEventListener("click", () => {
  if (!podeDescartar()) return;
  novoProjeto();
  aviso("");
  $("nome").focus();
});

$("lista").addEventListener("click", (e) => {
  const item = e.target.closest(".item-projeto");
  if (!item || !podeDescartar()) return;
  editandoCodigo = item.dataset.codigo;
  preencher(projetos.find((p) => p.codigo === editandoCodigo));
  aviso("");
  if (matchMedia("(max-width: 1040px)").matches) $("ficha").scrollIntoView();
});

$("form-projeto").addEventListener("submit", async (e) => {
  e.preventDefault();
  // Campo só com espaços não conta como preenchido.
  ["nome", "disciplina", "resumo"].forEach((c) => {
    $(c).value = $(c).value.trim();
  });
  if (!e.target.reportValidity()) return;

  const dados = Object.fromEntries(CAMPOS.map((c) => [c, $(c).value.trim()]));
  const eraNovo = !editandoCodigo;
  $("salvar").disabled = true;
  try {
    const salvo = await API.salvarProjeto(dados, editandoCodigo);
    alterado = false;
    await recarregar();
    if (eraNovo) {
      novoProjeto();
      $("nome").focus();
    } else {
      editandoCodigo = salvo.codigo;
      preencher(salvo);
    }
    aviso(`“${salvo.nome}” ${eraNovo ? "cadastrado" : "atualizado"} como ${salvo.codigo}. Grave as urnas de novo se a lista mudou.`);
  } catch (erro) {
    aviso(erro.message, true);
  } finally {
    $("salvar").disabled = false;
  }
});

$("excluir").addEventListener("click", () => {
  $("confirmar-nome").textContent = projetos.find((p) => p.codigo === editandoCodigo).nome;
  $("confirmar").showModal();
});

$("confirmar-nao").addEventListener("click", () => $("confirmar").close());

$("confirmar-sim").addEventListener("click", async () => {
  const nome = $("confirmar-nome").textContent;
  $("confirmar").close();
  try {
    await API.removerProjeto(editandoCodigo);
    alterado = false;
    novoProjeto();
    await recarregar();
    aviso(`“${nome}” foi excluído.`);
  } catch (erro) {
    aviso(erro.message, true);
  }
});

/* Download do .ino */
$("urnas-ino").addEventListener("click", (e) => {
  const botao = e.target.closest("[data-urna]");
  if (!botao) return;
  urnaEscolhida = urnas.find((u) => u.id === botao.dataset.urna);
  $("baixar-titulo").textContent = `Baixar código da ${urnaEscolhida.nome}`;
  $("form-baixar").reset();
  $("baixar").showModal();
});

$("baixar-cancelar").addEventListener("click", () => $("baixar").close());

$("form-baixar").addEventListener("submit", async (e) => {
  e.preventDefault();
  const senhas = { senhaOperador: $("baixar-operador").value, senhaFirebase: $("baixar-firebase").value };
  $("form-baixar").reset();
  $("baixar").close();
  try {
    // Relê para o arquivo sair com a lista mais recente, mesmo com outro petiano editando.
    projetos = await API.lerCadastro();
    renderLista();
    const problema = GeradorUrna.problemaNaLista(projetos);
    if (problema) return aviso(problema, true);
    GeradorUrna.baixar(urnaEscolhida.arquivo, GeradorUrna.gerarIno(urnaEscolhida, projetos, senhas));
    aviso(`${urnaEscolhida.arquivo} baixado com ${projetos.length} projetos.`);
  } catch (erro) {
    aviso("Não consegui ler o cadastro para gerar o arquivo. Tente de novo.", true);
  }
});

if (API.sessaoAtual()) abrirPainel();
