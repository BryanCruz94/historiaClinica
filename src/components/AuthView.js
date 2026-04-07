import { html, useState } from '../lib.react.js';

export function AuthView({ onUserLogin, onUserRegister, onAdminLogin, loading }) {
  const [tab, setTab] = useState('login');
  const [login, setLogin] = useState({ username: '', password: '' });
  const [register, setRegister] = useState({ fullName: '', username: '', password: '', confirm: '' });

  return html`<main className="mx-auto max-w-5xl p-4 md:p-8">
    <section className="grid gap-4 md:grid-cols-2">
      <article className="rounded-xl bg-white p-6 shadow">
        <h1 className="mb-2 text-2xl font-bold">Sistema Artemisa</h1>
        <p className="mb-4 text-slate-600">Historial clínico por usuario con privacidad por cuenta.</p>

        <div className="mb-4 flex gap-2">
          <button className=${`rounded px-3 py-2 ${tab === 'login' ? 'bg-blue-600 text-white' : 'bg-slate-200'}`} onClick=${() => setTab('login')}>Ingresar</button>
          <button className=${`rounded px-3 py-2 ${tab === 'register' ? 'bg-blue-600 text-white' : 'bg-slate-200'}`} onClick=${() => setTab('register')}>Registrarme</button>
        </div>

        ${tab === 'login'
          ? html`<form className="space-y-3" onSubmit=${(e) => {
              e.preventDefault();
              onUserLogin(login);
            }}>
              <input className="w-full rounded border p-2" placeholder="Usuario (ej: sofiaC)" value=${login.username} onInput=${(e) => setLogin({ ...login, username: e.target.value })} required />
              <input className="w-full rounded border p-2" type="password" placeholder="Contraseña" value=${login.password} onInput=${(e) => setLogin({ ...login, password: e.target.value })} required />
              <button disabled=${loading} className="w-full rounded bg-blue-600 p-2 text-white disabled:opacity-50">${loading ? 'Validando...' : 'Entrar'}</button>
            </form>`
          : html`<form className="space-y-3" onSubmit=${(e) => {
              e.preventDefault();
              onUserRegister(register);
            }}>
              <input className="w-full rounded border p-2" placeholder="Nombre completo" value=${register.fullName} onInput=${(e) => setRegister({ ...register, fullName: e.target.value })} required />
              <input className="w-full rounded border p-2" placeholder="Usuario" value=${register.username} onInput=${(e) => setRegister({ ...register, username: e.target.value })} required />
              <input className="w-full rounded border p-2" type="password" placeholder="Contraseña" value=${register.password} onInput=${(e) => setRegister({ ...register, password: e.target.value })} required />
              <input className="w-full rounded border p-2" type="password" placeholder="Confirmar contraseña" value=${register.confirm} onInput=${(e) => setRegister({ ...register, confirm: e.target.value })} required />
              <button disabled=${loading} className="w-full rounded bg-emerald-600 p-2 text-white disabled:opacity-50">${loading ? 'Registrando...' : 'Crear cuenta'}</button>
            </form>`}
        <p className="mt-3 text-xs text-slate-500">
          Si aparece el error <strong>operation-not-allowed</strong>, habilita Email/Password en Firebase Authentication.
        </p>
      </article>

      <article className="rounded-xl bg-white p-6 shadow">
        <h2 className="mb-2 text-xl font-semibold">Acceso exclusivo administrador</h2>
        <p className="mb-4 text-slate-600">Este acceso usa Google Provider y solo el correo admin de Firebase.</p>
        <button disabled=${loading} onClick=${onAdminLogin} className="rounded bg-amber-500 px-4 py-2 font-semibold text-white disabled:opacity-50">${loading ? 'Procesando...' : 'Ingresar como admin con Google'}</button>
      </article>
    </section>
  </main>`;
}
