// Monta o .ino de cada urna a partir de modelo-urna.js e da lista de projetos.
window.GeradorUrna = (() => {
  // Limites do código da urna: rankingAtual[50] e número digitado com 2 dígitos.
  const MAX_POR_CURSO = 50;
  const MAX_NUMERO = 99;

  // O LCD 20x4 não tem acentos: o nome vai para a urna só com caracteres ASCII.
  function nomeParaUrna(nome) {
    return String(nome ?? "")
      .normalize("NFD")
      .replace(/[^\x20-\x7e]/g, "")
      .trim();
  }

  const stringC = (texto) => String(texto).replaceAll("\\", "\\\\").replaceAll('"', '\\"');

  function linhasProjetos(projetos, curso) {
    return projetos
      .filter((p) => p.curso === curso)
      .sort((a, b) => a.numero - b.numero)
      .map((p) => {
        const nome = nomeParaUrna(p.nome) || `Projeto ${p.numero}`;
        return `  ${`{${p.numero},`.padEnd(5)}"${stringC(nome)}", 0, 0}`;
      })
      .join(",\n");
  }

  // Retorna o motivo que impede gerar o arquivo, ou null se a lista serve.
  function problemaNaLista(projetos) {
    for (const curso of window.FEIRA.cursos) {
      const doCurso = projetos.filter((p) => p.curso === curso.id);
      if (!doCurso.length) return `${curso.curto} ainda não tem projeto cadastrado.`;
      if (doCurso.length > MAX_POR_CURSO) return `${curso.curto} passou do limite de ${MAX_POR_CURSO} projetos da urna.`;
      if (doCurso.some((p) => !(p.numero >= 1 && p.numero <= MAX_NUMERO))) {
        return `${curso.curto} tem projeto com número fora de 1 a ${MAX_NUMERO}.`;
      }
    }
    return null;
  }

  function gerarIno(urna, projetos, { senhaFirebase, senhaOperador }) {
    const campos = {
      NOME_AP: urna.ap,
      ID_URNA: urna.id,
      // Sem senha, o próprio código da urna avisa que falta preencher no Arduino IDE.
      FIREBASE_PASSWORD: stringC(senhaFirebase || "COLOQUE_A_SENHA_AQUI"),
      SENHA_OPERADOR: stringC(senhaOperador),
      PROJETOS_ELETRICA: linhasProjetos(projetos, "eletrica"),
      PROJETOS_RENOVAVEIS: linhasProjetos(projetos, "renovaveis"),
    };
    return window.MODELO_URNA.replace(/\{\{([A-Z_]+)\}\}/g, (_, campo) => campos[campo]);
  }

  function baixar(nomeArquivo, conteudo) {
    const url = URL.createObjectURL(new Blob([conteudo], { type: "text/plain;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = nomeArquivo;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return { MAX_POR_CURSO, MAX_NUMERO, nomeParaUrna, problemaNaLista, gerarIno, baixar };
})();
