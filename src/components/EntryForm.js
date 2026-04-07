import { html, useEffect, useState } from '../lib.react.js';

export function EntryForm({ catalogs, onSubmit, loading, editing, onCancelEdit, onCreateCatalog }) {
  const initial = editing || {
    type: 'appointment',
    dateTime: '',
    clinicId: '',
    doctorId: '',
    companionId: '',
    specialty: '',
    status: 'programada',
    summary: '',
    comment: ''
  };

  const [form, setForm] = useState(initial);

  useEffect(() => {
    setForm(editing || initial);
  }, [editing]);

  return html`<section className="rounded-xl bg-white p-4 shadow">
    <div className="mb-3 flex items-center justify-between">
      <h3 className="text-lg font-semibold">${editing ? 'Editar registro' : 'Nuevo registro'}</h3>
      ${editing && html`<button className="rounded bg-slate-300 px-3 py-2" onClick=${onCancelEdit}>Cancelar</button>`}
    </div>
    <form className="grid gap-3 md:grid-cols-2" onSubmit=${(e) => {
      e.preventDefault();
      onSubmit(form);
      if (!editing) setForm(initial);
    }}>
      <select className="rounded border p-2" value=${form.type} onChange=${(e) => setForm({ ...form, type: e.target.value })}>
        <option value="appointment">Cita</option>
        <option value="exam">Examen</option>
      </select>
      <input className="rounded border p-2" type="datetime-local" value=${form.dateTime} onInput=${(e) => setForm({ ...form, dateTime: e.target.value })} required />

      <div className="flex gap-2">
        <select className="w-full rounded border p-2" value=${form.clinicId} onChange=${(e) => setForm({ ...form, clinicId: e.target.value })} required>
          <option value="">Clínica</option>
          ${catalogs.clinics.map((c) => html`<option value=${c.id}>${c.name}</option>`)}
        </select>
        <button type="button" className="rounded bg-slate-200 px-3" onClick=${() => onCreateCatalog('clinics')}>+</button>
      </div>

      <div className="flex gap-2">
        <select className="w-full rounded border p-2" value=${form.doctorId} onChange=${(e) => setForm({ ...form, doctorId: e.target.value })}>
          <option value="">Doctor</option>
          ${catalogs.doctors.map((d) => html`<option value=${d.id}>${d.name}</option>`)}
        </select>
        <button type="button" className="rounded bg-slate-200 px-3" onClick=${() => onCreateCatalog('doctors')}>+</button>
      </div>

      <div className="flex gap-2">
        <select className="w-full rounded border p-2" value=${form.companionId} onChange=${(e) => setForm({ ...form, companionId: e.target.value })}>
          <option value="">Acompañante</option>
          ${catalogs.companions.map((c) => html`<option value=${c.id}>${c.name}</option>`)}
        </select>
        <button type="button" className="rounded bg-slate-200 px-3" onClick=${() => onCreateCatalog('companions')}>+</button>
      </div>

      <input className="rounded border p-2" placeholder="Especialidad" value=${form.specialty} onInput=${(e) => setForm({ ...form, specialty: e.target.value })} />
      <select className="rounded border p-2" value=${form.status} onChange=${(e) => setForm({ ...form, status: e.target.value })}>
        <option value="programada">Programada</option>
        <option value="atendida">Atendida</option>
        <option value="cancelada">Cancelada</option>
      </select>
      <textarea className="rounded border p-2 md:col-span-2" placeholder=${form.type === 'appointment' ? 'Resumen de la cita' : 'Comentario del examen'} value=${form.type === 'appointment' ? form.summary : form.comment} onInput=${(e) => setForm({ ...form, [form.type === 'appointment' ? 'summary' : 'comment']: e.target.value })} required />

      <button disabled=${loading} className="rounded bg-blue-600 p-2 text-white disabled:opacity-50 md:col-span-2">
        ${loading ? 'Guardando...' : editing ? 'Actualizar registro' : 'Guardar registro'}
      </button>
    </form>
  </section>`;
}
