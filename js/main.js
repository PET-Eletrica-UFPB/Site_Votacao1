const { cursos, urnas } = window.FEIRA;
const { esc } = API;
const INTERVALO_VOTOS = 10000;

const $ = (id) => document.getElementById(id);
const fmt = (n) => n.toLocaleString("pt-BR");
const cursoDe = (id) => cursos.find((c) => c.id === id);
let projetos = [];

/* Projetos */
function renderFiltros() {
  const opcoes = [{ id: "todos", curto: "Todos" }, ...cursos];
  $("filtros").innerHTML = opcoes
    .map((c, i) => `<button class="filtro" data-curso="${c.id}" aria-pressed="${i === 0}">${c.curto}</button>`)
    .join("");
  $("filtros").addEventListener("click", (e) => {
    const botao = e.target.closest(".filtro");
    if (!botao) return;
    $("filtros").querySelectorAll(".filtro").forEach((b) => b.setAttribute("aria-pressed", b === botao));
    renderProjetos(botao.dataset.curso);
  });
}

function renderProjetos(curso = "todos") {
  const visiveis = projetos.filter((p) => curso === "todos" || p.curso === curso);
  $("grade").innerHTML = visiveis.length
    ? visiveis
        .map((p) => `
          <button class="cartao" data-id="${esc(p.id)}" data-cor="${esc(p.cor)}" aria-haspopup="dialog">
            <div class="cartao-arte">${svgArte(p.arte)}</div>
            <div class="cartao-topo">
              <span class="chip">${esc(cursoDe(p.curso).curto)} · Nº ${p.numero}</span>
              <span class="mais" aria-hidden="true">+</span>
            </div>
            <div class="cartao-info">
              <h3>${esc(p.nome)}</h3>
              <small>${[p.disciplina, p.stand && `Stand ${p.stand}`].filter(Boolean).map(esc).join(" · ")}</small>
            </div>
          </button>`)
        .join("")
    : `<p class="grade-vazia">Nenhum projeto inscrito aqui ainda.</p>`;
}

function abrirProjeto(id) {
  const p = projetos.find((x) => x.id === id);
  const curso = cursoDe(p.curso);
  $("modal-capa").dataset.cor = p.cor;
  $("modal-arte").innerHTML = svgArte(p.arte);
  $("modal-cat").textContent = curso.nome;
  $("modal-nome").textContent = p.nome;
  $("modal-resumo").textContent = p.resumo || "";
  $("modal-voto").textContent = `Para votar na urna: tecla ${curso.tecla} (${curso.curto}), depois o número ${p.numero}.`;
  $("modal-meta").innerHTML = [p.disciplina, p.stand && `Stand ${p.stand}`, p.equipe]
    .filter(Boolean)
    .map((t) => `<span>${esc(t)}</span>`)
    .join("");
  $("modal").showModal();
}

$("grade").addEventListener("click", (e) => {
  const cartao = e.target.closest(".cartao");
  if (cartao) abrirProjeto(cartao.dataset.id);
});
$("modal-fechar").addEventListener("click", () => $("modal").close());
$("modal").addEventListener("click", (e) => {
  if (e.target === $("modal")) $("modal").close();
});

/* Placar */
function criarLinhasRanking() {
  $("ranking").innerHTML = projetos
    .map((p) => `
      <li class="linha" data-id="${esc(p.id)}">
        <span class="linha-pos"></span>
        <span class="linha-nome">${esc(p.nome)}</span>
        <span class="linha-valor"><span class="num">0</span><small class="pct"></small></span>
        <div class="barra"><i style="width:0"></i></div>
      </li>`)
    .join("");
}

function atualizarRanking(votosRecebidos, total) {
  const votos = Object.fromEntries(projetos.map((p) => [p.id, votosRecebidos[p.id] || 0]));
  const ordem = [...projetos].sort((a, b) => votos[b.id] - votos[a.id]);
  const maior = Math.max(1, ...Object.values(votos));

  ordem.forEach((p, i) => {
    const linha = $("ranking").querySelector(`[data-id="${p.id}"]`);
    const num = linha.querySelector(".num");
    const anterior = Number(num.dataset.valor || 0);

    linha.querySelector(".linha-pos").textContent = String(i + 1).padStart(2, "0");
    num.textContent = fmt(votos[p.id]);
    num.dataset.valor = votos[p.id];
    linha.querySelector(".pct").textContent = `${(total ? (votos[p.id] / total) * 100 : 0).toFixed(1).replace(".", ",")}%`;
    linha.querySelector(".barra i").style.width = `${(votos[p.id] / maior) * 100}%`;

    linha.classList.remove("subiu");
    if (anterior && votos[p.id] > anterior) {
      void linha.offsetWidth; // reinicia a animação
      linha.classList.add("subiu");
    }
    $("ranking").appendChild(linha);
  });
}

function atualizarUrnas(dados) {
  $("urnas").innerHTML =
    `<h3 class="rotulo">Urnas</h3>` +
    urnas
      .map((u) => {
        const { votos, online } = dados[u.id];
        return `
          <div class="urna">
            <div><strong>${u.nome}</strong></div>
            <div class="urna-num">
              ${fmt(votos)}
              <div class="status ${online ? "" : "off"}">${online ? "Sincronizada" : "Sem dados"}</div>
            </div>
          </div>`;
      })
      .join("");
}

function mostrarEstadoVotacao(aberta) {
  $("etiqueta").classList.toggle("encerrada", !aberta);
  $("etiqueta-texto").textContent = aberta ? "Votação aberta" : "Votação encerrada";
}

async function atualizarVotos() {
  if (document.hidden) return;
  try {
    const dados = await API.buscarVotos();
    const contados = projetos.reduce((soma, p) => soma + (dados.votos[p.id] || 0), 0);
    const sincronizadas = urnas.filter((u) => dados.urnas[u.id].online).length;

    atualizarRanking(dados.votos, contados);
    atualizarUrnas(dados.urnas);
    mostrarEstadoVotacao(dados.aberta);
    $("total-votos").textContent = fmt(contados);
    $("stat-votos").textContent = fmt(contados);
    $("stat-urnas").textContent = `${sincronizadas}/${urnas.length}`;
    $("aviso-placar").hidden = true;
  } catch (erro) {
    console.error("Falha ao buscar votos:", erro);
    $("aviso-placar").hidden = false;
  }
}

async function iniciar() {
  try {
    projetos = await API.carregarProjetos();
  } catch (erro) {
    console.error("Falha ao carregar projetos:", erro);
  }
  $("stat-projetos").textContent = projetos.length;
  renderFiltros();
  renderProjetos();
  criarLinhasRanking();
  await atualizarVotos();
  setInterval(atualizarVotos, INTERVALO_VOTOS);
}

iniciar();
