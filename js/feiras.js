const { esc } = API;
const $ = (id) => document.getElementById(id);
let edicoes = [];

let aberta = null; // { edicao, indice } da foto no visualizador

function htmlEdicao(f, i) {
  const [capa, ...resto] = f.fotos;
  return `
    <li class="edicao">
      <div class="edicao-marco">
        <span class="edicao-ano">${esc(f.edicao)}</span>
        <span class="edicao-quando">${esc(f.quando)}</span>
        <span class="edicao-onde">${esc(f.onde)}</span>
      </div>
      <article class="edicao-cartao">
        ${
          capa
            ? `<button class="edicao-capa" type="button" data-edicao="${i}" data-foto="0" aria-label="Ampliar foto: ${esc(capa.legenda)}">
                <img src="${esc(capa.url)}" alt="${esc(capa.legenda)}" loading="lazy">
              </button>`
            : ""
        }
        <div class="edicao-corpo">
          <p class="rotulo">${esc(f.titulo)} · ${esc(f.edicao)}</p>
          ${f.resumo ? `<p class="edicao-resumo">${esc(f.resumo)}</p>` : ""}
          ${f.numeros.length ? `<ul class="edicao-numeros">${f.numeros.map((n) => `<li>${esc(n)}</li>`).join("")}</ul>` : ""}
          ${
            f.vencedores.length
              ? `<div class="edicao-vencedores">
                  <h3 class="rotulo">Vencedores</h3>
                  <dl>${f.vencedores.map((v) => `<div><dt>${esc(v.categoria)}</dt><dd>${esc(v.nome)}</dd></div>`).join("")}</dl>
                </div>`
              : ""
          }
          ${
            resto.length
              ? `<div class="edicao-galeria">${resto
                  .map(
                    (foto, j) => `
                      <button type="button" data-edicao="${i}" data-foto="${j + 1}" aria-label="Ampliar foto: ${esc(foto.legenda)}">
                        <img src="${esc(foto.url)}" alt="" loading="lazy">
                      </button>`
                  )
                  .join("")}</div>`
              : ""
          }
          ${f.link ? `<a class="link" href="${esc(f.link)}" target="_blank" rel="noopener">Ler a matéria completa da edição ↗</a>` : ""}
        </div>
      </article>
    </li>`;
}

function mostrarFoto() {
  const f = edicoes[aberta.edicao];
  const { url, legenda } = f.fotos[aberta.indice];
  $("foto-img").src = url;
  $("foto-img").alt = legenda;
  $("foto-legenda").textContent = `${legenda ? `${legenda} · ` : ""}${f.titulo} ${f.edicao} (${aberta.indice + 1}/${f.fotos.length})`;
}

function andar(passo) {
  const total = edicoes[aberta.edicao].fotos.length;
  aberta.indice = (aberta.indice + passo + total) % total;
  mostrarFoto();
}

function render() {
  $("qtd-edicoes").textContent = edicoes.length;
  $("edicoes").innerHTML = edicoes.length
    ? edicoes.map(htmlEdicao).join("")
    : `<li class="lista-vazia">Nenhuma edição cadastrada ainda.</li>`;
}

$("edicoes").addEventListener("click", (e) => {
  const botao = e.target.closest("[data-foto]");
  if (!botao) return;
  aberta = { edicao: Number(botao.dataset.edicao), indice: Number(botao.dataset.foto) };
  mostrarFoto();
  $("foto").showModal();
});

$("foto-fechar").addEventListener("click", () => $("foto").close());
$("foto-anterior").addEventListener("click", () => andar(-1));
$("foto-proxima").addEventListener("click", () => andar(1));
$("foto").addEventListener("click", (e) => {
  if (e.target === $("foto")) $("foto").close();
});
$("foto").addEventListener("keydown", (e) => {
  if (e.key === "ArrowLeft") andar(-1);
  if (e.key === "ArrowRight") andar(1);
});

// As edições vêm do Firebase (cadastradas na Área dos Petianos). Sem conexão ou sem
// nada cadastrado ainda, vale a lista que acompanha o site em feiras-dados.js.
(async () => {
  edicoes = window.FEIRAS_PASSADAS.map(normalizarFeira);
  render();
  try {
    const doBanco = await API.lerFeiras();
    if (doBanco) {
      edicoes = doBanco.map(normalizarFeira);
      render();
    }
  } catch (erro) {
    console.warn("Feiras do Firebase indisponíveis, usando as do site:", erro.message);
  }
})();
