import { html } from '../lib.react.js';

export function AdminPanel({ users, onUpdateUser, onDeleteUser, onRunMigration }) {
  return html`<section className="rounded-xl bg-white p-4 shadow">
    <div className="mb-3 flex items-center justify-between">
      <h3 className="text-lg font-semibold">Panel de administración de usuarios</h3>
      <button className="rounded bg-amber-500 px-3 py-2 text-white" onClick=${onRunMigration}>Migrar usuarios legacy</button>
    </div>
    <div className="overflow-x-auto">
      <table className="min-w-full border-collapse text-sm">
        <thead>
          <tr className="bg-slate-100">
            <th className="border p-2 text-left">Nombre</th>
            <th className="border p-2 text-left">Usuario</th>
            <th className="border p-2 text-left">Rol</th>
            <th className="border p-2 text-left">Activo</th>
            <th className="border p-2 text-left">Acciones</th>
          </tr>
        </thead>
        <tbody>
          ${users.map((u) => html`<tr>
            <td className="border p-2">${u.fullName}</td>
            <td className="border p-2">${u.username}</td>
            <td className="border p-2">${u.role}</td>
            <td className="border p-2">${u.active ? 'Sí' : 'No'}</td>
            <td className="border p-2">
              <div className="flex gap-2">
                <button className="rounded bg-slate-700 px-2 py-1 text-white" onClick=${() => onUpdateUser(u.id, { active: !u.active })}>${u.active ? 'Desactivar' : 'Activar'}</button>
                <button className="rounded bg-red-600 px-2 py-1 text-white" onClick=${() => onDeleteUser(u.id, u.patientId)}>Eliminar</button>
              </div>
            </td>
          </tr>`)}
        </tbody>
      </table>
    </div>
  </section>`;
}
