// "Sincronizar com planilha" (aba Projetos): lê a planilha do Google (abas de cada curso, com as colunas
// "Nome da Equipe / Projeto" e "Identificação da Equipe") e deixa o cadastro igual a ela:
// atualiza os projetos que já existem, cria os que faltam e exclui os repetidos.
// Mostra tudo antes; só grava ao confirmar, e baixa uma cópia de segurança do cadastro antes.
// Telefone e e-mail da planilha não vão para o site (a lista de projetos é pública).
// Usa $, esc, cursos, projetos, recarregar e aviso de petianos.js.
(() => {
  const CHAVE_LINK = "feira-pet:planilha-link";

  const normalizar = (t) => String(t ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
  const limpar = (t) => String(t ?? "").replace(/\s+/g, " ").trim();
  const letraDe = (curso) => cursos.find((c) => c.id === curso)?.letra;
  const cursoDaLetra = (letra) => cursos.find((c) => c.letra === letra.toUpperCase())?.id;
  const curtoDe = (curso) => cursos.find((c) => c.id === curso)?.curto || curso;
  const cursoDoTexto = (t) => (/renov|alternativ/.test(normalizar(t)) ? "renovaveis" : /eletric/.test(normalizar(t)) ? "eletrica" : null);

  /* Leitura da planilha */
  function idDaPlanilha(link) {
    return String(link).match(/\/spreadsheets\/d\/([\w-]{20,})/)?.[1] || (/^[\w-]{30,}$/.test(link.trim()) ? link.trim() : null);
  }

  // CSV com aspas (o que o Google devolve).
  function lerCsv(texto) {
    const linhas = [];
    let linha = [];
    let campo = "";
    let aspas = false;
    for (let i = 0; i < texto.length; i++) {
      const c = texto[i];
      if (aspas) {
        if (c === '"' && texto[i + 1] === '"') {
          campo += '"';
          i++;
        } else if (c === '"') aspas = false;
        else campo += c;
      } else if (c === '"') aspas = true;
      else if (c === ",") {
        linha.push(campo);
        campo = "";
      } else if (c === "\n" || c === "\r") {
        if (c === "\r" && texto[i + 1] === "\n") i++;
        linha.push(campo);
        linhas.push(linha);
        linha = [];
        campo = "";
      } else campo += c;
    }
    if (campo || linha.length) {
      linha.push(campo);
      linhas.push(linha);
    }
    return linhas;
  }

  async function buscar(url) {
    let resposta;
    try {
      resposta = await fetch(url, { cache: "no-store" });
    } catch {
      throw new Error("Não consegui acessar a planilha. Confira a internet e se ela está compartilhada para “qualquer pessoa com o link”.");
    }
    if (!resposta.ok) throw new Error(`O Google recusou a leitura da planilha (erro ${resposta.status}). Ela precisa estar compartilhada para “qualquer pessoa com o link”.`);
    return resposta.text();
  }

  // Abas da planilha: [{ nome, gid }].
  async function abas(id) {
    const html = await buscar(`https://docs.google.com/spreadsheets/d/${id}/htmlview`);
    const lista = [];
    for (const m of html.matchAll(/\{name: "((?:[^"\\]|\\.)*)"[^}]*?gid: "(\d+)"/g)) {
      let nome = m[1];
      try {
        nome = JSON.parse(`"${nome.replace(/\\x([0-9a-f]{2})/gi, "\\u00$1")}"`);
      } catch {
        // fica como veio
      }
      if (!lista.some((a) => a.gid === m[2])) lista.push({ nome, gid: m[2] });
    }
    return lista.length ? lista : [{ nome: "", gid: "0" }];
  }

  // Projetos de uma aba de curso. Devolve null se a aba não for de projetos.
  function lerAba(aba, linhas, avisos) {
    const iCab = linhas.findIndex((l) => l.some((c) => /identifica/i.test(c)) && l.some((c) => /nome d[ae] equipe|projeto/i.test(c)));
    if (iCab < 0) return null;
    const cab = linhas[iCab];
    const col = (re) => cab.findIndex((c) => re.test(c));
    const cNome = col(/nome/i);
    const cId = col(/identifica/i);
    const cEquipe = col(/integrantes|respons/i);
    const titulo = linhas.slice(0, iCab).flat().join(" ");
    const cursoAba = cursoDoTexto(aba.nome) || cursoDoTexto(titulo);
    const itens = [];
    let disciplina = "";
    let posicao = 0;
    for (const l of linhas.slice(iCab + 1)) {
      const nome = limpar(l[cNome]);
      const id = limpar(l[cId]);
      if (!nome) continue;
      // Sem código e sem integrantes: é o cabeçalho de uma disciplina (a legenda ao lado não conta).
      if (!id && !limpar(l[cEquipe] ?? "")) {
        // Cabeçalho de disciplina: "📘 Integradora I (9 Projetos)"; "(Elétrica)" no nome sai.
        disciplina = limpar(
          nome
            .replace(/^[^\p{L}\p{N}]+/u, "")
            .replace(/\(\s*\d+\s*projetos?\s*\)\s*$/i, "")
            .replace(/\(\s*(eng\.?\s*)?(el[eé]trica|renov[aá]veis)\s*\)/gi, "")
        );
        continue;
      }
      posicao++;
      const m = id.match(/^(\d{1,2})\s*([a-z])$/i);
      const item = { nome, disciplina, equipe: limpar(l[cEquipe] ?? ""), aba: aba.nome, posicao, id };
      if (!m) {
        itens.push({ ...item, fora: true, curso: cursoAba });
        continue;
      }
      const curso = cursoDaLetra(m[2]) || cursoAba;
      if (!curso) {
        avisos.push(`“${nome}”: não reconheci o curso do código ${id}.`);
        continue;
      }
      itens.push({ ...item, curso, numero: Number(m[1]), codigo: `${Number(m[1])}${letraDe(curso)}` });
    }
    return itens;
  }

  async function lerPlanilha(link) {
    const id = idDaPlanilha(link);
    if (!id) throw new Error("Cole o link da planilha do Google (docs.google.com/spreadsheets/…).");
    const lista = await abas(id);
    const avisos = [];
    const itens = [];
    let lidas = 0;
    for (const aba of lista) {
      if (/^avalia/i.test(normalizar(aba.nome))) continue;
      const csv = await buscar(`https://docs.google.com/spreadsheets/d/${id}/gviz/tq?tqx=out:csv&gid=${aba.gid}`);
      const daAba = lerAba(aba, lerCsv(csv), avisos);
      if (!daAba) continue;
      lidas++;
      itens.push(...daAba);
    }
    if (!lidas) throw new Error("Não achei nenhuma aba com as colunas “Nome da Equipe / Projeto” e “Identificação da Equipe”.");

    // Mesmo código duas vezes: fica a linha que está na sequência dos vizinhos (ou a última).
    const votacao = itens.filter((i) => !i.fora);
    const porCodigo = new Map();
    for (const i of votacao) porCodigo.set(i.codigo, [...(porCodigo.get(i.codigo) || []), i]);
    const validos = [];
    for (const [codigo, repetidos] of porCodigo) {
      if (repetidos.length === 1) {
        validos.push(repetidos[0]);
        continue;
      }
      const vizinhos = (i) => {
        const daDisc = votacao.filter((x) => x.aba === i.aba && x.disciplina === i.disciplina);
        return daDisc.filter((x) => x !== i && Math.abs(x.numero - i.numero) === 1).length;
      };
      const fica = [...repetidos].sort((a, b) => vizinhos(b) - vizinhos(a))[0] || repetidos.at(-1);
      validos.push(fica);
      avisos.push(
        `O código ${codigo} aparece ${repetidos.length} vezes na planilha (${repetidos.map((r) => `“${r.nome}” em ${r.disciplina}`).join("; ")}). Usei “${fica.nome}” em ${fica.disciplina}.`
      );
    }
    // Números que faltam no meio da sequência (só aviso).
    for (const c of cursos) {
      const ns = validos.filter((i) => i.curso === c.id).map((i) => i.numero);
      if (!ns.length) continue;
      const faltam = [];
      for (let n = 1; n < Math.max(...ns); n++) if (!ns.includes(n)) faltam.push(`${n}${c.letra}`);
      if (faltam.length) avisos.push(`A planilha não tem ${faltam.join(", ")} (${c.curto}).`);
    }
    return { votacao: validos.sort((a, b) => a.curso.localeCompare(b.curso) || a.numero - b.numero), fora: itens.filter((i) => i.fora), avisos };
  }

  /* Comparação com o cadastro */
  let plano = null;

  function comparar(planilha, site) {
    const chave = (p) => normalizar(p.nome);
    const casados = new Map(); // item da planilha → projeto do site
    const usados = new Set();
    const casar = (teste) => {
      for (const item of planilha.votacao) {
        if (casados.has(item)) continue;
        const candidatos = site.filter((p) => !usados.has(p) && teste(item, p));
        if (candidatos.length !== 1 && !(candidatos.length > 1 && teste.primeiro)) continue;
        casados.set(item, candidatos[0]);
        usados.add(candidatos[0]);
      }
    };
    const mesmaDisc = (i, p) => normalizar(i.disciplina) === normalizar(p.disciplina);
    // "Grupo 1", "Equipe 2"…: o nome sozinho não identifica; precisa bater a disciplina também.
    const generico = (n) => /^(grupo|equipe|projeto|time)\s*\d*$/.test(normalizar(n));
    // 1) mesmo código e mesmo nome; 2) nome + curso + disciplina; 3) nome + curso; 4) só o nome;
    // 5) mesmo código e mesma disciplina (nome mudou na planilha).
    const passo1 = (i, p) => p.codigo === i.codigo && chave(p) === chave(i);
    passo1.primeiro = true;
    casar(passo1);
    const passo2 = (i, p) => chave(p) === chave(i) && p.curso === i.curso && mesmaDisc(i, p);
    passo2.primeiro = true;
    casar(passo2);
    casar((i, p) => chave(p) === chave(i) && p.curso === i.curso && !generico(i.nome));
    casar((i, p) => chave(p) === chave(i) && !generico(i.nome) && planilha.votacao.filter((x) => chave(x) === chave(i)).length === 1);
    // (só se o nome do site não aparece em outra linha da planilha: senão é repetido, não renomeado)
    const nomesDaPlanilha = new Set([...planilha.votacao, ...planilha.fora].map(chave));
    casar((i, p) => p.codigo === i.codigo && mesmaDisc(i, p) && !nomesDaPlanilha.has(chave(p)));

    // O que sobrou no site: repetido de um projeto da planilha, fora da votação (segundo a planilha) ou só no site.
    const sobras = site.filter((p) => !usados.has(p));
    const repetidos = [];
    const naoParticipam = [];
    const soNoSite = [];
    const jaVisto = new Set();
    for (const p of sobras) {
      // Repetido: mesmo nome, curso e disciplina de um projeto que já ficou com uma linha da planilha.
      const igual = [...casados.entries()].find(
        ([i, q]) => (chave(q) === chave(p) || chave(i) === chave(p)) && (q.curso === p.curso || i.curso === p.curso) && (mesmaDisc(q, p) || mesmaDisc(i, p))
      );
      const k = `${p.curso}|${chave(p)}|${normalizar(p.disciplina)}`;
      if (igual) repetidos.push({ projeto: p, de: igual[0] });
      else if (jaVisto.has(k)) repetidos.push({ projeto: p, de: null });
      else if (planilha.fora.some((f) => chave(f) === chave(p) && (!generico(f.nome) || mesmaDisc(f, p)))) naoParticipam.push({ projeto: p, excluir: false });
      else soNoSite.push({ projeto: p, excluir: false });
      jaVisto.add(k);
    }
    repetidos.forEach((r) => (r.excluir = true));

    const atualizar = [];
    const iguais = [];
    const criar = [];
    for (const item of planilha.votacao) {
      const p = casados.get(item);
      if (!p) {
        criar.push(item);
        continue;
      }
      const mud = [];
      if (p.codigo !== item.codigo) mud.push(`código ${p.codigo} → ${item.codigo}`);
      if (limpar(p.nome) !== item.nome) mud.push(`nome “${p.nome}” → “${item.nome}”`);
      if (p.curso !== item.curso) mud.push(`curso ${curtoDe(p.curso)} → ${curtoDe(item.curso)}`);
      if (limpar(p.disciplina) !== item.disciplina) mud.push(`disciplina “${p.disciplina || "—"}” → “${item.disciplina}”`);
      if (item.equipe && limpar(p.equipe) !== item.equipe) mud.push("integrantes");
      (mud.length ? atualizar : iguais).push({ item, projeto: p, mud });
    }
    return { planilha, casados, atualizar, iguais, criar, repetidos, naoParticipam, soNoSite };
  }

  // Cadastro final + mapa de códigos (antigo → novo/null), conforme as escolhas da janela.
  function montarFinal() {
    const fixar = $("sinc-fixar").checked;
    const final = {};
    const mapa = new Map();
    const guardado = (p) => {
      const { id: _i, codigo: _c, arte: _a, cor: _co, ...resto } = p;
      return resto;
    };
    for (const item of plano.planilha.votacao) {
      const p = plano.casados.get(item);
      const base = p ? guardado(p) : { resumo: "" };
      final[item.codigo] = {
        ...base,
        nome: item.nome,
        curso: item.curso,
        disciplina: item.disciplina,
        equipe: item.equipe || base.equipe || "",
        numero: item.numero,
        ...(fixar ? { stand: item.codigo, prioridade: true } : {}),
      };
      if (p) mapa.set(p.codigo, item.codigo);
    }
    // Os mantidos que não estão na planilha vão para os próximos números livres do curso.
    const mantidos = [...plano.naoParticipam, ...plano.soNoSite, ...plano.repetidos].filter((x) => !x.excluir);
    const excluidos = [...plano.naoParticipam, ...plano.soNoSite, ...plano.repetidos].filter((x) => x.excluir);
    for (const x of mantidos) {
      const p = x.projeto;
      let numero = p.numero;
      const ocupado = (n) => final[`${n}${letraDe(p.curso)}`];
      if (ocupado(numero)) {
        numero = Math.max(0, ...Object.values(final).filter((q) => q.curso === p.curso).map((q) => q.numero)) + 1;
      }
      const novo = `${numero}${letraDe(p.curso)}`;
      const dados = { ...guardado(p), numero };
      if (numero !== p.numero && API.standNumerico(p.stand)) dados.stand = novo;
      final[novo] = dados;
      x.novoCodigo = novo;
      mapa.set(p.codigo, novo);
    }
    for (const x of excluidos) {
      mapa.set(x.projeto.codigo, null);
      x.novoCodigo = null;
    }
    return { final, mapa };
  }

  /* Tela */
  function linha(texto, sub = "") {
    return `<li><span>${texto}</span>${sub ? `<small>${sub}</small>` : ""}</li>`;
  }

  function secao(titulo, n, conteudo, aberto = true, classe = "") {
    if (!n) return "";
    return `<details class="sinc-secao ${classe}" ${aberto ? "open" : ""}><summary>${titulo} <b>${n}</b></summary><ul>${conteudo}</ul></details>`;
  }

  function caixa(grupo, i, x, rotulo) {
    return `<label class="sinc-caixa"><input type="checkbox" data-grupo="${grupo}" data-i="${i}" ${x.excluir ? "checked" : ""}> ${rotulo}</label>`;
  }

  function render() {
    const { final, mapa } = montarFinal();
    const nome = (p) => `<b>${esc(p.codigo)}</b> ${esc(p.nome)}`;
    const destino = (x) => (x.excluir ? "será excluído" : x.novoCodigo === x.projeto.codigo ? "fica como está" : `fica como ${x.novoCodigo}`);
    const total = Object.keys(final).length;
    const excluidos = [...mapa.values()].filter((v) => v === null).length;
    const porCurso = cursos.map((c) => `${Object.values(final).filter((p) => p.curso === c.id).length} ${c.curto}`).join(" · ");

    $("sinc-resultado").innerHTML = `
      <p class="sinc-resumo">Depois de aplicar: <b>${total} projetos</b> (${porCurso}).
        ${plano.atualizar.length} atualizado(s), ${plano.criar.length} criado(s), ${excluidos} excluído(s), ${plano.iguais.length} sem mudança.</p>
      ${plano.planilha.avisos.length ? `<div class="sinc-avisos"><b>Avisos da planilha</b><ul>${plano.planilha.avisos.map((a) => `<li>${esc(a)}</li>`).join("")}</ul></div>` : ""}
      ${secao("Atualizar", plano.atualizar.length, plano.atualizar.map((x) => linha(`${nome(x.projeto)} → <b>${esc(x.item.codigo)}</b> ${esc(x.item.nome)}`, esc(x.mud.join("; ")))).join(""))}
      ${secao("Criar", plano.criar.length, plano.criar.map((i) => linha(`<b>${esc(i.codigo)}</b> ${esc(i.nome)}`, `${esc(curtoDe(i.curso))} · ${esc(i.disciplina)}`)).join(""))}
      ${secao(
        "Repetidos no site",
        plano.repetidos.length,
        plano.repetidos
          .map((x, i) => linha(`${caixa("repetidos", i, x, "excluir")} ${nome(x.projeto)}`, `${esc(x.projeto.disciplina)} · ${x.de ? `repete “${esc(x.de.nome)}” (${esc(x.de.codigo)})` : "repetido"} · ${destino(x)}`))
          .join(""),
        true,
        "alerta"
      )}
      ${secao(
        "Na planilha como “não participante da votação”",
        plano.naoParticipam.length,
        plano.naoParticipam.map((x, i) => linha(`${caixa("naoParticipam", i, x, "excluir")} ${nome(x.projeto)}`, `${esc(x.projeto.disciplina)} · ${destino(x)}`)).join("")
      )}
      ${secao(
        "Só no site (não estão na planilha)",
        plano.soNoSite.length,
        plano.soNoSite.map((x, i) => linha(`${caixa("soNoSite", i, x, "excluir")} ${nome(x.projeto)}`, `${esc(x.projeto.disciplina)} · ${destino(x)}`)).join("")
      )}
      ${secao("Sem mudança", plano.iguais.length, plano.iguais.map((x) => linha(nome(x.projeto))).join(""), false)}`;
    $("sinc-aplicar").disabled = false;
  }

  function feedback(texto, erro = false) {
    $("sinc-feedback").textContent = texto;
    $("sinc-feedback").classList.toggle("erro", erro);
  }

  async function ler() {
    const link = $("sinc-link").value.trim();
    $("sinc-ler").disabled = true;
    $("sinc-aplicar").disabled = true;
    $("sinc-resultado").innerHTML = "";
    feedback("Lendo a planilha…");
    try {
      try {
        localStorage.setItem(CHAVE_LINK, link);
      } catch {
        // tanto faz
      }
      const [planilha, site] = await Promise.all([lerPlanilha(link), API.lerCadastro()]);
      plano = comparar(planilha, site);
      feedback(`Planilha lida: ${planilha.votacao.length} projetos na votação e ${planilha.fora.length} fora dela. Confira e clique em “Aplicar”.`);
      render();
    } catch (erro) {
      console.error(erro);
      plano = null;
      feedback(erro.message, true);
    } finally {
      $("sinc-ler").disabled = false;
    }
  }

  function baixarCopia(projetosAntes) {
    const blob = new Blob([JSON.stringify({ geradoEm: new Date().toISOString(), projetos: projetosAntes }, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `copia-projetos-antes-da-planilha-${new Date().toISOString().slice(0, 19).replace(/[T:]/g, "-")}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  async function aplicar() {
    if (!plano) return;
    const botao = $("sinc-aplicar");
    botao.disabled = true;
    try {
      let votos = 0;
      try {
        votos = Object.values((await API.buscarVotos()).votos).reduce((s, v) => s + v, 0);
      } catch {
        // sem como saber
      }
      if (votos > 0 && !confirm(`Já há ${votos} voto(s) na rodada atual. Mudar os códigos agora mistura a contagem. Continuar mesmo assim (e zerar a votação depois)?`)) return;
      feedback("Aplicando…");
      const atual = await API.lerCadastro();
      const antes = Object.fromEntries(
        atual.map((p) => {
          const { id, codigo, arte, cor, ...resto } = p;
          return [codigo, resto];
        })
      );
      baixarCopia(antes);
      const { final, mapa } = montarFinal();
      await API.substituirProjetos(final, mapa);
      await recarregar();
      $("sinc-dialogo").close();
      aviso(
        `Cadastro igual à planilha: ${Object.keys(final).length} projetos. Uma cópia do cadastro anterior foi baixada. ` +
          "Agora baixe de novo as placas de mesa e o .ino das duas urnas."
      );
    } catch (erro) {
      console.error(erro);
      feedback(`Não consegui aplicar. ${erro.message}`, true);
    } finally {
      botao.disabled = !plano;
    }
  }

  /* Eventos */
  $("sinc-abrir").addEventListener("click", () => {
    try {
      $("sinc-link").value = localStorage.getItem(CHAVE_LINK) || "";
    } catch {
      // sem armazenamento
    }
    plano = null;
    $("sinc-resultado").innerHTML = "";
    $("sinc-aplicar").disabled = true;
    feedback("");
    $("sinc-dialogo").showModal();
    if ($("sinc-link").value) ler();
  });
  $("sinc-fechar").addEventListener("click", () => $("sinc-dialogo").close());
  $("sinc-cancelar").addEventListener("click", () => $("sinc-dialogo").close());
  $("sinc-ler").addEventListener("click", ler);
  $("sinc-link").addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      ler();
    }
  });
  $("sinc-aplicar").addEventListener("click", aplicar);
  $("sinc-fixar").addEventListener("change", () => plano && render());
  $("sinc-resultado").addEventListener("change", (e) => {
    const c = e.target.closest("[data-grupo]");
    if (!c) return;
    plano[c.dataset.grupo][Number(c.dataset.i)].excluir = c.checked;
    const aberto = [...$("sinc-resultado").querySelectorAll("details")].map((d) => d.open);
    render();
    [...$("sinc-resultado").querySelectorAll("details")].forEach((d, i) => (d.open = aberto[i] ?? d.open));
  });
})();
