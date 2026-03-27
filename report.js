// report.js
export function openReportWindow({ patientName, generatedAt, rows }) {
  const esc = (s) =>
    (s == null ? "" : String(s))
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");

  const tableRows =
    rows.length > 0
      ? rows
          .map(
            (r) => `
      <tr>
        <td>${esc(r.fecha)}</td>
        <td>${esc(r.clinica)}</td>
        <td>${esc(r.doctor)}</td>
        <td>${esc(r.resumen)}</td>
        <td>${esc(r.anexos)}</td>
      </tr>`
          )
          .join("")
      : `<tr><td colspan="5" style="text-align:center;color:#64748b;padding:24px">No hay registros para este paciente.</td></tr>`;

  const css = `
    @page { size: A4; margin: 16mm; }
    * { box-sizing: border-box; }
    body { font-family: system-ui,-apple-system,Segoe UI,Roboto,Ubuntu,Cantarell,Arial,"Noto Sans",sans-serif; color: #0f172a; }
    .header { margin-bottom: 16px; }
    .title { font-size: 20px; font-weight: 700; margin: 0 0 4px; }
    .meta  { color:#64748b; font-size: 12px; }
    .card  { border:1px solid #e5e7eb; border-radius:10px; padding:14px; overflow-x:auto; }
    table { width:100%; border-collapse:collapse; table-layout: fixed; font-size:12px; min-width:760px; }
    col { width:20%; } /* 5 columnas simétricas */
    thead th { background:#f3f4f6; font-weight:700; text-align:left; }
    th, td { border:1px solid #e5e7eb; padding:8px 10px; vertical-align:top; word-wrap:break-word; overflow-wrap:anywhere; }
    tbody tr:nth-child(even) { background:#fafafa; }
    .footer { margin-top: 10px; color:#94a3b8; font-size:11px; text-align:right; }
    @media (max-width: 768px) {
      .title { font-size: 18px; }
      .meta { font-size: 11px; }
    }
  `;

  const html = `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8"/>
  <title>Reporte - ${esc(patientName)} - ${esc(generatedAt)}</title>
  <style>${css}</style>
</head>
<body>
  <div class="header">
    <div class="title">Reporte clínico — ${esc(patientName)}</div>
    <div class="meta">Generado: ${esc(generatedAt)}</div>
  </div>

  <div class="card">
    <table>
      <colgroup>
        <col><col><col><col><col>
      </colgroup>
      <thead>
        <tr>
          <th>Fecha</th>
          <th>Clínica</th>
          <th>Doctor</th>
          <th>Resumen</th>
          <th>Títulos de los anexos</th>
        </tr>
      </thead>
      <tbody>
        ${tableRows}
      </tbody>
    </table>
  </div>

  <div class="footer">Sistema Artemisa - Historias Clínicas</div>
  <script>
    // Dispara el diálogo de impresión (Guardar como PDF)
    window.addEventListener('load', () => {
      setTimeout(() => { window.print(); }, 200);
    });
  </script>
</body>
</html>`;

  const win = window.open("", "_blank");
  if (!win) return alert("No se pudo abrir la ventana de reporte (pop-up bloqueado).");
  win.document.open();
  win.document.write(html);
  win.document.close();
  win.focus();
}
