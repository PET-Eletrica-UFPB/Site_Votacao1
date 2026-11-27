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

    // Mesmo código duas vezes: fica a linha que está na sequência dos vizinhos; a outra fica com o número
    // que falta na sequência da disciplina dela (ex.: EcoPet em Ciência dos Materiais com 23B → 2B), se houver.
    const votacao = itens.filter((i) => !i.fora);
    const usado = (curso, n) => votacao.some((x) => x.curso === curso && x.numero === n && !x.descartado);
    const daSecao = (i) => votacao.filter((x) => x.aba === i.aba && x.disciplina === i.disciplina).sort((a, b) => a.posicao - b.posicao);
    const vizinhos = (i) => daSecao(i).filter((x) => x !== i && Math.abs(x.numero - i.numero) === 1).length;
    const porCodigo = new Map();
    for (const i of votacao) porCodigo.set(i.codigo, [...(porCodigo.get(i.codigo) || []), i]);
    for (const [codigo, repetidos] of porCodigo) {
      if (repetidos.length === 1) continue;
      const fica = [...repetidos].sort((a, b) => vizinhos(b) - vizinhos(a))[0];
      for (const o of repetidos.filter((x) => x !== fica)) {
        const secao = daSecao(o);
        const k = secao.indexOf(o);
        const antes = secao[k - 1];
        const depois = secao[k + 1];
        const candidato = antes ? antes.numero + 1 : depois ? depois.numero - 1 : null;
        if (candidato && candidato > 0 && !usado(o.curso, candidato)) {
          o.numero = candidato;
          o.codigo = `${candidato}${letraDe(o.curso)}`;
          avisos.push(`O código ${codigo} aparece duas vezes na planilha (“${fica.nome}” em ${fica.disciplina} e “${o.nome}” em ${o.disciplina}). “${o.nome}” em ${o.disciplina} ficou com ${o.codigo}, o número que falta na sequência dela.`);
        } else {
          o.descartado = true;
          avisos.push(`O código ${codigo} aparece duas vezes na planilha. Usei “${fica.nome}” em ${fica.disciplina}; “${o.nome}” em ${o.disciplina} ficou de fora.`);
        }
      }
    }
    const validos = votacao.filter((i) => !i.descartado);
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

  // Nome sem a sigla do fim ("EcoPet (ICM)" = "EcoPet") e sem pontuação.
  const base = (n) => normalizar(n).replace(/\s*\([^)]*\)\s*$/, "").replace(/[^\p{L}\p{N}]+/gu, " ").trim();
  // "Grupo 1", "Equipe 2 / Grupo 2"…: o nome sozinho não identifica.
  const generico = (n) => /^((grupo|equipe|time|projeto)\s*\d*\s*)+$/.test(base(n));
  const numeroDoGrupo = (n) => base(n).match(/\b(?:grupo|equipe)\s*(\d+)/)?.[1] ?? null;

  // Disciplinas iguais apesar de acento, sigla ("ICM (Introdução à Ciência dos Materiais)", "UCE") ou erro de
  // digitação de uma letra ("Projetor Integrador I"). Algarismos romanos precisam bater (I ≠ II).
  const PALAVRAS_VAZIAS = new Set(["a", "o", "as", "os", "de", "da", "do", "das", "dos", "e", "em", "na", "no"]);
  const palavras = (t) => normalizar(t).replace(/[^\p{L}\p{N}]+/gu, " ").split(" ").filter((x) => x && !PALAVRAS_VAZIAS.has(x));
  function formas(d) {
    const n = normalizar(d);
    const lista = [palavras(d), palavras(n.replace(/\([^)]*\)/g, ""))];
    const dentro = n.match(/\(([^)]*)\)/)?.[1];
    if (dentro) lista.push(palavras(dentro));
    return lista.filter((f) => f.length);
  }
  const quase = (a, b) => {
    if (a === b) return true;
    if (Math.min(a.length, b.length) < 5 || Math.abs(a.length - b.length) > 1) return false;
    let i = 0;
    while (i < Math.min(a.length, b.length) && a[i] === b[i]) i++;
    const resto = (x) => x.slice(i + 1);
    return resto(a) === resto(b) || resto(a) === b.slice(i) || a.slice(i) === resto(b);
  };
  const mesmasPalavras = (x, y) => x.length === y.length && x.every((w, k) => (/^[ivx]+$/.test(w) || /^[ivx]+$/.test(y[k]) ? w === y[k] : quase(w, y[k])));
  const sigla = (f) => (f.length > 1 ? f.map((w) => w[0]).join("") : null);
  function mesmaDisciplina(a, b) {
    const fa = formas(a);
    const fb = formas(b);
    for (const x of fa)
      for (const y of fb) {
        if (mesmasPalavras(x, y)) return true;
        if (x.length === 1 && x[0] === sigla(y)) return true;
        if (y.length === 1 && y[0] === sigla(x)) return true;
      }
    return false;
  }

  function comparar(planilha, site) {
    const itens = [...planilha.votacao, ...planilha.fora];
    const casados = new Map(); // item da planilha → projeto do site
    const usados = new Set();
    const disc = (i, p) => mesmaDisciplina(i.disciplina, p.disciplina);
    const casar = (teste, primeiro = false) => {
      for (const item of itens) {
        if (casados.has(item)) continue;
        const candidatos = site.filter((p) => !usados.has(p) && teste(item, p));
        if (!candidatos.length || (candidatos.length > 1 && !primeiro)) continue;
        casados.set(item, candidatos[0]);
        usados.add(candidatos[0]);
      }
    };
    const mesmoNome = (i, p) => base(i.nome) === base(p.nome);
    const nomesDaPlanilha = new Set(itens.map((i) => base(i.nome)));
    const contagem = new Map();
    itens.forEach((i) => contagem.set(base(i.nome), (contagem.get(base(i.nome)) || 0) + 1));

    // Do mais certo para o menos certo.
    casar((i, p) => !i.fora && p.codigo === i.codigo && mesmoNome(i, p), true);
    casar((i, p) => mesmoNome(i, p) && p.curso === i.curso && disc(i, p), true);
    casar((i, p) => mesmoNome(i, p) && disc(i, p) && !generico(i.nome));
    casar((i, p) => mesmoNome(i, p) && p.curso === i.curso && !generico(i.nome));
    casar((i, p) => mesmoNome(i, p) && !generico(i.nome) && contagem.get(base(i.nome)) === 1);
    casar((i, p) => generico(i.nome) && generico(p.nome) && numeroDoGrupo(i.nome) && numeroDoGrupo(i.nome) === numeroDoGrupo(p.nome) && p.curso === i.curso && disc(i, p));
    // Nome mudou na planilha: mesmo código e disciplina, e o nome do site não aparece em outra linha.
    casar((i, p) => !i.fora && p.codigo === i.codigo && disc(i, p) && !nomesDaPlanilha.has(base(p.nome)));
    // Sobrou exatamente um de cada lado na mesma disciplina e curso: é o mesmo projeto com outro nome.
    for (const item of itens) {
      if (casados.has(item)) continue;
      const doLado = (lista, x) => lista.filter((y) => y.curso === x.curso && mesmaDisciplina(y.disciplina, x.disciplina));
      const itensLivres = doLado(itens.filter((i) => !casados.has(i)), item);
      const siteLivres = doLado(site.filter((p) => !usados.has(p)), item);
      if (itensLivres.length === 1 && siteLivres.length === 1) {
        casados.set(item, siteLivres[0]);
        usados.add(siteLivres[0]);
      }
    }

    // O que sobrou no site: repetido (mesmo nome, curso e disciplina de um projeto que já tem linha) ou só no site.
    const repetidos = [];
    const soNoSite = [];
    const vistos = [];
    for (const p of site.filter((x) => !usados.has(x))) {
      const igual = [...casados.entries()].find(([i, q]) => (mesmoNome(q, p) || mesmoNome(i, p)) && q.curso === p.curso && mesmaDisciplina(q.disciplina, p.disciplina));
      const outro = vistos.find((q) => mesmoNome(q, p) && q.curso === p.curso && mesmaDisciplina(q.disciplina, p.disciplina));
      if (igual) repetidos.push({ projeto: p, de: igual[1], excluir: true });
      else if (outro) repetidos.push({ projeto: p, de: outro, excluir: true });
      else soNoSite.push({ projeto: p, excluir: true });
      vistos.push(p);
    }
    return { planilha, itens, casados, repetidos, soNoSite };
  }

  // Nome final: o do site quando é o mesmo da planilha com sigla ("EcoPet (ICM)") ou o mesmo grupo genérico.
  const nomeFinal = (item, p) =>
    p && (base(p.nome) === base(item.nome) || (generico(p.nome) && generico(item.nome) && numeroDoGrupo(p.nome) === numeroDoGrupo(item.nome))) ? p.nome : item.nome;

  // Cadastro final + mapa de códigos (antigo → novo/null), conforme as escolhas da janela.
  function montarFinal() {
    const fixar = $("sinc-fixar").checked;
    const final = {};
    const mapa = new Map();
    const guardado = (p) => {
      const { id: _i, codigo: _c, arte: _a, cor: _co, ...resto } = p;
      return resto;
    };
    const gravar = (item, numero) => {
      const p = plano.casados.get(item);
      const dados = p ? guardado(p) : { resumo: "" };
      const codigo = `${numero}${letraDe(item.curso)}`;
      final[codigo] = {
        ...dados,
        nome: nomeFinal(item, p),
        curso: item.curso,
        disciplina: item.disciplina,
        equipe: item.equipe || dados.equipe || "",
        numero,
        ...(fixar ? { stand: codigo, prioridade: true } : {}),
      };
      item.codigoFinal = codigo;
      if (p) mapa.set(p.codigo, codigo);
    };
    for (const item of plano.planilha.votacao) gravar(item, item.numero);

    // Fora da votação: depois do último código da votação do curso (mantém o número do site, se estiver livre lá).
    const ultimo = (curso) => Math.max(0, ...plano.planilha.votacao.filter((i) => i.curso === curso).map((i) => i.numero));
    const livre = (curso, n) => !final[`${n}${letraDe(curso)}`];
    const pendentes = [];
    for (const item of plano.planilha.fora) {
      const p = plano.casados.get(item);
      if (p && p.curso === item.curso && p.numero > ultimo(item.curso) && livre(item.curso, p.numero)) gravar(item, p.numero);
      else pendentes.push(item);
    }
    const proximo = (curso) => {
      let n = ultimo(curso) + 1;
      while (!livre(curso, n)) n++;
      return n;
    };
    for (const item of pendentes) gravar(item, proximo(item.curso));

    // Os que só estão no site e ficam: próximos números livres do curso.
    for (const x of [...plano.soNoSite, ...plano.repetidos]) {
      const p = x.projeto;
      if (x.excluir) {
        mapa.set(p.codigo, null);
        x.novoCodigo = null;
        continue;
      }
      const numero = livre(p.curso, p.numero) ? p.numero : proximo(p.curso);
      const novo = `${numero}${letraDe(p.curso)}`;
      const dados = { ...guardado(p), numero };
      if (numero !== p.numero && API.standNumerico(p.stand)) dados.stand = novo;
      final[novo] = dados;
      x.novoCodigo = novo;
      mapa.set(p.codigo, novo);
    }
    return { final, mapa };
  }

  // O que muda em cada projeto da planilha (depois de montarFinal, que dá o código final).
  function mudancas(item) {
    const p = plano.casados.get(item);
    const f = item.codigoFinal;
    const mud = [];
    if (p.codigo !== f) mud.push(`código ${p.codigo} → ${f}`);
    if (p.nome !== nomeFinal(item, p)) mud.push(`nome “${p.nome}” → “${item.nome}”`);
    if (p.curso !== item.curso) mud.push(`curso ${curtoDe(p.curso)} → ${curtoDe(item.curso)}`);
    if (limpar(p.disciplina) !== item.disciplina) mud.push(`disciplina “${p.disciplina || "—"}” → “${item.disciplina}”`);
    if (item.equipe && limpar(p.equipe) !== item.equipe) mud.push("integrantes");
    return mud;
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
    const fora = (i) => (i.fora ? " · fora da votação (segundo a planilha)" : "");
    const atualizar = [];
    const iguais = [];
    const criar = [];
    for (const item of plano.itens) {
      if (!plano.casados.has(item)) criar.push(item);
      else {
        const mud = mudancas(item);
        (mud.length ? atualizar : iguais).push({ item, projeto: plano.casados.get(item), mud });
      }
    }
    const excluidos = [...mapa.values()].filter((v) => v === null).length;
    const porCurso = cursos.map((c) => `${Object.values(final).filter((p) => p.curso === c.id).length} ${c.curto}`).join(" · ");

    $("sinc-resultado").innerHTML = `
      <p class="sinc-resumo">Depois de aplicar: <b>${Object.keys(final).length} projetos</b> (${porCurso}).
        ${atualizar.length} atualizado(s), ${criar.length} criado(s), ${excluidos} excluído(s), ${iguais.length} sem mudança.</p>
      ${plano.planilha.avisos.length ? `<div class="sinc-avisos"><b>Avisos da planilha</b><ul>${plano.planilha.avisos.map((a) => `<li>${esc(a)}</li>`).join("")}</ul></div>` : ""}
      ${secao("Atualizar", atualizar.length, atualizar.map((x) => linha(`${nome(x.projeto)} → <b>${esc(x.item.codigoFinal)}</b> ${esc(nomeFinal(x.item, x.projeto))}`, esc(x.mud.join("; ") + fora(x.item)))).join(""))}
      ${secao("Criar", criar.length, criar.map((i) => linha(`<b>${esc(i.codigoFinal)}</b> ${esc(i.nome)}`, `${esc(curtoDe(i.curso))} · ${esc(i.disciplina)}${fora(i)}`)).join(""))}
      ${secao(
        "Repetidos no site",
        plano.repetidos.length,
        plano.repetidos
          .map((x, i) => linha(`${caixa("repetidos", i, x, "excluir")} ${nome(x.projeto)}`, `${esc(x.projeto.disciplina)} · repete “${esc(x.de.nome)}” (${esc(x.de.codigo)}) · ${destino(x)}`))
          .join(""),
        true,
        "alerta"
      )}
      ${secao(
        "Só no site (não estão na planilha)",
        plano.soNoSite.length,
        plano.soNoSite.map((x, i) => linha(`${caixa("soNoSite", i, x, "excluir")} ${nome(x.projeto)}`, `${esc(x.projeto.disciplina)} · ${destino(x)}`)).join(""),
        true,
        "alerta"
      )}
      ${secao("Sem mudança", iguais.length, iguais.map((x) => linha(nome(x.projeto))).join(""), false)}`;
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
      feedback(
        `Planilha lida: ${planilha.votacao.length + planilha.fora.length} projetos (${planilha.votacao.length} na votação e ${planilha.fora.length} fora dela). Confira e clique em “Aplicar”.`
      );
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
