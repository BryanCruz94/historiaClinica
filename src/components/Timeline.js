import { html } from '../lib.react.js';

export function Timeline({ entries, maps, onEdit, onDelete }) {
  return html`<section className="rounded-xl bg-white p-4 shadow">
    <h3 className="mb-3 text-lg font-semibold">Línea de tiempo</h3>
    <div className="space-y-3">
      ${entries.length === 0
        ? html`<p className="text-slate-500">No hay registros para los filtros seleccionados.</p>`
        : entries.map((entry) => {
            const date = entry.dateTime?.toDate?.() || new Date(entry.dateTime);
            return html`<article className=${`timeline-card ${entry.type} rounded-lg border bg-white p-3`}>
              <div className="grid gap-2 md:grid-cols-6">
                <div><p className="text-xs text-slate-500">Fecha</p><p>${date.toLocaleString()}</p></div>
                <div><p className="text-xs text-slate-500">Clínica</p><p>${maps.clinics.get(entry.clinicId)?.name || '-'}</p></div>
                <div><p className="text-xs text-slate-500">Doctor</p><p>${maps.doctors.get(entry.doctorId)?.name || '-'}</p></div>
                <div><p className="text-xs text-slate-500">Acompañante</p><p>${maps.companions.get(entry.companionId)?.name || '-'}</p></div>
                <div><p className="text-xs text-slate-500">Tipo</p><p>${entry.type === 'appointment' ? 'Cita' : 'Examen'}</p></div>
                <div><p className="text-xs text-slate-500">Estado</p><p>${entry.status || '-'}</p></div>
              </div>
              <p className="mt-2 rounded bg-slate-50 p-2 text-sm">${entry.summary || entry.comment || '-'}</p>
              <div className="mt-2 flex gap-2">
                <button className="rounded bg-indigo-600 px-3 py-1 text-white" onClick=${() => onEdit(entry)}>Editar</button>
                <button className="rounded bg-red-600 px-3 py-1 text-white" onClick=${() => onDelete(entry.id)}>Eliminar</button>
              </div>
            </article>`;
          })}
    </div>
  </section>`;
}
