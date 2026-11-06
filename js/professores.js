const { cursos, criterios, professores } = window.FEIRA;
const { esc } = API;
let projetos = [];
const CHAVE_SESSAO = "feira-pet:professor";

const $ = (id) => document.getElementById(id);
const fmtNota = (n) => n.toFixed(1).replace(".", ",");

let professor = null;
let atualId;
let notasSalvas = {};
const rascunhos = {}; // edições ainda não salvas, por projeto

/* Sessão (a validação de verdade do código entra junto com o backend) */
function lerSessao() {
  try {
    return sessionStorage.getItem(CHAVE_SESSAO);
  } catch {
    return null;
  }
}

function gravarSessao(nome) {
  try {
    if (nome) sessionStorage.setItem(CHAVE_SESSAO, nome);
    else sessionStorage.removeItem(CHAVE_SESSAO);
  } catch {
    // sem armazenamento, a sessão dura até recarregar a página
  }
}

async function entrar(nome) {
  try {
    projetos = await API.carregarProjetos();
  } catch (erro) {
    console.error("Falha ao carregar projetos:", erro);
  }
  professor = nome;
  notasSalvas = API.notasDoProfessor(nome);
  gravarSessao(nome);
  $("tela-login").hidden = true;
  $("tela-painel").hidden = false;
  $("painel-nome").textContent = nome;
  if (!projetos.length) {
    $("ficha-nome").textContent = "Nenhum projeto inscrito ainda";
    $("ficha-resumo").textContent = "Os projetos aparecem aqui assim que os petianos fizerem o cadastro.";
    $("form-nota").hidden = true;
    renderLista();
    return;
  }
  abrirProjeto(projetos.find((p) => !notasSalvas[p.id])?.id || projetos[0].id);
}

function sair() {
  gravarSessao(null);
  location.reload();
}

/* Cálculo */
function calcularMedia(notas) {
  if (criterios.some((c) => notas[c.id] == null)) return null;
  const pesos = criterios.reduce((soma, c) => soma + c.peso, 0);
  return criterios.reduce((soma, c) => soma + notas[c.id] * c.peso, 0) / pesos;
}

/* Lista lateral */
function renderLista() {
  const feitos = projetos.filter((p) => notasSalvas[p.id]).length;
  $("progresso-num").textContent = `${feitos}/${projetos.length}`;
  $("progresso-txt").textContent = feitos === projetos.length ? "todos avaliados" : "projetos avaliados";
  $("progresso-barra").style.width = `${(feitos / (projetos.length || 1)) * 100}%`;

  $("lista").innerHTML = projetos
    .map((p) => {
      const salva = notasSalvas[p.id];
      return `
        <li>
          <button class="item-projeto" data-id="${esc(p.id)}" aria-current="${p.id === atualId}">
            <span class="item-stand">${esc(p.codigo)}</span>
            <span class="item-nome">${esc(p.nome)}</span>
            <span class="item-nota ${salva ? "" : "pendente"}">${salva ? fmtNota(salva.media) : "Pendente"}</span>
          </button>
        </li>`;
    })
    .join("");
}

/* Ficha de avaliação */
function renderCriterios() {
  $("criterios").innerHTML = criterios
    .map((c) => `
      <div class="criterio" data-crit="${c.id}">
        <div class="criterio-topo">
          <div>
            <label for="n-${c.id}">${c.nome}<small>peso ${c.peso}</small></label>
            <p>${c.dica}</p>
          </div>
          <input id="n-${c.id}" type="number" min="0" max="10" step="0.5" inputmode="decimal" placeholder="–">
        </div>
        <input type="range" min="0" max="10" step="0.5" value="0" aria-label="${c.nome}, nota de 0 a 10">
      </div>`)
    .join("");
}

function pintarCriterio(c, valor) {
  const bloco = document.querySelector(`[data-crit="${c.id}"]`);
  const faixa = bloco.querySelector("[type=range]");
  const vazio = valor == null;
  bloco.classList.toggle("vazio", vazio);
  faixa.value = vazio ? 0 : valor;
  faixa.style.setProperty("--pct", `${vazio ? 0 : valor * 10}%`);
}

function atualizarMedia(notas) {
  const media = calcularMedia(notas);
  $("media").textContent = media == null ? "–" : fmtNota(media);
  $("media-txt").textContent = media == null ? "Preencha todos os critérios" : "Média ponderada";
  $("salvar").disabled = media == null;
}

function abrirProjeto(id) {
  atualId = id;
  const p = projetos.find((x) => x.id === id);
  const curso = cursos.find((c) => c.id === p.curso)?.nome;
  const base = rascunhos[id] || notasSalvas[id] || { notas: {}, comentario: "" };
  rascunhos[id] = { notas: { ...base.notas }, comentario: base.comentario };

  $("ficha-meta").textContent = [p.codigo, p.stand && `Stand ${p.stand}`, curso, p.disciplina, p.equipe].filter(Boolean).join(" · ");
  $("ficha-nome").textContent = p.nome;
  $("ficha-resumo").textContent = p.resumo || "";
  $("comentario").value = rascunhos[id].comentario;
  $("feedback").textContent = "";
  $("feedback").classList.remove("erro");

  criterios.forEach((c) => {
    const valor = rascunhos[id].notas[c.id];
    $(`n-${c.id}`).value = valor ?? "";
    pintarCriterio(c, valor);
  });
  atualizarMedia(rascunhos[id].notas);
  renderLista();
}

function definirNota(c, valor) {
  rascunhos[atualId].notas[c.id] = valor;
  pintarCriterio(c, valor);
  atualizarMedia(rascunhos[atualId].notas);
}

function ligarCriterios() {
  criterios.forEach((c) => {
    const bloco = document.querySelector(`[data-crit="${c.id}"]`);
    const numero = bloco.querySelector("[type=number]");
    const faixa = bloco.querySelector("[type=range]");

    faixa.addEventListener("input", () => {
      numero.value = faixa.value;
      definirNota(c, Number(faixa.value));
    });
    // clicar no zero não dispara "input" porque o valor não muda
    faixa.addEventListener("pointerup", () => {
      if (bloco.classList.contains("vazio")) {
        numero.value = faixa.value;
        definirNota(c, Number(faixa.value));
      }
    });
    numero.addEventListener("input", () => {
      const valor = numero.value === "" ? null : Number(numero.value);
      definirNota(c, valor == null || (valor >= 0 && valor <= 10) ? valor : null);
    });
    numero.addEventListener("blur", () => {
      if (numero.value === "") return;
      const valor = Math.min(10, Math.max(0, Math.round(Number(numero.value) * 2) / 2));
      numero.value = valor;
      definirNota(c, valor);
    });
  });
}

/* Eventos */
$("login-nome").innerHTML = professores.map((nome) => `<option>${nome}</option>`).join("");

$("form-login").addEventListener("submit", (e) => {
  e.preventDefault();
  entrar($("login-nome").value);
});

$("sair").addEventListener("click", sair);

$("lista").addEventListener("click", (e) => {
  const item = e.target.closest(".item-projeto");
  if (item) abrirProjeto(item.dataset.id);
});

$("comentario").addEventListener("input", (e) => {
  rascunhos[atualId].comentario = e.target.value;
});

$("form-nota").addEventListener("submit", (e) => {
  e.preventDefault();
  const { notas, comentario } = rascunhos[atualId];
  const media = calcularMedia(notas);
  if (media == null) return;

  const avaliacao = { notas: { ...notas }, comentario, media, salvoEm: new Date().toISOString() };
  const salvoNoNavegador = API.salvarNota(professor, atualId, avaliacao);
  notasSalvas[atualId] = avaliacao;
  const nome = projetos.find((p) => p.id === atualId).nome;

  const proximo =
    projetos.find((p, i) => i > projetos.findIndex((x) => x.id === atualId) && !notasSalvas[p.id]) ||
    projetos.find((p) => !notasSalvas[p.id]);

  if (proximo) abrirProjeto(proximo.id);
  else renderLista();

  $("feedback").classList.toggle("erro", !salvoNoNavegador);
  $("feedback").textContent = salvoNoNavegador
    ? `Nota de “${nome}” salva: ${fmtNota(media)}${proximo ? "" : ". Todos os projetos foram avaliados!"}`
    : `Não foi possível gravar a nota de “${nome}” neste navegador. Ela vale só até fechar a página.`;
  if (proximo) window.scrollTo({ top: 0, behavior: "smooth" });
});

renderCriterios();
ligarCriterios();

const sessao = lerSessao();
if (sessao && professores.includes(sessao)) entrar(sessao);
