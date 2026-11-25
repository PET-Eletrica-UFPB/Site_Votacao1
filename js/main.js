const { urnas } = window.FEIRA;
const { esc } = API;
const INTERVALO_VOTOS = 10000;

const $ = (id) => document.getElementById(id);
const fmt = (n) => n.toLocaleString("pt-BR");
const TOP_VISIVEL = 5;
let projetos = [];

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

/* Mostra só o top 5; o resto aparece ao clicar em "ver mais" */
function prepararVerMais() {
  const caixa = $("ranking-caixa");
  const botao = $("ver-mais");
  const temMais = projetos.length > TOP_VISIVEL;
  botao.hidden = !temMais;
  caixa.classList.toggle("recolhido", temMais);
  botao.addEventListener("click", () => {
    const recolher = !caixa.classList.contains("recolhido");
    caixa.classList.toggle("recolhido", recolher);
    botao.setAttribute("aria-expanded", String(!recolher));
    $("ver-mais-texto").textContent = recolher ? "Ver mais" : "Ver menos";
    if (recolher) caixa.scrollIntoView({ block: "nearest", behavior: "smooth" });
  });
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
  criarLinhasRanking();
  prepararVerMais();
  await atualizarVotos();
  setInterval(atualizarVotos, INTERVALO_VOTOS);
}

iniciar();
