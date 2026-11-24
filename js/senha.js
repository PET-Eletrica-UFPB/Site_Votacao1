// Botão de mostrar/ocultar em todo campo de senha da página.
(() => {
  const OLHO = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>`;
  const OLHO_FECHADO = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 3l18 18M10.6 5.1A10.8 10.8 0 0 1 12 5c6.4 0 10 7 10 7a17.6 17.6 0 0 1-3.2 4.1M6.6 6.6C3.8 8.3 2 12 2 12s3.6 7 10 7c1.9 0 3.6-.6 5-1.5M9.9 9.9a3 3 0 0 0 4.2 4.2"/></svg>`;

  function ligar(campo) {
    if (campo.dataset.olho) return;
    campo.dataset.olho = "1";
    const caixa = document.createElement("span");
    caixa.className = "senha-caixa";
    campo.replaceWith(caixa);
    caixa.append(campo);

    const botao = document.createElement("button");
    botao.type = "button";
    botao.className = "senha-ver";
    caixa.append(botao);

    const mostrar = (visivel) => {
      campo.type = visivel ? "text" : "password";
      botao.innerHTML = visivel ? OLHO_FECHADO : OLHO;
      botao.setAttribute("aria-label", visivel ? "Ocultar senha" : "Mostrar senha");
      botao.setAttribute("aria-pressed", visivel);
      botao.title = visivel ? "Ocultar" : "Mostrar";
    };
    botao.addEventListener("click", () => {
      mostrar(campo.type === "password");
      campo.focus();
    });
    // Ao enviar ou limpar o formulário, a senha volta a ficar escondida.
    campo.form?.addEventListener("submit", () => mostrar(false));
    campo.form?.addEventListener("reset", () => mostrar(false));
    mostrar(false);
  }

  window.ligarMostrarSenha = (raiz = document) => raiz.querySelectorAll('input[type="password"]').forEach(ligar);
  window.ligarMostrarSenha();
})();
