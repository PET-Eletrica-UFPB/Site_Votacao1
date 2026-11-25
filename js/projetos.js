const { cursos } = window.FEIRA;
const { esc } = API;

const $ = (id) => document.getElementById(id);
const cursoDe = (id) => cursos.find((c) => c.id === id);
let projetos = [];
let cursoAtual = "todos";
let termoBusca = "";

// Compara sem acentos e sem diferenciar maiúsculas
const normalizar = (t) => String(t ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();

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
    cursoAtual = botao.dataset.curso;
    renderProjetos();
  });
}

function combinaBusca(p) {
  if (!termoBusca) return true;
  const campos = [p.nome, p.numero, p.codigo, p.disciplina, p.equipe, p.stand && `stand ${p.stand}`, cursoDe(p.curso)?.curto];
  return normalizar(campos.filter(Boolean).join(" ")).includes(termoBusca);
}

$("busca").addEventListener("input", (e) => {
  termoBusca = normalizar(e.target.value);
  renderProjetos();
});

function renderProjetos() {
  const visiveis = projetos.filter((p) => (cursoAtual === "todos" || p.curso === cursoAtual) && combinaBusca(p));
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
    : `<p class="grade-vazia">${termoBusca ? "Nenhum projeto encontrado para essa busca." : "Nenhum projeto inscrito aqui ainda."}</p>`;
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

async function iniciar() {
  try {
    projetos = await API.carregarProjetos();
  } catch (erro) {
    console.error("Falha ao carregar projetos:", erro);
  }
  $("qtd-projetos").textContent = projetos.length;
  renderFiltros();
  renderProjetos();
}

iniciar();
