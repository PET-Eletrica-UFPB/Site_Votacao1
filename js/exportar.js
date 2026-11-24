// Baixa uma tabela como planilha do Excel (.xlsx). Sem internet para a biblioteca, sai em .csv.
window.Exportar = (() => {
  const SHEETJS = "https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js";

  function carregar() {
    if (window.XLSX) return Promise.resolve(window.XLSX);
    return new Promise((ok, falha) => {
      const s = document.createElement("script");
      s.src = SHEETJS;
      s.onload = () => ok(window.XLSX);
      s.onerror = falha;
      document.head.append(s);
    });
  }

  function baixarArquivo(nome, blob) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = nome;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  // Ponto e vírgula e BOM: é o formato que o Excel em português abre direto.
  function csv(linhas) {
    const celula = (v) => {
      const t = String(v ?? "");
      return /[";\n\r]/.test(t) ? `"${t.replaceAll('"', '""')}"` : t;
    };
    return "﻿" + linhas.map((l) => l.map(celula).join(";")).join("\r\n");
  }

  // linhas[0] é o cabeçalho. Devolve a extensão usada.
  async function tabela(nomeBase, nomeAba, linhas) {
    const dia = new Date().toISOString().slice(0, 10);
    try {
      const XLSX = await carregar();
      const planilha = XLSX.utils.aoa_to_sheet(linhas);
      // Largura de cada coluna pelo maior texto, com limite para não ficar enorme.
      planilha["!cols"] = linhas[0].map((_, i) => ({
        wch: Math.min(60, Math.max(6, ...linhas.map((l) => String(l[i] ?? "").split("\n")[0].length + 2))),
      }));
      planilha["!autofilter"] = { ref: XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: linhas.length - 1, c: linhas[0].length - 1 } }) };
      const livro = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(livro, planilha, nomeAba.slice(0, 31));
      XLSX.writeFile(livro, `${nomeBase}-${dia}.xlsx`);
      return "xlsx";
    } catch {
      baixarArquivo(`${nomeBase}-${dia}.csv`, new Blob([csv(linhas)], { type: "text/csv;charset=utf-8" }));
      return "csv";
    }
  }

  return { tabela, csv };
})();
