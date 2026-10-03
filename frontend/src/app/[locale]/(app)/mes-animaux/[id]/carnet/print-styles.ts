/**
 * Feuille de style du carnet imprimable. Injectée par la page (balise <style>) : elle disparaît
 * avec la page, donc `@page` et le masquage de la coquille de l'app ne touchent aucune autre route.
 *
 * La même feuille accompagne le fichier HTML autonome partagé depuis l'app mobile : la planche
 * ne dépend donc d'aucun jeton de l'app. Ses couleurs reprennent la palette « papier / encre »
 * (DESIGN.md § 3.1) en valeurs fixes ; les polices de l'app sont utilisées si elles sont chargées,
 * sinon leurs équivalents système. La feuille reste claire en mode sombre : c'est un document.
 */
export const CARNET_CSS = `
.carnet-page{max-width:calc(210mm + 3rem);margin:0 auto;padding-top:1.5rem;padding-bottom:3rem}
.carnet-sheet{--c-paper:#FFFDF8;--c-ink:#1D2B24;--c-ink-2:#5B655E;--c-line:#E2DCCF;--c-line-strong:#CDC5B4;--c-accent:#2F5D46;--c-warn:#8A5A00;
  --c-serif:var(--font-fraunces,'Iowan Old Style','Palatino Linotype',Georgia,serif);
  --c-sans:var(--font-plex-sans,system-ui,-apple-system,'Segoe UI',sans-serif);
  --c-mono:var(--font-plex-mono,ui-monospace,'SFMono-Regular',Menlo,Consolas,monospace);
  background:var(--c-paper);color:var(--c-ink);font-family:var(--c-sans);font-size:.9375rem;line-height:1.5;
  border:1px solid var(--c-line-strong);border-radius:10px;padding:1.25rem}
@media (min-width:640px){.carnet-sheet{padding:2.25rem 2.5rem}}
.carnet-sheet *{box-sizing:border-box}
.carnet-header{display:grid;grid-template-columns:1fr auto;align-items:end;gap:.25rem 1rem;padding-bottom:.6rem}
.carnet-brand{margin:0;font-family:var(--c-serif);font-size:1rem;font-weight:600;color:var(--c-accent)}
.carnet-title{margin:0;font-family:var(--c-serif);font-size:1.9rem;font-weight:500;line-height:1.15;letter-spacing:-.01em}
.carnet-edited{margin:0;font-family:var(--c-mono);font-size:.75rem;color:var(--c-ink-2);text-align:right;font-variant-numeric:tabular-nums}
.carnet-rule{height:5px;border-top:2px solid var(--c-ink);border-bottom:1px solid var(--c-ink);margin:0 0 1.25rem}
.carnet-subject{display:flex;flex-wrap:wrap;align-items:baseline;gap:.25rem .75rem;margin:0 0 1rem}
.carnet-name{margin:0;font-family:var(--c-serif);font-size:1.5rem;font-weight:600}
.carnet-latin{font-family:var(--c-serif);font-style:italic;color:var(--c-ink-2)}
.carnet-section{margin-top:1.5rem}
.carnet-h2{display:flex;align-items:baseline;gap:.6rem;margin:0 0 .5rem;padding-bottom:.3rem;border-bottom:1px solid var(--c-ink);font-family:var(--c-serif);font-size:1.15rem;font-weight:600}
.carnet-num{font-family:var(--c-mono);font-size:.75rem;font-weight:400;color:var(--c-ink-2)}
.carnet-identity{display:grid;grid-template-columns:repeat(auto-fit,minmax(10rem,1fr));gap:0 1.5rem;margin:0}
.carnet-identity>div{padding:.45rem 0;border-bottom:1px dotted var(--c-line-strong)}
.carnet-identity dt{font-size:.75rem;color:var(--c-ink-2)}
.carnet-identity dd{margin:0;font-weight:500;overflow-wrap:anywhere}
.carnet-mono{font-family:var(--c-mono);font-variant-numeric:tabular-nums slashed-zero}
.carnet-table-wrap{overflow-x:auto}
.carnet-table{width:100%;border-collapse:collapse;font-size:.85rem}
.carnet-table th,.carnet-table td{padding:.4rem .5rem .4rem 0;text-align:left;vertical-align:top;overflow-wrap:anywhere}
.carnet-table th{font-size:.72rem;font-weight:500;color:var(--c-ink-2);border-bottom:1px solid var(--c-line-strong)}
.carnet-table td{border-bottom:1px dotted var(--c-line-strong)}
.carnet-table tr:last-child td{border-bottom:0}
.carnet-table .carnet-mono{white-space:nowrap}
.carnet-empty{margin:0;font-size:.85rem;font-style:italic;color:var(--c-ink-2)}
.carnet-contacts{margin:0;padding-left:1.1rem;font-size:.875rem}
.carnet-disclaimer{margin:2rem 0 0;padding-top:.6rem;border-top:1px solid var(--c-line-strong);font-size:.75rem;color:var(--c-ink-2)}

@page{size:A4;margin:14mm 14mm 20mm 14mm}
@media print{
  html,body{background:#fff!important;color:#000!important;min-height:0!important;height:auto!important}
  body{display:block!important;font-size:10pt}
  body>header,body>footer,body>a[href="#main-content"],.carnet-noprint,.noprint{display:none!important}
  .app-shell{display:block!important;min-height:0!important}
  main,.app-shell__content{display:block!important;flex:none!important;padding:0!important}
  *{-webkit-print-color-adjust:exact;print-color-adjust:exact}
  .carnet-page{max-width:none;margin:0;padding:0}
  .carnet-sheet{padding:0;border:0;border-radius:0;background:#fff}
  .carnet-section{margin-top:6mm}
  .carnet-keep{break-inside:avoid}
  .carnet-h2{break-after:avoid}
  .carnet-table-wrap{overflow:visible}
  .carnet-table{font-size:9pt}
  .carnet-table thead{display:table-header-group}
  .carnet-table tr{break-inside:avoid}
  .carnet-disclaimer{position:fixed;left:0;right:0;bottom:-14mm;margin:0;color:#333;font-size:8pt}
}
`;
