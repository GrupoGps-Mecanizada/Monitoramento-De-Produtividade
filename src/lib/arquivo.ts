/** Baixa um texto como arquivo (com BOM, para o Excel abrir os acentos). */
export function baixarTexto(nome: string, texto: string, tipo = "text/csv;charset=utf-8") {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob(["\uFEFF" + texto], { type: tipo }));
  a.download = nome;
  a.click();
  URL.revokeObjectURL(a.href);
}
