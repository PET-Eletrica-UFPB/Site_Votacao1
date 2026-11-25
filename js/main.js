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
const DURACAO_VER_MAIS = 700;
const suave = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
const semAnimacao = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

// Anima a altura da caixa (e, se pedido, a rolagem da página) no mesmo ritmo
function animarCaixa(caixa, de, para, rolagem, aoFim) {
  const inicio = performance.now();
  caixa.style.height = `${de}px`;
  caixa.style.overflow = "hidden";
  const passo = (agora) => {
    const t = Math.min(1, (agora - inicio) / DURACAO_VER_MAIS);
    const k = suave(t);
    caixa.style.height = `${de + (para - de) * k}px`;
    if (rolagem) window.scrollTo(0, rolagem.de + (rolagem.para - rolagem.de) * k);
    if (t < 1) return requestAnimationFrame(passo);
    caixa.style.height = "";
    caixa.style.overflow = "";
    aoFim();
  };
  requestAnimationFrame(passo);
}

function prepararVerMais() {
  const caixa = $("ranking-caixa");
  const botao = $("ver-mais");
  const temMais = projetos.length > TOP_VISIVEL;
  let animando = false;
  botao.hidden = !temMais;
  caixa.classList.toggle("recolhido", temMais);

  botao.addEventListener("click", () => {
    if (animando) return;
    const recolher = !caixa.classList.contains("recolhido");
    const alturaAntes = caixa.offsetHeight;
    caixa.classList.toggle("recolhido", recolher);
    const alturaDepois = caixa.offsetHeight;
    botao.setAttribute("aria-expanded", String(!recolher));
    $("ver-mais-texto").textContent = recolher ? "Ver mais" : "Ver menos";

    // Ao recolher, a página volta até o 5º colocado com o "ver mais" logo abaixo
    let rolagem = null;
    if (recolher) {
      const fimCaixa = caixa.getBoundingClientRect().top + window.scrollY + alturaDepois;
      const alvo = Math.max(0, fimCaixa + 32 - window.innerHeight);
      if (window.scrollY > alvo) rolagem = { de: window.scrollY, para: alvo };
    }

    if (semAnimacao()) {
      if (rolagem) window.scrollTo(0, rolagem.para);
      return;
    }
    animando = true;
    caixa.classList.add("animando");
    animarCaixa(caixa, alturaAntes, alturaDepois, rolagem, () => {
      caixa.classList.remove("animando");
      animando = false;
    });
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
