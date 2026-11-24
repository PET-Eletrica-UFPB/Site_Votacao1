const { esc } = API;
const $ = (id) => document.getElementById(id);
const ROTULOS = { alunos: "Inscrição de alunos", professores: "Inscrição de professores" };
const LIMITE = { curta: 200, longa: 2000, email: 120, telefone: 30, numero: 20, data: 10 };

const formularios = {};
let tipoAtual = null;

/* Montagem do formulário */
function htmlPergunta(q, i) {
  const id = `q-${i}`;
  const obrig = q.obrigatoria ? `<span class="obrig" aria-hidden="true">*</span>` : "";
  const ajuda = q.ajuda ? `<small class="ajuda" id="${id}-ajuda">${esc(q.ajuda)}</small>` : "";
  const desc = q.ajuda ? ` aria-describedby="${id}-ajuda"` : "";
  const req = q.obrigatoria ? " required" : "";
  const opcoes = (q.opcoes || []).filter(Boolean);

  if (q.tipo === "unica" || q.tipo === "varias") {
    const tipo = q.tipo === "unica" ? "radio" : "checkbox";
    return `
      <fieldset class="pergunta-publica" data-i="${i}">
        <legend>${esc(q.texto)}${obrig}</legend>
        ${ajuda}
        <div class="opcoes">
          ${opcoes
            .map((o) => `
              <label class="opcao">
                <input type="${tipo}" name="${id}" value="${esc(o)}"${tipo === "radio" ? req : ""}${desc}>
                <span>${esc(o)}</span>
              </label>`)
            .join("")}
        </div>
      </fieldset>`;
  }

  let campo;
  if (q.tipo === "longa") {
    campo = `<textarea id="${id}" rows="4" maxlength="${LIMITE.longa}"${req}${desc}></textarea>`;
  } else if (q.tipo === "lista") {
    campo = `<select id="${id}"${req}${desc}><option value="">Selecione</option>${opcoes.map((o) => `<option>${esc(o)}</option>`).join("")}</select>`;
  } else {
    const tipos = { curta: "text", email: "email", telefone: "tel", numero: "number", data: "date" };
    const extra = q.tipo === "email" ? ' autocomplete="email"' : q.tipo === "telefone" ? ' autocomplete="tel" inputmode="tel"' : "";
    campo = `<input id="${id}" type="${tipos[q.tipo] || "text"}" maxlength="${LIMITE[q.tipo] || 200}"${extra}${req}${desc}>`;
  }
  return `
    <div class="campo pergunta-publica" data-i="${i}">
      <label for="${id}">${esc(q.texto)}${obrig}</label>
      ${ajuda}
      ${campo}
    </div>`;
}

function mostrar(tipo) {
  tipoAtual = tipo;
  const f = formularios[tipo];
  document.querySelectorAll(".escolha").forEach((b) => b.setAttribute("aria-selected", b.dataset.tipo === tipo));
  $("painel-form").setAttribute("aria-labelledby", `tab-${tipo}`);
  $("painel-form").hidden = false;
  $("form-enviado").hidden = true;
  $("form-erro").textContent = "";
  $("form-rotulo").textContent = ROTULOS[tipo];
  $("form-titulo").textContent = f.titulo || ROTULOS[tipo];
  $("form-descricao").textContent = f.descricao || "";

  const aberto = f.aberto && f.perguntas.length;
  $("form-fechado").hidden = aberto;
  $("form-inscricao").hidden = !aberto;
  $("form-fechado").textContent = f.erro
    ? f.erro === 401
      ? "As inscrições ainda não estão disponíveis. Volte mais tarde."
      : "Não consegui carregar este formulário. Confira a internet e recarregue a página."
    : `As inscrições de ${tipo} não estão abertas no momento. Volte mais tarde ou fale com o PET Elétrica.`;
  if (aberto) $("perguntas").innerHTML = f.perguntas.map(htmlPergunta).join("");
  history.replaceState(null, "", `#${tipo}`);
}

/* Leitura e validação */
function valorDe(q, i) {
  if (q.tipo === "varias") return [...document.querySelectorAll(`[name="q-${i}"]:checked`)].map((c) => c.value);
  if (q.tipo === "unica") return document.querySelector(`[name="q-${i}"]:checked`)?.value || "";
  const v = $(`q-${i}`).value.trim();
  if (q.tipo === "data" && v) return v.split("-").reverse().join("/"); // 2026-03-13 → 13/03/2026
  return v;
}

function validar(f) {
  let primeiroErro = null;
  document.querySelectorAll(".pergunta-publica").forEach((bloco) => bloco.classList.remove("invalida"));
  f.perguntas.forEach((q, i) => {
    const v = valorDe(q, i);
    const vazio = Array.isArray(v) ? !v.length : !v;
    const campo = $(`q-${i}`);
    const formatoRuim = campo && !vazio && !campo.checkValidity();
    if ((q.obrigatoria && vazio) || formatoRuim) {
      const bloco = document.querySelector(`.pergunta-publica[data-i="${i}"]`);
      bloco.classList.add("invalida");
      primeiroErro ??= { bloco, msg: formatoRuim ? `Confira o formato de “${q.texto}”.` : `Responda “${q.texto}”.` };
    }
  });
  return primeiroErro;
}

/* Eventos */
document.querySelector(".escolha-publico").addEventListener("click", (e) => {
  const botao = e.target.closest(".escolha");
  if (botao && formularios[botao.dataset.tipo]) mostrar(botao.dataset.tipo);
});

$("form-inscricao").addEventListener("input", (e) => {
  e.target.closest(".pergunta-publica")?.classList.remove("invalida");
  $("form-erro").textContent = "";
});

$("form-inscricao").addEventListener("submit", async (e) => {
  e.preventDefault();
  const f = formularios[tipoAtual];
  const erro = validar(f);
  if (erro) {
    $("form-erro").textContent = erro.msg;
    erro.bloco.scrollIntoView({ behavior: "smooth", block: "center" });
    erro.bloco.querySelector("input, textarea, select")?.focus({ preventScroll: true });
    return;
  }

  // Cada resposta leva o texto da pergunta, para não se perder se a pergunta mudar depois.
  const respostas = {};
  f.perguntas.forEach((q, i) => {
    const v = valorDe(q, i);
    if (Array.isArray(v) ? v.length : v) respostas[q.id] = { p: q.texto, v };
  });

  $("enviar").disabled = true;
  $("enviar").textContent = "Enviando…";
  try {
    await API.enviarInscricao(tipoAtual, respostas);
    $("form-inscricao").reset();
    $("form-inscricao").hidden = true;
    $("form-enviado").hidden = false;
    $("form-enviado").scrollIntoView({ behavior: "smooth", block: "center" });
  } catch (erroEnvio) {
    $("form-erro").textContent = erroEnvio.message;
  } finally {
    $("enviar").disabled = false;
    $("enviar").textContent = "Enviar inscrição";
  }
});

$("outra").addEventListener("click", () => mostrar(tipoAtual));

/* Início */
(async () => {
  const tipos = ["alunos", "professores"];
  const lidos = await Promise.allSettled(tipos.map((t) => API.lerFormulario(t)));
  tipos.forEach((t, i) => {
    formularios[t] = lidos[i].status === "fulfilled" ? lidos[i].value : { perguntas: [], aberto: false, erro: lidos[i].reason?.status || true };
    const aberto = formularios[t].aberto && formularios[t].perguntas.length;
    $(`status-${t}`).textContent = aberto ? "Aberto" : "Fechado";
    $(`status-${t}`).classList.toggle("fechado", !aberto);
  });
  $("carregando").hidden = true;
  const pedido = location.hash.slice(1);
  if (tipos.includes(pedido)) mostrar(pedido);
})();
