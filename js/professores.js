const { cursos, criterios, avaliacaoGeral: GERAL, notas: NOTAS } = window.FEIRA;
// Itens com botões de nota: a avaliação geral (obrigatória) e os critérios (métricas opcionais).
const itensDeNota = [GERAL, ...criterios];
const { esc } = API;

const $ = (id) => document.getElementById(id);
// 8 → "8,0"; 1,2 → "1,2"; 8,75 → "8,75"
const fmtNota = (n) => {
  const t = (Math.round(n * 100) / 100).toFixed(2).replace(/0$/, "");
  return t.replace(".", ",");
};
const SEM_DISCIPLINA = "Sem disciplina";
const disciplinaDe = (p) => (p.disciplina || "").trim() || SEM_DISCIPLINA;

let projetos = []; // só os atribuídos a este professor
let notasSalvas = {};
let atualId = null;
let filtro = "todas";
const rascunhos = {}; // edições ainda não salvas, por projeto

/* Entrada */
async function carregarNomes() {
  try {
    const lista = await API.listarProfessores();
    $("login-nome").innerHTML = lista.length
      ? `<option value="">Selecione seu nome</option>` + lista.map((p) => `<option value="${esc(p.uid)}">${esc(p.nome)}</option>`).join("")
      : `<option value="">Nenhum professor cadastrado ainda</option>`;
  } catch (erro) {
    console.error(erro);
    $("login-nome").innerHTML = `<option value="">Não consegui carregar a lista</option>`;
    $("login-erro").textContent =
      erro.status === 401
        ? "A lista de professores ainda não foi liberada no Firebase. Avise a organização."
        : "Sem conexão com o Firebase. Confira a internet e recarregue a página.";
  }
}

async function abrirPainel() {
  $("tela-login").hidden = true;
  $("tela-painel").hidden = false;
  $("painel-nome").textContent = API.sessaoProfessor().nome;
  $("ficha-nome").textContent = "Carregando seus projetos…";

  try {
    const [perfil, todos, salvas] = await Promise.all([API.meuPerfil(), API.lerCadastro(), API.minhasAvaliacoes()]);
    $("painel-nome").textContent = perfil.nome;
    notasSalvas = salvas;
    projetos = todos
      .filter((p) => perfil.projetos.includes(p.codigo))
      .sort((a, b) => disciplinaDe(a).localeCompare(disciplinaDe(b), "pt-BR"));
  } catch (erro) {
    console.error(erro);
    if (!API.sessaoProfessor()) return location.reload();
    mostrarVazio("Não consegui carregar seus projetos", erro.message);
    return;
  }

  if (!projetos.length) {
    mostrarVazio(
      "Nenhum projeto para você ainda",
      "A organização ainda não definiu quais projetos você vai avaliar. Fale com os petianos e entre de novo depois."
    );
    return;
  }
  renderFiltro();
  abrirProjeto(proximoPendente() || projetos[0].id);
}

function mostrarVazio(titulo, texto) {
  $("ficha-disciplina").hidden = true;
  $("ficha-meta").textContent = "";
  $("ficha-nome").textContent = titulo;
  $("ficha-resumo").textContent = texto;
  $("form-nota").hidden = true;
  renderFiltro();
  renderLista();
}

function sair() {
  const pendente = atualId && rascunhos[atualId] && !notasSalvas[atualId] && Object.keys(rascunhos[atualId].notas).length;
  if (pendente && !confirm("A nota deste projeto ainda não foi salva. Sair mesmo assim?")) return;
  API.sairProfessor();
  location.reload();
}

/* Cálculo */
// Nota do projeto: a avaliação geral. Sem ela, a média ponderada das métricas, se todas estiverem preenchidas.
function calcularMedia(notas) {
  if (notas[GERAL.id] != null) return notas[GERAL.id];
  if (criterios.some((c) => notas[c.id] == null)) return null;
  const pesos = criterios.reduce((soma, c) => soma + c.peso, 0);
  return criterios.reduce((soma, c) => soma + notas[c.id] * c.peso, 0) / pesos;
}

/* Disciplinas */
function disciplinas() {
  const mapa = new Map();
  for (const p of projetos) {
    const d = disciplinaDe(p);
    if (!mapa.has(d)) mapa.set(d, []);
    mapa.get(d).push(p);
  }
  return [...mapa.entries()].map(([nome, lista]) => ({ nome, lista, feitos: lista.filter((p) => notasSalvas[p.id]).length }));
}

function renderFiltro() {
  const grupos = disciplinas();
  if (grupos.length < 2) {
    $("filtro-disciplina").innerHTML = "";
    filtro = "todas";
    return;
  }
  const opcoes = [{ nome: "todas", rotulo: "Todas", lista: projetos, feitos: projetos.filter((p) => notasSalvas[p.id]).length }, ...grupos];
  $("filtro-disciplina").innerHTML = opcoes
    .map((g) => `
      <button class="filtro" type="button" data-disciplina="${esc(g.nome)}" aria-pressed="${g.nome === filtro}">
        ${esc(g.rotulo || g.nome)} <small>${g.feitos}/${g.lista.length}</small>
      </button>`)
    .join("");
}

/* Lista lateral, agrupada por disciplina */
function renderLista() {
  const feitos = projetos.filter((p) => notasSalvas[p.id]).length;
  $("progresso-num").textContent = `${feitos}/${projetos.length}`;
  $("progresso-txt").textContent = projetos.length && feitos === projetos.length ? "todos avaliados" : "projetos avaliados";
  $("progresso-barra").style.width = `${(feitos / (projetos.length || 1)) * 100}%`;

  const grupos = disciplinas().filter((g) => filtro === "todas" || g.nome === filtro);
  $("lista").innerHTML = grupos.length
    ? grupos
        .map((g) => `
          <li class="grupo-disciplina">
            <span>${esc(g.nome)}</span><small>${g.feitos}/${g.lista.length}</small>
          </li>
          ${g.lista.map(htmlItem).join("")}`)
        .join("")
    : `<li class="lista-vazia">Nenhum projeto atribuído a você.</li>`;
}

function htmlItem(p) {
  const salva = notasSalvas[p.id];
  return `
    <li>
      <button class="item-projeto" data-id="${esc(p.id)}" aria-current="${p.id === atualId}">
        <span class="item-stand">${esc(p.codigo)}</span>
        <span class="item-nome">${esc(p.nome)}</span>
        <span class="item-nota ${salva ? "" : "pendente"}">${salva ? fmtNota(salva.media) : "Pendente"}</span>
      </button>
    </li>`;
}

/* Ficha de avaliação */
function htmlCriterio(c, extra = "") {
  return `
      <div class="criterio ${extra}" data-crit="${c.id}">
        <div class="criterio-topo">
          <div>
            <span class="criterio-nome" id="rot-${c.id}">${esc(c.nome)}${c.peso ? `<small>peso ${c.peso}</small>` : ""}</span>
            <p>${esc(c.dica)}</p>
          </div>
          <b class="criterio-valor" aria-hidden="true">–</b>
        </div>
        <div class="notas-botoes" role="radiogroup" aria-labelledby="rot-${c.id}">
          ${NOTAS.map((n) => `<button type="button" role="radio" aria-checked="false" data-nota="${n}">${fmtNota(n).replace(",0", "")}</button>`).join("")}
        </div>
      </div>`;
}

// Avaliação geral: nota livre de 0 a 10 (com vírgula, ex.: 1,2), digitada ou na barra.
function htmlGeral() {
  return `
      <div class="criterio criterio-geral vazio" data-crit="${GERAL.id}">
        <div class="criterio-topo">
          <div>
            <label class="criterio-nome" id="rot-${GERAL.id}" for="geral-nota">${esc(GERAL.nome)}</label>
            <p>${esc(GERAL.dica)} De 0 a 10, com vírgula se quiser (ex.: 1; 1,2; 7,8).</p>
          </div>
          <span class="geral-campo">
            <input id="geral-nota" type="text" inputmode="decimal" autocomplete="off" placeholder="–" aria-describedby="geral-erro">
          </span>
        </div>
        <input class="geral-barra" id="geral-barra" type="range" min="0" max="10" step="0.1" value="0" aria-labelledby="rot-${GERAL.id}">
        <div class="geral-escala" aria-hidden="true"><span>0</span><span>2,5</span><span>5</span><span>7,5</span><span>10</span></div>
        <small class="geral-erro" id="geral-erro" role="alert"></small>
      </div>`;
}

// Texto digitado → nota (0 a 10, até 2 casas). null = vazio; NaN = inválido.
function lerNotaGeral(texto) {
  const t = texto.trim().replace(",", ".");
  if (!t) return null;
  if (!/^\d{1,2}(\.\d{0,2})?$/.test(t)) return NaN;
  const n = Number(t);
  return n >= 0 && n <= 10 ? Math.round(n * 100) / 100 : NaN;
}

// Avaliação geral primeiro; os critérios ficam recolhidos em "Métricas opcionais".
function renderCriterios() {
  $("criterios").innerHTML =
    htmlGeral() +
    `<details class="metricas-opcionais" id="metricas-opcionais">
      <summary>
        <span class="metricas-icone" aria-hidden="true">
          <svg viewBox="0 0 24 24"><path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0"/><circle cx="16" cy="6" r="2"/><circle cx="10" cy="12" r="2"/><circle cx="18" cy="18" r="2"/></svg>
        </span>
        <span class="metricas-texto">
          <b>Métricas opcionais</b>
          <small>Detalhe a nota por critério, se quiser</small>
        </span>
        <span class="metricas-conta" id="metricas-conta">0 de ${criterios.length}</span>
        <span class="metricas-seta" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M6 9l6 6 6-6"/></svg></span>
      </summary>
      <div class="metricas-corpo">
        <p class="metricas-dica">Não mudam a nota do projeto quando há avaliação geral. Clique de novo numa nota para tirá-la.</p>
        ${criterios.map((c) => htmlCriterio(c)).join("")}
      </div>
    </details>`;
}

function pintarCriterio(c, valor) {
  const bloco = document.querySelector(`[data-crit="${c.id}"]`);
  if (c === GERAL) {
    bloco.classList.toggle("vazio", valor == null);
    if (lerNotaGeral($("geral-nota").value) !== valor) $("geral-nota").value = valor == null ? "" : fmtNota(valor);
    $("geral-barra").value = valor ?? 0;
    $("geral-barra").classList.toggle("vazia", valor == null);
    $("geral-erro").textContent = "";
    return;
  }
  bloco.classList.toggle("vazio", valor == null);
  bloco.querySelector(".criterio-valor").textContent = valor == null ? "–" : fmtNota(valor);
  bloco.querySelectorAll("[data-nota]").forEach((b) => {
    const marcado = valor != null && Number(b.dataset.nota) === valor;
    b.setAttribute("aria-checked", marcado);
    b.tabIndex = marcado || (valor == null && b === b.parentElement.firstElementChild) ? 0 : -1;
  });
}

function atualizarMedia(notas) {
  const media = calcularMedia(notas);
  $("media").textContent = media == null ? "–" : fmtNota(media);
  $("media-txt").textContent =
    media == null ? "Escolha a avaliação geral" : notas[GERAL.id] != null ? "Nota do projeto (avaliação geral)" : "Média ponderada das métricas";
  $("salvar").disabled = media == null;
  const feitas = criterios.filter((c) => notas[c.id] != null).length;
  $("metricas-conta").textContent = `${feitas} de ${criterios.length}`;
  $("metricas-conta").classList.toggle("ok", feitas > 0);
}

function abrirProjeto(id) {
  atualId = id;
  const p = projetos.find((x) => x.id === id);
  const curso = cursos.find((c) => c.id === p.curso)?.nome;
  const base = rascunhos[id] || notasSalvas[id] || { notas: {}, comentario: "" };
  rascunhos[id] = { notas: { ...base.notas }, comentario: base.comentario || "" };

  $("form-nota").hidden = false;
  $("ficha-disciplina").hidden = false;
  $("ficha-disciplina").textContent = disciplinaDe(p);
  $("ficha-meta").textContent = [p.codigo, p.stand && `Stand ${p.stand}`, curso, p.equipe].filter(Boolean).join(" · ");
  $("ficha-nome").textContent = p.nome;
  $("ficha-resumo").textContent = p.resumo || "";
  $("comentario").value = rascunhos[id].comentario;

  itensDeNota.forEach((c) => pintarCriterio(c, rascunhos[id].notas[c.id] ?? null));
  // Métricas já preenchidas aparecem abertas; senão ficam recolhidas.
  $("metricas-opcionais").open = criterios.some((c) => rascunhos[id].notas[c.id] != null);
  atualizarMedia(rascunhos[id].notas);
  renderLista();
}

function definirNota(c, valor) {
  if (valor == null) delete rascunhos[atualId].notas[c.id];
  else rascunhos[atualId].notas[c.id] = valor;
  pintarCriterio(c, valor);
  atualizarMedia(rascunhos[atualId].notas);
}

function proximoPendente(depoisDe) {
  const ordem = disciplinas().flatMap((g) => g.lista);
  const i = ordem.findIndex((p) => p.id === depoisDe);
  const naOrdem = (lista) => lista.find((p) => !notasSalvas[p.id]);
  const mesmoFiltro = (p) => filtro === "todas" || disciplinaDe(p) === filtro;
  return (
    naOrdem(ordem.slice(i + 1).filter(mesmoFiltro)) ||
    naOrdem(ordem.filter(mesmoFiltro)) ||
    naOrdem(ordem)
  )?.id;
}

function aviso(texto, erro = false) {
  $("feedback").textContent = texto;
  $("feedback").classList.toggle("erro", erro);
}

/* Eventos */
$("form-login").addEventListener("submit", async (e) => {
  e.preventDefault();
  $("login-erro").textContent = "";
  if (!$("login-nome").value) {
    $("login-erro").textContent = "Escolha o seu nome na lista.";
    return;
  }
  $("login-entrar").disabled = true;
  try {
    await API.entrarProfessor($("login-nome").value, $("login-codigo").value.trim());
    $("login-codigo").value = "";
    abrirPainel();
  } catch (erro) {
    $("login-erro").textContent = erro.message;
  } finally {
    $("login-entrar").disabled = false;
  }
});

$("sair").addEventListener("click", sair);

$("filtro-disciplina").addEventListener("click", (e) => {
  const botao = e.target.closest("[data-disciplina]");
  if (!botao) return;
  filtro = botao.dataset.disciplina;
  renderFiltro();
  const atual = projetos.find((p) => p.id === atualId);
  if (filtro !== "todas" && atual && disciplinaDe(atual) !== filtro) {
    const grupo = disciplinas().find((g) => g.nome === filtro);
    abrirProjeto((grupo.lista.find((p) => !notasSalvas[p.id]) || grupo.lista[0]).id);
    aviso("");
  } else {
    renderLista();
  }
});

$("lista").addEventListener("click", (e) => {
  const item = e.target.closest(".item-projeto");
  if (!item) return;
  abrirProjeto(item.dataset.id);
  aviso("");
  if (matchMedia("(max-width: 1040px)").matches) $("ficha").scrollIntoView();
});

$("criterios").addEventListener("click", (e) => {
  const botao = e.target.closest("[data-nota]");
  if (!botao) return;
  const c = itensDeNota.find((x) => x.id === botao.closest("[data-crit]").dataset.crit);
  const valor = Number(botao.dataset.nota);
  // Métrica opcional: clicar de novo na nota marcada tira a nota.
  const tirar = e.detail > 0 && rascunhos[atualId].notas[c.id] === valor;
  definirNota(c, tirar ? null : valor);
});

// Setas do teclado andam entre as notas, como em um grupo de opções.
$("criterios").addEventListener("keydown", (e) => {
  const botao = e.target.closest("[data-nota]");
  if (!botao || !["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(e.key)) return;
  e.preventDefault();
  const irmaos = [...botao.parentElement.children];
  const passo = e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 1;
  const alvo = irmaos[(irmaos.indexOf(botao) + passo + irmaos.length) % irmaos.length];
  alvo.focus();
  alvo.click();
});

// Nota geral digitada: aceita vírgula; fora de 0 a 10 avisa e não conta.
$("criterios").addEventListener("input", (e) => {
  if (e.target.id === "geral-nota") {
    const n = lerNotaGeral(e.target.value);
    if (Number.isNaN(n)) {
      definirNota(GERAL, null);
      $("geral-erro").textContent = "Digite uma nota de 0 a 10 (ex.: 7,5).";
      return;
    }
    definirNota(GERAL, n);
  } else if (e.target.id === "geral-barra") {
    definirNota(GERAL, Math.round(Number(e.target.value) * 10) / 10);
    $("geral-nota").value = fmtNota(rascunhos[atualId].notas[GERAL.id]);
  }
});
$("criterios").addEventListener("change", (e) => {
  // Ao sair do campo, a nota fica escrita do jeito padrão (7.5 → 7,5).
  if (e.target.id === "geral-nota" && rascunhos[atualId]?.notas[GERAL.id] != null) e.target.value = fmtNota(rascunhos[atualId].notas[GERAL.id]);
});

$("comentario").addEventListener("input", (e) => {
  rascunhos[atualId].comentario = e.target.value;
});

$("form-nota").addEventListener("submit", async (e) => {
  e.preventDefault();
  const { notas, comentario } = rascunhos[atualId];
  const media = calcularMedia(notas);
  if (media == null) return;

  const id = atualId;
  const nome = projetos.find((p) => p.id === id).nome;
  const avaliacao = { notas: { ...notas }, comentario: comentario.trim(), media, salvoEm: new Date().toISOString() };

  $("salvar").disabled = true;
  aviso("Salvando…");
  try {
    await API.salvarAvaliacao(id, avaliacao);
  } catch (erro) {
    aviso(`A nota de “${nome}” não foi salva: ${erro.message}`, true);
    $("salvar").disabled = false;
    if (!API.sessaoProfessor()) setTimeout(() => location.reload(), 2500);
    return;
  }

  notasSalvas[id] = avaliacao;
  delete rascunhos[id];
  const proximo = proximoPendente(id);
  renderFiltro();
  if (proximo) abrirProjeto(proximo);
  else abrirProjeto(id);

  aviso(`Nota de “${nome}” salva: ${fmtNota(media)}${proximo ? "" : ". Todos os seus projetos foram avaliados!"}`);
  if (proximo) window.scrollTo({ top: 0, behavior: "smooth" });
});

renderCriterios();

if (API.sessaoProfessor()) abrirPainel();
else carregarNomes();
