export function printFilteredReport({ ownerName, filters, rows, maps }) {
  const matches = rows.filter((entry) => {
    const date = entry.dateTime?.toDate?.() || new Date(entry.dateTime);
    const fromOk = !filters.from || date >= new Date(filters.from);
    const toOk = !filters.to || date <= new Date(`${filters.to}T23:59:59`);
    const clinicOk = !filters.clinicId || entry.clinicId === filters.clinicId;
    const doctorOk = !filters.doctorId || entry.doctorId === filters.doctorId;
    const typeOk = !filters.type || entry.type === filters.type;
    return fromOk && toOk && clinicOk && doctorOk && typeOk;
  });

  const htmlRows = matches
    .map((entry) => {
      const date = entry.dateTime?.toDate?.()?.toLocaleString?.() || '-';
      const clinic = maps.clinics.get(entry.clinicId)?.name || '-';
      const doctor = maps.doctors.get(entry.doctorId)?.name || '-';
      const summary = entry.summary || entry.comment || '-';
      return `<tr><td>${date}</td><td>${clinic}</td><td>${doctor}</td><td>${entry.type}</td><td>${summary}</td></tr>`;
    })
    .join('');

  const view = window.open('', '_blank');
  if (!view) return;
  view.document.write(`
    <html><head><title>Reporte</title><style>
      body{font-family:Arial,sans-serif;padding:16px}
      table{width:100%;border-collapse:collapse}
      th,td{border:1px solid #ccc;padding:8px;text-align:left}
      th{background:#f3f4f6}
    </style></head><body>
      <h2>Reporte clínico de ${ownerName}</h2>
      <p>Fecha de generación: ${new Date().toLocaleString()}</p>
      <table><thead><tr><th>Fecha</th><th>Clínica</th><th>Doctor</th><th>Tipo</th><th>Detalle</th></tr></thead><tbody>
      ${htmlRows || '<tr><td colspan="5">No hay datos para los filtros seleccionados.</td></tr>'}
      </tbody></table>
      <script>window.onload=()=>window.print();</script>
    </body></html>
  `);
  view.document.close();
}
