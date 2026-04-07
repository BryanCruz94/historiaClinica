import { html, useEffect, useMemo, useState } from './lib.react.js';
import { AuthView } from './components/AuthView.js';
import { Toasts } from './components/Toasts.js';
import { Filters } from './components/Filters.js';
import { EntryForm } from './components/EntryForm.js';
import { Timeline } from './components/Timeline.js';
import { AdminPanel } from './components/AdminPanel.js';
import {
  auth,
  createLegacyUsersForPatients,
  ensureAdminProfile,
  mapFirebaseError,
  isEmailAdmin,
  listUsers,
  loadUserProfile,
  onAuthStateChanged,
  registerUser,
  signInAsAdminGoogle,
  signInAsUser,
  signOut,
  updateUser,
  deleteUser
} from './services/firebase.js';
import {
  createCatalogItem,
  createEntry,
  deleteEntry,
  listAllCatalogs,
  subscribeEntries,
  updateEntry
} from './services/dataService.js';
import { printFilteredReport } from './utils/report.js';
import { Timestamp } from 'https://www.gstatic.com/firebasejs/10.13.1/firebase-firestore.js';

export function App() {
  const [authLoading, setAuthLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [messages, setMessages] = useState([]);
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [entries, setEntries] = useState([]);
  const [editing, setEditing] = useState(null);
  const [filters, setFilters] = useState({ from: '', to: '', clinicId: '', doctorId: '', type: '' });
  const [catalogs, setCatalogs] = useState({ clinics: [], doctors: [], companions: [] });
  const [users, setUsers] = useState([]);

  const maps = useMemo(() => ({
    clinics: new Map(catalogs.clinics.map((x) => [x.id, x])),
    doctors: new Map(catalogs.doctors.map((x) => [x.id, x])),
    companions: new Map(catalogs.companions.map((x) => [x.id, x]))
  }), [catalogs]);

  const notify = (text, type = 'info') => {
    const id = crypto.randomUUID();
    setMessages((prev) => [...prev, { id, text, type }]);
    setTimeout(() => setMessages((prev) => prev.filter((m) => m.id !== id)), 3500);
  };

  useEffect(() => onAuthStateChanged(auth, async (fbUser) => {
    setUser(fbUser);
    if (!fbUser) {
      setProfile(null);
      setAuthLoading(false);
      return;
    }

    await ensureAdminProfile(fbUser);
    const p = await loadUserProfile(fbUser.uid);
    if (!p?.active) {
      await signOut(auth);
      notify('Tu usuario está inactivo o no existe.', 'error');
      setAuthLoading(false);
      return;
    }

    setProfile(p);
    setAuthLoading(false);
  }), []);

  useEffect(() => {
    if (!profile?.patientId) return undefined;
    let unsub = () => {};

    (async () => {
      const all = await listAllCatalogs(profile.patientId);
      setCatalogs(all);
      unsub = subscribeEntries(profile.patientId, setEntries);
    })();

    return () => unsub();
  }, [profile?.patientId]);

  useEffect(() => {
    if (profile?.role === 'admin') {
      listUsers().then(setUsers);
    }
  }, [profile?.role]);

  const filteredEntries = useMemo(() => entries.filter((entry) => {
    const date = entry.dateTime?.toDate?.() || new Date(entry.dateTime);
    const fromOk = !filters.from || date >= new Date(filters.from);
    const toOk = !filters.to || date <= new Date(`${filters.to}T23:59:59`);
    const clinicOk = !filters.clinicId || entry.clinicId === filters.clinicId;
    const doctorOk = !filters.doctorId || entry.doctorId === filters.doctorId;
    const typeOk = !filters.type || entry.type === filters.type;
    return fromOk && toOk && clinicOk && doctorOk && typeOk;
  }), [entries, filters]);

  const runWithLock = async (fn) => {
    setBusy(true);
    try {
      await fn();
    } catch (error) {
      notify(mapFirebaseError(error), 'error');
      notify(error.message || 'Error inesperado', 'error');
    } finally {
      setTimeout(() => setBusy(false), 800);
    }
  };

  const handleCreateOrUpdateEntry = async (form) => runWithLock(async () => {
    const payload = {
      ...form,
      dateTime: Timestamp.fromDate(new Date(form.dateTime))
    };
    if (editing) {
      await updateEntry(profile.patientId, editing.id, payload);
      notify('Registro actualizado correctamente.', 'success');
      setEditing(null);
      return;
    }
    await createEntry(profile.patientId, payload);
    notify('Registro creado correctamente.', 'success');
  });

  const handleCreateCatalog = async (name) => {
    const label = window.prompt('Ingrese nombre del catálogo');
    if (!label) return;
    await runWithLock(async () => {
      await createCatalogItem(profile.patientId, name, { name: label });
      setCatalogs(await listAllCatalogs(profile.patientId));
      notify(`Catálogo ${name} creado.`, 'success');
    });
  };

  const handleMigration = async () => runWithLock(async () => {
    const legacy = await createLegacyUsersForPatients();
    if (!legacy.length) {
      notify('No hay pacientes pendientes de migración.', 'info');
      return;
    }
    notify(`Pendientes detectados: ${legacy.map((u) => `${u.fullName}: ${u.username}/123456`).join(' | ')}`, 'info');
  });

  if (authLoading) return html`<div className="p-8">Cargando...</div>`;

  if (!user || !profile) {
    return html`
      <${AuthView}
        loading=${busy}
        onUserLogin=${({ username, password }) => runWithLock(async () => {
          await signInAsUser(username, password);
          notify('Bienvenido al sistema.', 'success');
        })}
        onUserRegister=${({ fullName, username, password, confirm }) => runWithLock(async () => {
          if (password !== confirm) throw new Error('Las contraseñas no coinciden.');
          await registerUser({ fullName, username, password });
          notify('Usuario creado correctamente.', 'success');
        })}
        onAdminLogin=${() => runWithLock(async () => {
          await signInAsAdminGoogle();
          notify('Ingreso admin correcto.', 'success');
        })}
      />
      <${Toasts} messages=${messages} />
    `;
  }

  return html`<main className="mx-auto max-w-6xl space-y-4 p-4 md:p-8">
    <header className="rounded-xl bg-white p-4 shadow">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Historia clínica React</h1>
          <p className="text-slate-600">Usuario: ${profile.fullName} (${profile.username})</p>
        </div>
        <div className="flex gap-2">
          <button className="rounded bg-slate-700 px-3 py-2 text-white" onClick=${() => printFilteredReport({ ownerName: profile.fullName, filters, rows: entries, maps })}>Imprimir reporte</button>
          <button className="rounded bg-red-600 px-3 py-2 text-white" onClick=${() => signOut(auth)}>Cerrar sesión</button>
        </div>
      </div>
    </header>

    ${profile.role === 'admin' && html`<${AdminPanel}
      users=${users}
      onRunMigration=${handleMigration}
      onUpdateUser=${(id, payload) => runWithLock(async () => {
        await updateUser(id, payload);
        setUsers(await listUsers());
        notify('Usuario actualizado por administrador.', 'success');
      })}
      onDeleteUser=${(id, patientId) => runWithLock(async () => {
        await deleteUser(id, patientId);
        setUsers(await listUsers());
        notify('Usuario eliminado por administrador.', 'success');
      })}
    />`}

    ${profile.patientId && html`
      <${EntryForm}
        catalogs=${catalogs}
        loading=${busy}
        editing=${editing}
        onCancelEdit=${() => setEditing(null)}
        onCreateCatalog=${handleCreateCatalog}
        onSubmit=${handleCreateOrUpdateEntry}
      />
      <${Filters} filters=${filters} setFilters=${setFilters} catalogs=${catalogs} />
      <${Timeline}
        entries=${filteredEntries}
        maps=${maps}
        onEdit=${(entry) => setEditing({ ...entry, dateTime: (entry.dateTime?.toDate?.() || new Date(entry.dateTime)).toISOString().slice(0, 16) })}
        onDelete=${(id) => runWithLock(async () => {
          await deleteEntry(profile.patientId, id);
          notify('Registro eliminado correctamente.', 'success');
        })}
      />
    `}

    <${Toasts} messages=${messages} />
  </main>`;
}
