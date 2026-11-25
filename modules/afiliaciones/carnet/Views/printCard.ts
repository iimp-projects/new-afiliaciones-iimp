/**
 * Impresión del carnet reutilizando el PDF institucional como fuente única.
 * El endpoint debe responder con `Content-Disposition: inline` (mode=print) para
 * poder renderizarse dentro del iframe. Si el navegador no dispara la impresión
 * embebida, se abre el PDF en una pestaña nueva como alternativa.
 */
export function printCardPdf(pdfUrl: string): void {
  if (typeof document === "undefined") return;

  const frame = document.createElement("iframe");
  frame.setAttribute("aria-hidden", "true");
  frame.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;";

  let loaded = false;
  const fallback = window.setTimeout(() => {
    if (loaded) return;
    frame.remove();
    window.open(pdfUrl, "_blank", "noopener,noreferrer");
  }, 4_000);

  frame.onload = () => {
    loaded = true;
    window.clearTimeout(fallback);
    try {
      const view = frame.contentWindow;
      if (!view) throw new Error("no-print-window");
      view.focus();
      view.print();
      window.setTimeout(() => frame.remove(), 60_000);
    } catch {
      frame.remove();
      window.open(pdfUrl, "_blank", "noopener,noreferrer");
    }
  };

  frame.src = pdfUrl;
  document.body.appendChild(frame);
}
