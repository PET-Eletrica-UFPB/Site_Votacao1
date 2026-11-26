// Canto inferior direito da Área dos Petianos: "Atualizado: hh:mm:ss (dd/mm/aaaa)", a hora em que esta
// versão do site foi publicada (cabeçalho Last-Modified da página que o navegador carregou).
// De tempos em tempos confere se o GitHub Pages já publicou uma versão mais nova e avisa para recarregar.
(() => {
  const INTERVALO = 5 * 60 * 1000;
  const doisDigitos = (n) => String(n).padStart(2, "0");
  const formatar = (d) =>
    `${doisDigitos(d.getHours())}:${doisDigitos(d.getMinutes())}:${doisDigitos(d.getSeconds())} ` +
    `(${doisDigitos(d.getDate())}/${doisDigitos(d.getMonth() + 1)}/${d.getFullYear()})`;

  // document.lastModified vem no formato "MM/DD/AAAA hh:mm:ss", na hora local.
  function dataCarregada() {
    const m = document.lastModified.match(/^(\d+)\/(\d+)\/(\d+) (\d+):(\d+):(\d+)$/);
    return m ? new Date(m[3], m[1] - 1, m[2], m[4], m[5], m[6]) : new Date(document.lastModified);
  }

  const carregada = dataCarregada();
  const selo = document.createElement("button");
  selo.type = "button";
  selo.className = "versao-site";
  selo.title = "Hora em que esta versão do site foi publicada";
  selo.textContent = `Atualizado: ${formatar(carregada)}`;
  document.body.append(selo);

  let nova = null;
  selo.addEventListener("click", () => {
    if (nova) location.reload();
  });

  // Pergunta ao servidor a data da página publicada agora (sem usar o cache).
  async function conferir() {
    try {
      const resposta = await fetch(location.pathname, { method: "HEAD", cache: "no-store" });
      const publicada = new Date(resposta.headers.get("Last-Modified"));
      if (Number.isNaN(publicada.getTime()) || publicada.getTime() - carregada.getTime() < 1000) return;
      nova = publicada;
      selo.classList.add("nova");
      selo.title = "Clique para recarregar a página com a versão nova";
      selo.textContent = `Atualizado: ${formatar(carregada)} · versão nova de ${formatar(publicada)}: clique para recarregar`;
    } catch {
      // sem internet: fica a data da versão carregada
    }
  }
  conferir();
  setInterval(conferir, INTERVALO);
  document.addEventListener("visibilitychange", () => document.visibilityState === "visible" && conferir());
})();
