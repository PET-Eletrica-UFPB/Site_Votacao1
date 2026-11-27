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
  AjusteAutomatico.ligado();
  recarregar().then(sincronizarInscricoes);
  PainelProfessores.iniciar();
  PainelFormularios.iniciar();
}

async function recarregar() {
  try {
    projetos = await API.lerCadastro();
    $("aviso-cadastro").hidden = true;
  } catch (erro) {
    console.error(erro);
    $("aviso-cadastro").textContent =
      "Não consegui ler o cadastro. Confira a internet e se as regras de REGRAS_FIREBASE.md já foram publicadas no Firebase.";
    $("aviso-cadastro").hidden = false;
  }
  renderLista();
  renderUrnas();
  PainelProfessores.projetosMudaram();
}

/* Tabela de projetos: agrupada por curso e disciplina, com busca e filtros. Clicar abre a ficha. */
const normalizarBusca = (t) => String(t ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const disciplinaDe = (p) => (p.disciplina || "").trim() || "Sem disciplina";

function opcoesDosFiltros() {
  const curso = $("filtro-curso").value;
  $("filtro-curso").innerHTML =
    `<option value="">Todos (${projetos.length})</option>` +
    cursos.map((c) => `<option value="${c.id}">${esc(c.curto)} (${projetos.filter((p) => p.curso === c.id).length})</option>`).join("");
  $("filtro-curso").value = curso;
  const disc = $("filtro-disciplina").value;
  const contagem = new Map();
  for (const p of projetos.filter((x) => !curso || x.curso === curso)) contagem.set(disciplinaDe(p), (contagem.get(disciplinaDe(p)) || 0) + 1);
  const nomes = [...contagem.keys()].sort((a, b) => a.localeCompare(b, "pt-BR"));
  $("filtro-disciplina").innerHTML =
    `<option value="">Todas (${nomes.length})</option>` + nomes.map((d) => `<option value="${esc(d)}">${esc(d)} (${contagem.get(d)})</option>`).join("");
  $("filtro-disciplina").value = nomes.includes(disc) ? disc : "";
}

function renderLista() {
  const n = projetos.length;
  $("total-projetos").textContent = n;
  $("total-txt").textContent = n === 1 ? "projeto inscrito" : "projetos inscritos";
  const nDisc = new Set(projetos.map(disciplinaDe)).size;
  $("lista-resumo").textContent = n
    ? `${cursos.map((c) => `${projetos.filter((p) => p.curso === c.id).length} de ${c.curto}`).join(" · ")} · ${nDisc} disciplina${nDisc === 1 ? "" : "s"}. Clique num projeto para editar.`
    : "Nenhum projeto cadastrado ainda.";
  opcoesDosFiltros();

  const termos = normalizarBusca($("busca").value).split(/\s+/).filter(Boolean);
  const curso = $("filtro-curso").value;
  const disc = $("filtro-disciplina").value;
  const visiveis = projetos.filter((p) => {
    if (curso && p.curso !== curso) return false;
    if (disc && disciplinaDe(p) !== disc) return false;
    const texto = normalizarBusca([p.nome, p.codigo, p.disciplina, p.equipe, p.stand].join(" "));
    return termos.every((t) => texto.includes(t));
  });

  if (!visiveis.length) {
    $("lista").innerHTML = `<p class="lista-vazia">${n ? "Nenhum projeto encontrado com esses filtros." : "Nenhum projeto cadastrado ainda. Use “+ Novo projeto”, “Importar das inscrições” ou “Sincronizar com planilha”."}</p>`;
    return;
  }
  // Curso → disciplina (na ordem do primeiro código de cada uma) → projetos pelo número.
  const blocos = [];
  for (const c of cursos) {
    const doCurso = visiveis.filter((p) => p.curso === c.id).sort((a, b) => a.numero - b.numero);
    if (!doCurso.length) continue;
    const grupos = new Map();
    for (const p of doCurso) {
      if (!grupos.has(disciplinaDe(p))) grupos.set(disciplinaDe(p), []);
      grupos.get(disciplinaDe(p)).push(p);
    }
    blocos.push(`
      <section class="tabela-curso">
        <h2>${esc(c.nome)} <small>${doCurso.length} projeto${doCurso.length === 1 ? "" : "s"}</small></h2>
        ${[...grupos.entries()]
          .map(([nome, lista]) => {
            const faixa = lista.length > 1 ? `${lista[0].codigo} a ${lista.at(-1).codigo}` : lista[0].codigo;
            return `
          <div class="tabela-grupo">
            <h3>${esc(nome)} <small>${lista.length} · ${esc(faixa)}</small></h3>
            <table>
              <thead><tr><th class="col-codigo">Código</th><th>Projeto</th><th class="col-equipe">Integrantes</th></tr></thead>
              <tbody>
                ${lista
                  .map((p) => {
                    const fixo = API.codigoFixo(p);
                    return `
                <tr data-codigo="${esc(p.codigo)}" tabindex="0" aria-current="${p.codigo === editandoCodigo}">
                  <td class="col-codigo"><span class="item-stand ${fixo ? "fixo" : ""}" ${fixo ? 'title="Prioridade: código fixo"' : ""}>${esc(p.codigo)}</span></td>
                  <td><b>${esc(p.nome)}</b>${p.resumo ? `<small>${esc(p.resumo)}</small>` : ""}</td>
                  <td class="col-equipe">${p.equipe ? esc(p.equipe) : '<span class="vazio">—</span>'}</td>
                </tr>`;
                  })
                  .join("")}
              </tbody>
            </table>
          </div>`;
          })
          .join("")}
      </section>`);
  }
  $("lista").innerHTML = blocos.join("");
}

/* Ficha do projeto em janela */
function abrirFicha() {
  $("ficha-feedback").textContent = "";
  if (!$("ficha-dialogo").open) $("ficha-dialogo").showModal();
}
function fecharFicha() {
  if (!podeDescartar()) return;
  alterado = false;
  $("ficha-dialogo").close();
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
// Stand: na ficha só o número; a letra do curso aparece ao lado e entra sozinha ao salvar.
const letraDoCurso = () => cursos.find((c) => c.id === $("curso").value)?.letra || "";
function mostrarLetraStand() {
  const letra = letraDoCurso();
  $("stand-letra").textContent = letra;
  $("stand-letra").hidden = !letra;
}
const standParaFicha = (stand) => String(stand ?? "").match(/^[^\d]{0,3}(\d{1,3})[^\d]{0,3}$/)?.[1] ?? String(stand ?? "");
let prioridadeMexida = false; // marcada/desmarcada à mão nesta edição
const standParaSalvar = (texto) => (/^\d+$/.test(texto) ? `${Number(texto)}${letraDoCurso()}` : texto);

function preencher(projeto) {
  CAMPOS.forEach((c) => {
    $(c).value = projeto?.[c] ?? "";
  });
  $("stand").value = standParaFicha(projeto?.stand);
  mostrarLetraStand();
  $("prioridade").checked = projeto ? API.codigoFixo(projeto) : false;
  prioridadeMexida = false;
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

// Respostas do formulário corrigidas antes de a correção ir sozinha para o projeto: acerta os projetos ao entrar.
async function sincronizarInscricoes() {
  try {
    const feitos = await InscricaoProjeto.sincronizarCorrigidas();
    if (feitos.length) {
      aviso(`Projetos atualizados com as correções feitas no formulário: ${InscricaoProjeto.resumo(feitos)} Grave as urnas de novo.`);
    }
  } catch (erro) {
    console.error(erro); // sem acesso às inscrições: fica para a próxima vez
  }
}

// Mensagem da aba (acima da tabela) e, com a ficha aberta, também dentro dela.
function aviso(texto, erro = false) {
  for (const id of ["feedback", "ficha-feedback"]) {
    $(id).textContent = texto;
    $(id).classList.toggle("erro", erro);
  }
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
  if (!podeDescartar() || !PainelProfessores.podeDescartar() || !PainelFormularios.podeDescartar() || !PainelFeiras.podeDescartar()) return;
  API.sair();
  location.reload();
});

// Só números no stand; a letra acompanha o curso escolhido.
$("stand").addEventListener("input", (e) => {
  const so = e.target.value.replace(/\D/g, "");
  if (so !== e.target.value) e.target.value = so;
  // Stand definido vira bloco fixo, a não ser que a prioridade já tenha sido mexida à mão.
  if (so && !prioridadeMexida) $("prioridade").checked = true;
});
$("prioridade").addEventListener("change", () => (prioridadeMexida = true));
$("curso").addEventListener("change", mostrarLetraStand);

$("form-projeto").addEventListener("input", () => {
  alterado = true;
  aviso("");
  atualizarContador();
});

$("busca").addEventListener("input", renderLista);
$("filtro-curso").addEventListener("change", renderLista);
$("filtro-disciplina").addEventListener("change", renderLista);

$("novo").addEventListener("click", () => {
  if ($("ficha-dialogo").open && !podeDescartar()) return;
  novoProjeto();
  aviso("");
  abrirFicha();
  $("nome").focus();
});

function abrirProjeto(codigo) {
  const projeto = projetos.find((p) => p.codigo === codigo);
  if (!projeto) return;
  editandoCodigo = codigo;
  preencher(projeto);
  aviso("");
  abrirFicha();
}
$("lista").addEventListener("click", (e) => {
  const linha = e.target.closest("tr[data-codigo]");
  if (linha) abrirProjeto(linha.dataset.codigo);
});
$("lista").addEventListener("keydown", (e) => {
  const linha = e.target.closest("tr[data-codigo]");
  if (linha && (e.key === "Enter" || e.key === " ")) {
    e.preventDefault();
    abrirProjeto(linha.dataset.codigo);
  }
});
$("ficha-fechar").addEventListener("click", fecharFicha);
// Esc ou clique fora: pergunta antes de descartar alterações.
$("ficha-dialogo").addEventListener("cancel", (e) => {
  e.preventDefault();
  fecharFicha();
});
$("ficha-dialogo").addEventListener("click", (e) => {
  if (e.target === $("ficha-dialogo")) fecharFicha();
});

$("form-projeto").addEventListener("submit", async (e) => {
  e.preventDefault();
  // Campo só com espaços não conta como preenchido.
  ["nome", "disciplina", "resumo"].forEach((c) => {
    $(c).value = $(c).value.trim();
  });
  if (!e.target.reportValidity()) return;

  const dados = Object.fromEntries(CAMPOS.map((c) => [c, $(c).value.trim()]));
  dados.stand = standParaSalvar(dados.stand);
  dados.prioridade = $("prioridade").checked;
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
    aviso(
      `“${salvo.nome}” ${eraNovo ? "cadastrado" : "atualizado"} como ${salvo.codigo}.` +
        (salvo.trocado ? ` “${salvo.trocado.nome}” tinha esse número e passou de ${salvo.trocado.de} para ${salvo.trocado.para}.` : "") +
        " Grave as urnas de novo e refaça as placas se o código mudou."
    );
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
    $("ficha-dialogo").close();
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
  $("baixar-erro").textContent = "";
  $("baixar").showModal();
});

$("baixar-cancelar").addEventListener("click", () => $("baixar").close());

$("form-baixar").addEventListener("submit", async (e) => {
  e.preventDefault();
  // A senha só fica dentro do arquivo: digitada duas vezes para não sair errada sem ninguém perceber.
  if ($("baixar-operador").value !== $("baixar-operador2").value) {
    $("baixar-erro").textContent = "As duas senhas do modo operador não são iguais. Digite de novo.";
    $("baixar-operador2").focus();
    return;
  }
  $("baixar-erro").textContent = "";
  const senhas = { senhaOperador: $("baixar-operador").value, senhaFirebase: $("baixar-firebase").value };
  const semSenha = !senhas.senhaOperador;
  $("form-baixar").reset();
  $("baixar").close();
  try {
    // Relê para o arquivo sair com a lista mais recente, mesmo com outro petiano editando.
    projetos = await API.lerCadastro();
    renderLista();
    const problema = GeradorUrna.problemaNaLista(projetos);
    if (problema) return aviso(problema, true);
    GeradorUrna.baixar(urnaEscolhida.arquivo, GeradorUrna.gerarIno(urnaEscolhida, projetos, senhas));
    aviso(`${urnaEscolhida.arquivo} baixado com ${projetos.length} projetos${semSenha ? ", sem senha no modo operador" : ""}.`);
  } catch (erro) {
    aviso("Não consegui ler o cadastro para gerar o arquivo. Tente de novo.", true);
  }
});

/* Abas que não cabem: rolam para o lado. Com o mouse, dá para arrastar; a aba escolhida
   aparece inteira e a borda esmaece do lado onde há mais abas. */
function abasQueRolam(barra) {
  const marcar = () => {
    barra.classList.toggle("mais-esq", barra.scrollLeft > 2);
    barra.classList.toggle("mais-dir", barra.scrollLeft + barra.clientWidth < barra.scrollWidth - 2);
  };
  let inicio = null;
  let arrastou = false;
  barra.addEventListener("pointerdown", (e) => {
    if (e.pointerType !== "mouse" || barra.scrollWidth <= barra.clientWidth) return;
    inicio = { x: e.clientX, rolagem: barra.scrollLeft };
    arrastou = false;
  });
  addEventListener("pointermove", (e) => {
    if (!inicio) return;
    const dx = e.clientX - inicio.x;
    if (!arrastou && Math.abs(dx) < 5) return;
    arrastou = true;
    barra.classList.add("arrastando");
    barra.scrollLeft = inicio.rolagem - dx;
  });
  addEventListener("pointerup", () => {
    inicio = null;
    barra.classList.remove("arrastando");
  });
  // Um arraste não conta como clique na aba.
  barra.addEventListener("click", (e) => {
    if (arrastou) {
      e.stopPropagation();
      e.preventDefault();
      arrastou = false;
      return;
    }
    e.target.closest(".aba")?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, true);
  // Roda do mouse na vertical também rola as abas.
  barra.addEventListener("wheel", (e) => {
    if (barra.scrollWidth <= barra.clientWidth || Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
    barra.scrollLeft += e.deltaY;
    e.preventDefault();
  }, { passive: false });
  barra.addEventListener("scroll", marcar, { passive: true });
  new ResizeObserver(marcar).observe(barra);
  marcar();
}
document.querySelectorAll(".abas").forEach(abasQueRolam);

// Espera petianos-professores.js carregar antes de abrir o painel.
addEventListener("DOMContentLoaded", () => {
  if (API.sessaoAtual()) abrirPainel();
});
