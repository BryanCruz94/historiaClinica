import { html } from '../lib.react.js';

export function Filters({ filters, setFilters, catalogs }) {
  return html`<section className="rounded-xl bg-white p-4 shadow">
    <h3 className="mb-3 text-lg font-semibold">Filtros</h3>
    <div className="grid gap-3 md:grid-cols-5">
      <input type="date" className="rounded border p-2" value=${filters.from} onInput=${(e) => setFilters({ ...filters, from: e.target.value })} />
      <input type="date" className="rounded border p-2" value=${filters.to} onInput=${(e) => setFilters({ ...filters, to: e.target.value })} />
      <select className="rounded border p-2" value=${filters.clinicId} onChange=${(e) => setFilters({ ...filters, clinicId: e.target.value })}>
        <option value="">Todas las clínicas</option>
        ${catalogs.clinics.map((c) => html`<option value=${c.id}>${c.name}</option>`)}
      </select>
      <select className="rounded border p-2" value=${filters.doctorId} onChange=${(e) => setFilters({ ...filters, doctorId: e.target.value })}>
        <option value="">Todos los doctores</option>
        ${catalogs.doctors.map((d) => html`<option value=${d.id}>${d.name}</option>`)}
      </select>
      <select className="rounded border p-2" value=${filters.type} onChange=${(e) => setFilters({ ...filters, type: e.target.value })}>
        <option value="">Tipo</option>
        <option value="appointment">Cita</option>
        <option value="exam">Examen</option>
      </select>
    </div>
  </section>`;
}
