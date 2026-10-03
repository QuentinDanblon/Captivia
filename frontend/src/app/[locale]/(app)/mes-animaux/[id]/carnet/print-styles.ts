/**
 * Feuille de style du carnet imprimable. Injectée par la page (balise <style>) : elle disparaît
 * avec la page, donc `@page` et le masquage de l'en-tête/pied de site ne touchent aucune autre route.
 */
export const CARNET_CSS = `
.carnet-page{max-width:calc(210mm + 2rem);margin:0 auto;padding:1.5rem 1rem 3rem}
.carnet-toolbar{display:flex;flex-wrap:wrap;align-items:center;gap:.75rem;margin-bottom:1rem}
.carnet-btn{display:inline-flex;align-items:center;gap:.5rem;padding:.6rem 1rem;border-radius:.6rem;border:1px solid #bfd2c6;background:#fff;color:#14252b;font-size:.9rem;font-weight:600;text-decoration:none;cursor:pointer}
.carnet-btn:hover{background:#e5f4ec}
.carnet-btn:focus-visible{outline:2px solid #067256;outline-offset:2px}
.carnet-btn-primary{background:#067256;border-color:#067256;color:#fff}
.carnet-btn-primary:hover{background:#055a44}
.carnet-btn[disabled]{opacity:.5;cursor:not-allowed}
.carnet-hint{flex-basis:100%;margin:0;font-size:.8rem;color:var(--foreground,#14252b)}
.carnet-status{padding:2rem 1rem;text-align:center;color:var(--foreground,#14252b)}
.carnet-status-error{color:#b42318}
.carnet-sheet{background:#fff;color:#14252b;border:1px solid #dce7df;border-radius:.75rem;box-shadow:0 8px 30px rgba(20,54,42,.1);padding:1.25rem}
@media (min-width:640px){.carnet-sheet{padding:2rem 2.25rem}}
.carnet-header{display:flex;flex-wrap:wrap;align-items:flex-end;justify-content:space-between;gap:.75rem;margin-bottom:1.25rem;padding-bottom:.75rem;border-bottom:3px solid #0aa678}
.carnet-brand{font-size:1.5rem;font-weight:800;letter-spacing:-.02em;color:#067256}
.carnet-header-meta{text-align:right}
.carnet-title{margin:0;font-size:1.35rem;font-weight:700}
.carnet-edited{margin:.15rem 0 0;font-size:.8rem;color:#4a5a5d}
.carnet-section{margin-top:1.25rem}
.carnet-h2{margin:0 0 .5rem;padding-bottom:.25rem;border-bottom:1px solid #dce7df;font-size:1rem;font-weight:700;color:#067256}
.carnet-identity{display:grid;grid-template-columns:repeat(auto-fit,minmax(11rem,1fr));gap:.6rem 1.25rem;margin:0}
.carnet-identity dt{font-size:.7rem;letter-spacing:.04em;text-transform:uppercase;color:#4a5a5d}
.carnet-identity dd{margin:0;font-weight:600;overflow-wrap:anywhere}
.carnet-table-wrap{overflow-x:auto}
.carnet-table{width:100%;border-collapse:collapse;font-size:.85rem}
.carnet-table th,.carnet-table td{padding:.35rem .5rem;border:1px solid #dce7df;text-align:left;vertical-align:top;overflow-wrap:anywhere}
.carnet-table th{background:#e5f4ec;font-size:.75rem;font-weight:700}
.carnet-empty{margin:0;font-size:.85rem;font-style:italic;color:#4a5a5d}
.carnet-contacts{margin:0;padding-left:1.1rem;font-size:.85rem}
.carnet-disclaimer{margin:1.5rem 0 0;padding-top:.6rem;border-top:1px solid #dce7df;text-align:center;font-size:.75rem;color:#4a5a5d}

@page{size:A4;margin:14mm 12mm 22mm 12mm}
@media print{
  html,body{background:#fff!important;color:#000!important;min-height:0!important;height:auto!important}
  body{display:block!important;font-size:10pt}
  body>header,body>footer,body>a[href="#main-content"],.carnet-noprint{display:none!important}
  main{display:block!important;flex:none!important}
  *{-webkit-print-color-adjust:exact;print-color-adjust:exact}
  .carnet-page{max-width:none;margin:0;padding:0}
  .carnet-sheet{padding:0;border:0;border-radius:0;box-shadow:none}
  .carnet-section{margin-top:5mm}
  .carnet-keep{break-inside:avoid}
  .carnet-h2{break-after:avoid}
  .carnet-table-wrap{overflow:visible}
  .carnet-table{font-size:9pt}
  .carnet-table thead{display:table-header-group}
  .carnet-table tr{break-inside:avoid}
  .carnet-disclaimer{position:fixed;left:0;right:0;bottom:-16mm;margin:0;border-top:1px solid #999;color:#333;font-size:8pt}
}
`;
