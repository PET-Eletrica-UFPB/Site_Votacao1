const { cursos } = window.FEIRA;
const { esc } = API;
const INTERVALO_PODIO = 15000;
const TEMPO_OCIOSO = 3000;
const NOME_LONGO = 36;
const PALAVRA_LONGA = 11;
const CHAVE_GIRO = "feira-pet:podio-giro";
const GIROS = ["0", "90", "270"];

const $ = (id) => document.getElementById(id);
let anteriores = {}; // ocupante anterior de cada lugar, para animar só o que mudou

/* Pódio: os votos servem só para ordenar e nunca entram na página. */
function tresPrimeiros(projetos, votos, cursoId) {
  return projetos
    .filter((p) => p.curso === cursoId && votos[p.id] > 0)
    .sort((a, b) => votos[b.id] - votos[a.id] || a.nome.localeCompare(b.nome, "pt-BR"))
    .slice(0, 3);
}

function htmlLugar(p, posicao, cursoId) {
  const chave = `${cursoId}-${posicao}`;
  const mudou = anteriores[chave] !== p?.id;
  anteriores[chave] = p?.id;
  const longo = p && (p.nome.length > NOME_LONGO || p.nome.split(" ").some((palavra) => palavra.length > PALAVRA_LONGA));
  const classes = `lugar${p ? "" : " vago"}${mudou ? " mudou" : ""}${longo ? " longo" : ""}`;

  return `
    <li class="${classes}" data-lugar="${posicao}">
      ${p ? `<div class="lugar-arte">${svgArte(p.arte)}</div>` : ""}
      <div class="lugar-nome">${p ? esc(p.nome) : "Aguardando votos"}</div>
      <div class="degrau">
        <b>${posicao}º</b>
        ${p ? `<span>Nº ${p.numero}${p.stand ? ` · Stand ${esc(p.stand)}` : ""}</span>` : ""}
      </div>
    </li>`;
}

function renderPodios(projetos, votos) {
  const podios = cursos.map((c) => ({ curso: c, primeiros: tresPrimeiros(projetos, votos, c.id) }));
  const assinatura = JSON.stringify(podios.map((x) => x.primeiros.map((p) => [p.id, p.nome, p.stand])));
  if (assinatura === renderPodios.assinatura) return;
  renderPodios.assinatura = assinatura;

  $("podios").innerHTML = podios
    .map(({ curso, primeiros }) => {
      const [prefixo, nome] = curso.nome.startsWith("Engenharia de ")
        ? ["Engenharia de", curso.nome.slice("Engenharia de ".length)]
        : ["Engenharia", curso.nome.replace(/^Engenharia /, "")];
      return `
        <section class="podio" aria-label="${esc(curso.nome)}">
          <h2><small>${prefixo}</small>${esc(nome)}</h2>
          <ol class="degraus" style="padding:0;list-style:none">
            ${[1, 2, 3].map((n) => htmlLugar(primeiros[n - 1], n, curso.id)).join("")}
          </ol>
        </section>`;
    })
    .join("");
}

async function atualizar() {
  try {
    const [projetos, { votos, aberta }] = await Promise.all([API.carregarProjetos(), API.buscarVotos()]);
    renderPodios(projetos, votos);
    const hora = new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
    $("status").textContent = aberta ? `Atualizado às ${hora}` : "Votação encerrada";
    $("chamada").hidden = !aberta;
    $("status").classList.remove("erro");
  } catch (erro) {
    console.error("Falha ao buscar votos:", erro);
    $("status").textContent = "Sem conexão: mostrando o último resultado";
    $("status").classList.add("erro");
  }
}

/* Giro: muitas TVs não giram a imagem pelo sistema, então a página faz isso. */
function lerGiro() {
  try {
    return localStorage.getItem(CHAVE_GIRO) || "0";
  } catch {
    return "0";
  }
}

function aplicarGiro(giro) {
  document.body.dataset.giro = giro;
  try {
    localStorage.setItem(CHAVE_GIRO, giro);
  } catch {
    // sem armazenamento, o giro dura até recarregar a página
  }
}

$("girar").addEventListener("click", () => {
  const atual = document.body.dataset.giro || "0";
  aplicarGiro(GIROS[(GIROS.indexOf(atual) + 1) % GIROS.length]);
});

/* Tela cheia */
if (document.fullscreenEnabled) {
  $("tela-cheia").addEventListener("click", () => {
    if (document.fullscreenElement) document.exitFullscreen();
    else document.documentElement.requestFullscreen();
  });
} else {
  $("tela-cheia").hidden = true;
}

/* Esconde controles e cursor quando ninguém está mexendo */
let temporizador;
function acordar() {
  document.body.classList.remove("ocioso");
  clearTimeout(temporizador);
  temporizador = setTimeout(() => document.body.classList.add("ocioso"), TEMPO_OCIOSO);
}
["pointermove", "pointerdown", "keydown"].forEach((evento) => addEventListener(evento, acordar));

/* Impede a TV de apagar a tela, quando o navegador permite */
async function manterTelaLigada() {
  try {
    await navigator.wakeLock?.request("screen");
  } catch {
    // sem suporte ou sem HTTPS: vale a configuração de energia da própria TV
  }
}
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") manterTelaLigada();
});

aplicarGiro(lerGiro());
acordar();
manterTelaLigada();
atualizar();
setInterval(atualizar, INTERVALO_PODIO);
