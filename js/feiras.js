const { esc } = API;
const $ = (id) => document.getElementById(id);
const edicoes = window.FEIRAS_PASSADAS;

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
        <button class="edicao-capa" type="button" data-edicao="${i}" data-foto="0" aria-label="Ampliar foto: ${esc(capa[1])}">
          <img src="${esc(capa[0])}" alt="${esc(capa[1])}" loading="lazy">
        </button>
        <div class="edicao-corpo">
          <p class="rotulo">${esc(f.titulo)} · ${esc(f.edicao)}</p>
          <p class="edicao-resumo">${esc(f.resumo)}</p>
          <ul class="edicao-numeros">${f.numeros.map((n) => `<li>${esc(n)}</li>`).join("")}</ul>
          <div class="edicao-vencedores">
            <h3 class="rotulo">Vencedores</h3>
            <dl>${f.vencedores.map(([cat, nome]) => `<div><dt>${esc(cat)}</dt><dd>${esc(nome)}</dd></div>`).join("")}</dl>
          </div>
          ${
            resto.length
              ? `<div class="edicao-galeria">${resto
                  .map(
                    ([src, legenda], j) => `
                      <button type="button" data-edicao="${i}" data-foto="${j + 1}" aria-label="Ampliar foto: ${esc(legenda)}">
                        <img src="${esc(src)}" alt="" loading="lazy">
                      </button>`
                  )
                  .join("")}</div>`
              : ""
          }
          <a class="link" href="${esc(f.link)}" target="_blank" rel="noopener">Ler a página completa da edição ↗</a>
        </div>
      </article>
    </li>`;
}

function mostrarFoto() {
  const f = edicoes[aberta.edicao];
  const [src, legenda] = f.fotos[aberta.indice];
  $("foto-img").src = src;
  $("foto-img").alt = legenda;
  $("foto-legenda").textContent = `${legenda} · ${f.titulo} ${f.edicao} (${aberta.indice + 1}/${f.fotos.length})`;
}

function andar(passo) {
  const total = edicoes[aberta.edicao].fotos.length;
  aberta.indice = (aberta.indice + passo + total) % total;
  mostrarFoto();
}

$("qtd-edicoes").textContent = edicoes.length;
$("edicoes").innerHTML = edicoes.map(htmlEdicao).join("");

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
