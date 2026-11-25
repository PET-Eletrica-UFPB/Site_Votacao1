const { urnas } = window.FEIRA;
const INTERVALO_VOTOS = 10000;

const $ = (id) => document.getElementById(id);
const fmt = (n) => n.toLocaleString("pt-BR");
let projetos = [];

function mostrarEstadoVotacao(aberta) {
  $("etiqueta").classList.toggle("encerrada", !aberta);
  $("etiqueta-texto").textContent = aberta ? "Votação aberta" : "Votação encerrada";
}

/* Números do topo; o placar completo fica em placar.html */
async function atualizarVotos() {
  if (document.hidden) return;
  try {
    const dados = await API.buscarVotos();
    const contados = projetos.reduce((soma, p) => soma + (dados.votos[p.id] || 0), 0);
    const sincronizadas = urnas.filter((u) => dados.urnas[u.id].online).length;
    mostrarEstadoVotacao(dados.aberta);
    $("stat-votos").textContent = fmt(contados);
    $("stat-urnas").textContent = `${sincronizadas}/${urnas.length}`;
  } catch (erro) {
    console.error("Falha ao buscar votos:", erro);
  }
}

async function iniciar() {
  try {
    projetos = await API.carregarProjetos();
  } catch (erro) {
    console.error("Falha ao carregar projetos:", erro);
  }
  $("stat-projetos").textContent = projetos.length;
  await atualizarVotos();
  setInterval(atualizarVotos, INTERVALO_VOTOS);
}

iniciar();
