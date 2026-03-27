/***** Imports Firebase por CDN + config local *****/
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.13.1/firebase-app.js';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.13.1/firebase-auth.js';
import {
  getFirestore, collection, doc, addDoc, setDoc, getDoc, getDocs,
  onSnapshot, query, orderBy, limit, startAfter, serverTimestamp,
  Timestamp, where, updateDoc, deleteDoc
} from 'https://www.gstatic.com/firebasejs/10.13.1/firebase-firestore.js';
import { getStorage, ref as storageRef, uploadBytesResumable, getDownloadURL, deleteObject } from 'https://www.gstatic.com/firebasejs/10.13.1/firebase-storage.js';

import { firebaseConfig, ADMIN_EMAILS, MAX_FILE_SIZE, ALLOWED_TYPES } from './config.js';
import { openReportWindow } from './report.js';

console.log("app.js cargado ✅");


/* ============================================================================
   1) Inicialización Firebase
   ============================================================================ */
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);


/* ============================================================================
   2) Utilidades de UI y Formato
   ============================================================================ */
const $  = (s) => document.querySelector(s);
const $$ = (s) => Array.from(document.querySelectorAll(s));

const toasts = $("#toasts");
const toast = (msg, kind = "") => {
  const el = document.createElement("div");
  el.className = "toast";
  if (kind === "ok")    el.style.background = "var(--ok)";
  if (kind === "warn")  el.style.background = "var(--warn)";
  if (kind === "error") el.style.background = "var(--error)";
  el.textContent = msg;
  toasts.appendChild(el);
  setTimeout(() => el.remove(), 3500);
};

/** Convierte Timestamp/Date/string en fecha local legible */
const fmtDate = (ts) => {
  if (!ts) return "-";
  try {
    if (typeof ts?.toDate === "function") return ts.toDate().toLocaleString();
    const d = new Date(ts);
    if (!isNaN(d.getTime())) return d.toLocaleString();
  } catch {}
  return "-";
};

/** Devuelve un Timestamp Firestore desde un <input type="datetime-local"> */
const asTimestamp = (value) => {
  const d = new Date(value);
  if (isNaN(d.getTime())) return null;
  return Timestamp.fromDate(d);
};

/** Inserta opción inicial en <select> */
const ensureOptionPrompt = (sel, text = "Selecciona...") => {
  sel.innerHTML = "";
  const opt = document.createElement("option");
  opt.value = "";
  opt.textContent = text;
  sel.appendChild(opt);
};


/* ============================================================================
   3) Estado Global
   ============================================================================ */
let currentUser = null;
let isAdmin = false;
let currentPatientId = null;

const patientCatalogPath = (name) => collection(db, "patients", currentPatientId, name);

let entriesUnsub = null;
let lastEntryCursor = null;
let entriesCache = [];


/* ============================================================================
   4) Referencias DOM y Catálogos (Mapas en memoria)
   ============================================================================ */
const selPatient = $("#patientSelect");

const selects = {
  clinic:    [$("#ap_clinic"), $("#ex_clinic")],
  doctor:    [$("#ap_doctor")],
  companion: [$("#ap_companion"), $("#ex_companion")],
};

const maps = {
  clinics:    new Map(),   // id -> { name }
  doctors:    new Map(),   // id -> { name, specialty }
  companions: new Map(),   // id -> { name }
};

// Campos que sincronizan especialidad al elegir doctor
const apDoctorSel = document.getElementById("ap_doctor");
const apSpecInput = document.getElementById("ap_specialty");

/* ---- Filtros (acordeón de filtros) ---- */
const f_from   = $("#f_from");
const f_to     = $("#f_to");
const f_clinic = $("#f_clinic");
const f_doctor = $("#f_doctor");
const f_type   = $("#f_type");
const f_clear  = $("#f_clear");
const filterBadge = document.getElementById("filterBadge"); // badge "N activos"


/* ============================================================================
   5) Lógica de Especialidad (sin pisar lo escrito por usuario)
   ============================================================================ */
/** Marca cuando el usuario escribe manualmente en "Especialidad" */
apSpecInput?.addEventListener("input", () => {
  apSpecInput.dataset.edited = apSpecInput.value ? "1" : "0";
});

/**
 * Sincroniza la especialidad desde el doctor seleccionado.
 * - Si force=true, pisa lo que haya en el input.
 * - Si force=false, respeta si el usuario ya escribió manualmente.
 */
function syncSpecialtyFromDoctor({ force = false } = {}) {
  if (!apDoctorSel || !apSpecInput) return;

  const id  = apDoctorSel.value;
  const doc = id ? maps.doctors.get(id) : null;

  // No pisar lo que el usuario escribió, salvo que se fuerce
  if (!force && apSpecInput.dataset.edited === "1") return;

  if (doc && doc.specialty) {
    apSpecInput.value = doc.specialty;
    apSpecInput.dataset.edited = "0";
  } else if (force) {
    apSpecInput.value = "";
    apSpecInput.dataset.edited = "0";
  }
}

// Al cambiar doctor, sincroniza especialidad forzando
apDoctorSel?.addEventListener("change", () => syncSpecialtyFromDoctor({ force: true }));


/* ============================================================================
   6) Gestión de Admin UI
   ============================================================================ */
/** Muestra/oculta botón "Nuevo paciente" según permisos admin */
function updateAdminUI() {
  const btn = document.getElementById("btnAddPatient");
  if (!btn) return;
  if (isAdmin) {
    btn.classList.remove("hidden");
    btn.removeAttribute("aria-hidden");
  } else {
    btn.classList.add("hidden");
    btn.setAttribute("aria-hidden", "true");
  }
}


/* ============================================================================
   7) Catálogos (cargar, poblar selects, poblar filtros)
   ============================================================================ */
/**
 * Carga un catálogo (clinics | doctors | companions) y:
 * - Rellena el/los <select> del formulario
 * - Actualiza filtros (f_clinic / f_doctor)
 * - Re-renderear historial y próximas
 */
async function loadCatalog(name) {
  maps[name].clear();

  if (!currentPatientId) {
    selects[name.slice(0, -1)]?.forEach(sel => ensureOptionPrompt(sel, "Selecciona..."));
    populateFiltersFor(name);
    return;
  }

  const snap = await getDocs(query(patientCatalogPath(name), orderBy("name", "asc")));
  const items = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  for (const it of items) maps[name].set(it.id, it);

  // Rellena selects del formulario
  const fill = (sels, fmt) => sels.forEach(sel => {
    const previousValue = sel.value;
    ensureOptionPrompt(sel, "Selecciona...");
    items.forEach(it => {
      const opt = document.createElement("option");
      opt.value = it.id;
      opt.textContent = fmt(it);
      sel.appendChild(opt);
    });
    if (previousValue && items.some(it => it.id === previousValue)) {
      sel.value = previousValue;
    }
  });

  if (name === "clinics") fill(selects.clinic, it => it.name);
  if (name === "companions") fill(selects.companion, it => it.name);
  if (name === "doctors") {
    fill(selects.doctor, it => `${it.name}${it.specialty ? " · " + it.specialty : ""}`);
    syncSpecialtyFromDoctor();
  }

  populateFiltersFor(name);
  renderEntriesCache();
  await refreshUpcoming();
  updateFilterBadge();
}

/** Rellena un <select> de filtros a partir del mapa correspondiente */
function populateFilterSelectFromMap(sel, mapName, fmt) {
  if (!sel) return;
  const items = Array.from(maps[mapName].entries()).map(([id, v]) => ({ id, ...v }));
  sel.innerHTML = `<option value="">Todos</option>` + items.map(it =>
    `<option value="${it.id}">${fmt(it)}</option>`
  ).join("");
}

/** Llamado por loadCatalog: asigna opciones a f_clinic / f_doctor según corresponda */
function populateFiltersFor(name) {
  if (name === "clinics") {
    populateFilterSelectFromMap(f_clinic, "clinics", it => it.name);
  }
  if (name === "doctors") {
    populateFilterSelectFromMap(f_doctor, "doctors", it => `${it.name}${it.specialty ? " · " + it.specialty : ""}`);
  }
}

/** Devuelve nombre bonito por id, o el id si el mapa aún no está cargado */
function nameOf(mapName, id, fallback = "-") {
  if (!id) return "-";
  const it = maps[mapName].get(id);
  if (!it) return id;
  return it.name || fallback;
}



async function loadPatientCatalogs() {
  await Promise.all([
    loadCatalog("clinics"),
    loadCatalog("doctors"),
    loadCatalog("companions")
  ]);
}

/* ============================================================================
   8) Filtros: lectura, aplicación y badge
   ============================================================================ */
/** Lee filtros activos del DOM y los convierte a valores útiles */
function getActiveFilters() {
  const fromVal = f_from?.value || "";
  const toVal   = f_to?.value || "";

  const fromDate = fromVal ? new Date(fromVal + "T00:00:00.000") : null;
  const toDate   = toVal   ? new Date(toVal   + "T23:59:59.999") : null;

  return {
    fromDate,
    toDate,
    clinicId: f_clinic?.value || "",
    doctorId: f_doctor?.value || "",
    type:     f_type?.value   || ""
  };
}

/** Aplica filtros sobre un arreglo de {id, data} */
function applyFilters(rows) {
  const { fromDate, toDate, clinicId, doctorId, type } = getActiveFilters();

  return rows.filter(({ data }) => {
    // Fecha
    const dt = data?.dateTime
      ? (typeof data.dateTime.toDate === "function" ? data.dateTime.toDate() : new Date(data.dateTime))
      : null;
    if (fromDate && (!dt || dt < fromDate)) return false;
    if (toDate   && (!dt || dt > toDate))   return false;

    // Clínica
    if (clinicId && data.clinicId !== clinicId) return false;

    // Doctor
    if (doctorId && data.doctorId !== doctorId) return false;

    // Tipo
    if (type && data.type !== type) return false;

    return true;
  });
}

/** Cuenta cuántos filtros están activos */
function countActiveFilters() {
  let n = 0;
  if (f_from?.value)   n++;
  if (f_to?.value)     n++;
  if (f_clinic?.value) n++;
  if (f_doctor?.value) n++;
  if (f_type?.value)   n++;
  return n;
}

/** Actualiza el badge del acordeón "Filtros" (ej. '2 activos') */
function updateFilterBadge() {
  if (filterBadge) filterBadge.textContent = `${countActiveFilters()} activos`;
}


/* ============================================================================
   9) Reporte PDF (abre una ventana con HTML listo para imprimir/guardar)
   ============================================================================ */
/**
 * Recolecta todo el historial del paciente (ascendente) y lo pasa a openReportWindow
 * con encabezado (nombre paciente + fecha de generación).
 */
async function generateReport() {
  if (!currentPatientId) { toast("Selecciona un paciente", "warn"); return; }

  const patientName = selPatient.options[selPatient.selectedIndex]?.textContent || "(sin nombre)";
  const generatedAt = new Date().toLocaleString();

  // Historial completo del paciente, del más antiguo al más reciente
  const qAll = query(
    collection(db, "patients", currentPatientId, "entries"),
    orderBy("dateTime", "asc")
  );
  const snap = await getDocs(qAll);

  const rows = snap.docs.map((docSnap) => {
    const v = docSnap.data();
    const clinic = nameOf("clinics", v.clinicId);
    const docObj = v.doctorId ? maps.doctors.get(v.doctorId) : null;
    const doctor = docObj
      ? `${docObj.name}${docObj.specialty ? " · " + docObj.specialty : ""}`
      : (v.doctorSpecialty || "-");
    const resumen = v.type === "appointment" ? (v.summary || "") : (v.comment || "");
    const anexos = (v.attachments || []).map(a => a.name).join(", ");

    return {
      fecha: fmtDate(v.dateTime),
      clinica: clinic,
      doctor,
      resumen,
      anexos,
    };
  });

  openReportWindow({ patientName, generatedAt, rows });
}


/* ============================================================================
   10) Autenticación (Admin con Google)
   ============================================================================ */
const adminInfo = $("#adminInfo");

$("#btnAdmin").addEventListener("click", async () => {
  if (currentUser) {
    await signOut(auth);
    toast("Sesión cerrada");
    return;
  }
  const provider = new GoogleAuthProvider();
  try { await signInWithPopup(auth, provider); }
  catch (e) { console.error(e); toast("No se pudo iniciar sesión", "error"); }
});

onAuthStateChanged(auth, (u) => {
  currentUser = u;
  isAdmin = !!(u && ADMIN_EMAILS.includes(u.email));
  $("#btnAdmin").textContent = currentUser ? "Cerrar sesión" : "Acceder como admin (Google)";
  adminInfo.textContent = currentUser ? (isAdmin ? `Admin: ${u.email}` : `Conectado: ${u.email}`) : "";
  updateAdminUI();
  renderEntriesCache();
});


/* ============================================================================
   11) Pacientes (cargar, seleccionar, crear)
   ============================================================================ */
/** Carga pacientes al selector; si no hay selección previa, toma el primero */
async function loadPatients() {
  ensureOptionPrompt(selPatient, "Selecciona paciente...");
  const snap = await getDocs(query(collection(db, "patients"), orderBy("createdAt", "asc")));
  snap.forEach(d => {
    const o = document.createElement("option");
    o.value = d.id;
    o.textContent = d.data().name || "(sin nombre)";
    selPatient.appendChild(o);
  });
  if (!currentPatientId && selPatient.options.length > 1) {
    selPatient.selectedIndex = 1;
    currentPatientId = selPatient.value;
    onPatientChange();
  }
}

$("#btnAddPatient").addEventListener("click", async () => {
  const name = prompt("Nombre del paciente:");
  if (!name) return;
  const ref = await addDoc(collection(db, "patients"), {
    name,
    createdAt: serverTimestamp(),
    createdBy: currentUser?.email || null
  });
  toast("Paciente creado", "ok");
  await loadPatients();
  selPatient.value = ref.id;
  currentPatientId = ref.id;
  onPatientChange();
});

selPatient.addEventListener("change", () => {
  currentPatientId = selPatient.value || null;
  onPatientChange();
});


/* ============================================================================
   12) Modal Catálogo (añadir clínica/doctor/acompañante)
   ============================================================================ */
const catalogBackdrop = $("#catalogModal");
const catalogTitle    = $("#catalogTitle");
const catalogName     = $("#catalogName");
const catalogSpecBox  = $("#catalogSpecBox");
const catalogSpec     = $("#catalogSpec");
let catalogKind = "clinic";

// Botones "+" en formularios
$$("#formAppointment [data-add], #formExam [data-add]").forEach(b => {
  b.addEventListener("click", () => openCatalogModal(b.getAttribute("data-add")));
});

function openCatalogModal(kind) {
  catalogKind = kind;
  catalogTitle.textContent =
    "Añadir " + (kind === "clinic" ? "clínica/centro" : kind === "doctor" ? "doctor(a)" : "acompañante");
  catalogName.value = "";
  catalogSpec.value = "";
  catalogSpecBox.style.display = (kind === "doctor") ? "grid" : "none";
  catalogBackdrop.style.display = "flex";
  catalogBackdrop.setAttribute("aria-hidden", "false");
  catalogName.focus();
}

$("#catalogClose").addEventListener("click", closeCatalogModal);

function closeCatalogModal() {
  // Quita foco si estaba dentro del modal
  if (document.activeElement && catalogBackdrop.contains(document.activeElement)) {
    document.activeElement.blur();
  }
  catalogBackdrop.style.display = "none";
  catalogBackdrop.setAttribute("aria-hidden", "true");
}

$("#catalogForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const name = catalogName.value.trim();
  if (!name) return;

  const colName = (catalogKind === "clinic" ? "clinics" : (catalogKind === "doctor" ? "doctors" : "companions"));
  const data = { name };
  if (colName === "doctors") data.specialty = catalogSpec.value.trim() || null;

  try {
    if (!currentPatientId) { toast("Selecciona un paciente para crear catálogos", "warn"); return; }
    await addDoc(patientCatalogPath(colName), data);
    toast("Añadido al catálogo", "ok");
    await loadPatientCatalogs();
    closeCatalogModal();
  } catch (err) {
    console.error(err);
    toast("No se pudo añadir", "error");
  }
});


/* ============================================================================
   13) Tabs (Cita / Examen)
   ============================================================================ */
const tabAppointment  = $("#tabAppointment");
const tabExam         = $("#tabExam");
const formAppointment = $("#formAppointment");
const formExam        = $("#formExam");

/** Cambia entre formularios "Cita" y "Examen" */
function switchTab(k) {
  if (k === "ap") {
    tabAppointment.classList.add("active");
    tabExam.classList.remove("active");
    formAppointment.classList.remove("hidden");
    formExam.classList.add("hidden");
  } else {
    tabExam.classList.add("active");
    tabAppointment.classList.remove("active");
    formExam.classList.remove("hidden");
    formAppointment.classList.add("hidden");
  }
}

tabAppointment.addEventListener("click", () => switchTab("ap"));
tabExam.addEventListener("click", () => switchTab("ex"));


/* ============================================================================
   14) Subida de adjuntos (Storage)
   ============================================================================ */
/** Renderiza una lista de cargas con barra de progreso */
const renderUploadList = (box, filesProgress) => {
  box.innerHTML = "";
  filesProgress.forEach(fp => {
    const line = document.createElement("div");
    line.className = "rowcard";
    line.innerHTML = `
      <div class="inline" style="justify-content:space-between">
        <div class="inline">
          ${fp.file.type.startsWith("image/") ? `<img class="thumb" alt="">` : `<span class="pill">Archivo</span>`}
          <div style="margin-left:8px">
            <div style="font-weight:600">${fp.file.name}</div>
            <div class="kicker">${(fp.file.size / 1024 / 1024).toFixed(2)} MB · ${fp.file.type || "tipo desconocido"}</div>
          </div>
        </div>
        <div class="kicker" id="${fp.id}-pct">${fp.pct}%</div>
      </div>
      <div class="divider"></div>
      <div style="height:6px;background:#eef2f7;border-radius:999px;overflow:hidden">
        <div id="${fp.id}-bar" style="height:100%;width:${fp.pct}%;background:var(--prim)"></div>
      </div>
    `;
    box.appendChild(line);
  });
};

/**
 * Sube adjuntos de una entrada:
 * - Valida tamaño y tipo (MAX_FILE_SIZE, ALLOWED_TYPES)
 * - Devuelve metadatos listos para persistir en la entrada
 */
async function uploadAttachments(patientId, entryId, fileInput, progressBox) {
  const files = Array.from(fileInput.files || []);
  const metaList = [];
  const filesProgress = files.map((file, i) => ({ id: `u${i}`, file, pct: 0 }));
  renderUploadList(progressBox, filesProgress);

  for (let i = 0; i < files.length; i++) {
    const f = files[i];
    if (f.size > MAX_FILE_SIZE) { toast(`“${f.name}” supera 20MB`, "warn"); continue; }
    if (!ALLOWED_TYPES.includes(f.type)) { toast(`Tipo no permitido: ${f.type}`, "warn"); continue; }

    const path = `patients/${patientId}/entries/${entryId}/${f.name}`;
    const ref  = storageRef(storage, path);

    await new Promise((resolve, reject) => {
      const task = uploadBytesResumable(ref, f, { contentType: f.type });
      task.on("state_changed", (snap) => {
        const pct = Math.round((snap.bytesTransferred / snap.totalBytes) * 100);
        filesProgress[i].pct = pct;
        const bar   = document.getElementById(`${filesProgress[i].id}-bar`);
        const pctEl = document.getElementById(`${filesProgress[i].id}-pct`);
        if (bar)   bar.style.width   = pct + "%";
        if (pctEl) pctEl.textContent = pct + "%";
      }, reject, async () => {
        try {
          const url = await getDownloadURL(ref);
          metaList.push({
            name: f.name, path, contentType: f.type, size: f.size,
            url, createdAt: Timestamp.now() // permitido dentro de arrays
          });
          resolve();
        } catch (e) { reject(e); }
      });
    });
  }
  return metaList;
}


/* ============================================================================
   15) Crear Entrada (Cita / Examen)
   ============================================================================ */
/**
 * Crea una entrada:
 *  1) Genera ID
 *  2) Sube adjuntos (si hay)
 *  3) Persiste la entrada con attachments
 */
async function createEntry(type, payload, fileInput, uploadsBox) {
  if (!currentPatientId) { toast("Selecciona un paciente", "warn"); return; }

  // 1) Doc ref con ID fijo
  const entriesCol = collection(db, "patients", currentPatientId, "entries");
  const entryRef   = doc(entriesCol);
  const entryId    = entryRef.id;

  // 2) Subir adjuntos
  let attachments = [];
  try {
    attachments = await uploadAttachments(currentPatientId, entryId, fileInput, uploadsBox);
  } catch (e) {
    console.error(e);
    toast("Error subiendo adjuntos", "error");
  }

  // 3) Persistir
  const data = {
    type,
    dateTime: payload.dateTime,
    clinicId: payload.clinicId || null,
    doctorId: payload.doctorId || null,
    doctorSpecialty: payload.doctorSpecialty || null,
    status: type === "appointment" ? (payload.status || "programada") : null,
    companionId: payload.companionId || null,
    summary: type === "appointment" ? payload.summary : null,
    comment: type === "exam" ? payload.comment : null,
    attachments,
    createdAt: serverTimestamp()
  };

  try {
    await setDoc(entryRef, data);
    fileInput.value = "";
    uploadsBox.innerHTML = "";
    toast("Guardado", "ok");
  } catch (e) {
    console.error(e);
    toast("No se pudo guardar", "error");
  }
}


/* ============================================================================
   16) Formularios (submit)
   ============================================================================ */
// Cita
$("#formAppointment").addEventListener("submit", async (e) => {
  e.preventDefault();
  const dateTime = asTimestamp($("#ap_datetime").value);
  if (!dateTime) { toast("Fecha/hora inválida", "warn"); return; }
  const selectedDoctorId = $("#ap_doctor").value || null;

  const payload = {
    dateTime,
    clinicId: $("#ap_clinic").value || null,
    doctorId: selectedDoctorId,
    doctorSpecialty: selectedDoctorId
      ? (maps.doctors.get(selectedDoctorId)?.specialty || $("#ap_specialty").value.trim() || null)
      : ($("#ap_specialty").value.trim() || null),
    status: $("#ap_status").value,
    companionId: $("#ap_companion").value || null,
    summary: $("#ap_summary").value.trim()
  };

  await createEntry("appointment", payload, $("#ap_files"), $("#ap_uploads"));
  e.target.reset();
});

// Examen
$("#formExam").addEventListener("submit", async (e) => {
  e.preventDefault();
  const dateTime = asTimestamp($("#ex_datetime").value);
  if (!dateTime) { toast("Fecha/hora inválida", "warn"); return; }

  const payload = {
    dateTime,
    clinicId: $("#ex_clinic").value || null,
    companionId: $("#ex_companion").value || null,
    comment: $("#ex_comment").value.trim()
  };

  await createEntry("exam", payload, $("#ex_files"), $("#ex_uploads"));
  e.target.reset();
});


/* ============================================================================
   17) Historial: Render / Paginación
   ============================================================================ */
const listEl = $("#entriesList");
const PAGE   = 20;

/** Template de una fila del historial */
function entryRowTemplate(eid, d) {
  const isAp = d.type === "appointment";

  const typePill = `<span class="pill ${isAp ? 'appointment' : 'exam'}">${isAp ? 'Cita' : 'Examen'}</span>`;
  const status   = isAp ? `<span class="status ${d.status || ''}">${d.status || '-'}</span>` : '-';

  const clinic = nameOf("clinics", d.clinicId);
  const docObj = d.doctorId ? maps.doctors.get(d.doctorId) : null;
  const doctor = docObj ? `${docObj.name}${docObj.specialty ? ' · ' + docObj.specialty : ''}` : (d.doctorSpecialty || '-');
  const comp   = nameOf("companions", d.companionId);

  const fullText  = isAp ? (d.summary || '') : (d.comment || '');
  const textShort = fullText.slice(0, 140) + (fullText.length > 140 ? '…' : '');

  const short = (s) => {
    const base = s || '';
    return base.length > 20 ? base.slice(0, 20) + '…' : base;
  };

  const chips = (d.attachments || []).map((a, i) => {
    const kind = a.contentType && a.contentType.startsWith('image/') ? 'IMG' : 'PDF';
    return `<span class="chip file" data-open="${eid}" data-idx="${i}" title="${a.name}">
              <span class="kind">${kind}</span>
              <span class="fname">${short(a.name)}</span>
            </span>`;
  }).join("");

  const adminBtns = isAdmin ? `
    <button class="btn" data-edit="${eid}">Editar</button>
    <button class="btn danger" data-del="${eid}">Eliminar</button>` : ``;

  const rowClass = isAp ? 'entry-appointment' : 'entry-exam';

  return `
    <div class="rowcard ${rowClass}" role="listitem" data-id="${eid}">
      <div class="rowgrid">
        <div class="date-cell">
          <div class="kicker">Fecha/Hora</div>
          <div class="date-val">${fmtDate(d.dateTime)}</div>
        </div>
        <div class="hide-sm">
          <div class="kicker">Clínica/Lab</div>
          <div>${clinic}</div>
        </div>
        <div class="hide-sm">
          <div class="kicker">Doctor</div>
          <div>${doctor}</div>
        </div>
        <div>
          <div class="kicker">Resumen</div>
          <div class="summary-text">${textShort || '-'}</div>
        </div>
        <div class="hide-sm">
          <div class="kicker">Acompañante</div>
          <div>${comp}</div>
        </div>
        <div>
          <div class="kicker">Adjuntos</div>
          <div class="chips">${chips || '<span class="badge">Sin adjuntos</span>'}</div>
        </div>
        <div>
          <div class="kicker">Tipo</div>
          ${typePill}
        </div>
      </div>
      <div class="inline" style="justify-content:flex-end;margin-top:8px">
        <button class="btn" data-open="${eid}" title="Abrir detalle">Abrir</button>
        ${status !== '-' ? `<span class="pill">${status}</span>` : ''}
        ${adminBtns}
      </div>
    </div>
  `;
}

/** Renderiza lista aplicando filtros y engancha handlers por fila */
function renderEntriesCache() {
  const rows = applyFilters(entriesCache);
  listEl.innerHTML = rows.map(({ id, data }) => entryRowTemplate(id, data)).join("");

  listEl.querySelectorAll("[data-open]").forEach(b =>
    b.onclick = () => openViewer(b.getAttribute("data-open"))
  );
  if (isAdmin) {
    listEl.querySelectorAll("[data-edit]").forEach(b =>
      b.onclick = () => openEdit(b.getAttribute("data-edit"))
    );
    listEl.querySelectorAll("[data-del]").forEach(b =>
      b.onclick = () => deleteEntry(b.getAttribute("data-del"))
    );
  }
  listEl.querySelectorAll(".chip[data-open]").forEach(c => {
    c.onclick = () => openViewer(c.getAttribute("data-open"), Number(c.getAttribute("data-idx")));
  });
}


/* ============================================================================
   18) Suscripción de historial / Paginación / Cambio de paciente
   ============================================================================ */
/** Suscribe al historial del paciente actual (más recientes primero, paginado) */
async function subscribeEntries() {
  entriesCache = [];
  renderEntriesCache();
  lastEntryCursor = null;

  if (entriesUnsub) entriesUnsub();
  if (!currentPatientId) return;

  const q = query(
    collection(db, "patients", currentPatientId, "entries"),
    orderBy("dateTime", "desc"),
    limit(PAGE)
  );

  entriesUnsub = onSnapshot(q, (snap) => {
    entriesCache = snap.docs.map(d => ({ id: d.id, data: d.data() }));
    lastEntryCursor = snap.docs[snap.docs.length - 1] || null;
    renderEntriesCache();
  }, (err) => {
    console.error("onSnapshot error:", err);
    toast("No se pudo cargar el historial (revisa reglas/índices)", "warn");
  });
}

/** Al cambiar paciente, re-suscribe historial y refresca próximas */
async function onPatientChange() {
  await loadPatientCatalogs();
  await subscribeEntries();
  await refreshUpcoming();
}

/** Carga más historial (paginación) */
async function loadMore() {
  if (!currentPatientId || !lastEntryCursor) return;

  const q2 = query(
    collection(db, "patients", currentPatientId, "entries"),
    orderBy("dateTime", "desc"),
    startAfter(lastEntryCursor),
    limit(PAGE)
  );
  const snap = await getDocs(q2);
  const extra = snap.docs.map(d => ({ id: d.id, data: d.data() }));
  entriesCache = entriesCache.concat(extra);
  lastEntryCursor = snap.docs[snap.docs.length - 1] || null;
  renderEntriesCache();

  if (!lastEntryCursor) $("#btnLoadMore").disabled = true;
}
$("#btnLoadMore").addEventListener("click", loadMore);


/* ============================================================================
   19) Próximas Citas (14 días)
   ============================================================================ */
const upcomingList  = $("#upcomingList");
const upcomingEmpty = $("#upcomingEmpty");

/** Consulta próximas citas (programadas) en 14 días y las lista */
async function refreshUpcoming() {
  if (!upcomingList && !upcomingEmpty) return;
  if (upcomingList) upcomingList.innerHTML = "";
  if (!currentPatientId) { upcomingEmpty?.classList.remove("hidden"); return; }

  const now = Timestamp.fromDate(new Date());
  const in14 = Timestamp.fromDate(new Date(Date.now() + 14 * 24 * 60 * 60 * 1000));

  try {
    const qUp = query(
      collection(db, "patients", currentPatientId, "entries"),
      where("type", "==", "appointment"),
      where("status", "==", "programada"),
      where("dateTime", ">=", now),
      where("dateTime", "<=", in14),
      orderBy("dateTime", "asc")
    );
    const snap = await getDocs(qUp);

    if (snap.empty) { upcomingEmpty?.classList.remove("hidden"); return; }
    upcomingEmpty?.classList.add("hidden");

    if (!upcomingList) return;
    snap.forEach(d => {
      const v = d.data();
      const clinicName = nameOf("clinics", v.clinicId);
      const item = document.createElement("div");
      item.className = "rowcard";
      item.innerHTML = `
        <div class="inline" style="justify-content:space-between">
          <div>
            <div style="font-weight:600">${fmtDate(v.dateTime)}</div>
            <div class="kicker">${clinicName}</div>
          </div>
          <div class="inline">
            <span class="pill appointment">Cita</span>
            <button class="btn" data-open="${d.id}">Abrir</button>
          </div>
        </div>`;
      upcomingList.appendChild(item);
      item.querySelector("[data-open]").onclick = () => openViewer(d.id);
    });
  } catch (e) {
    console.warn("Próximas citas: puede requerir índice en Firestore.", e);
    if (upcomingEmpty) {
      upcomingEmpty.textContent = "No se pudieron consultar próximas citas (revisar índices).";
      upcomingEmpty.classList.remove("hidden");
    }
  }
}


/* ============================================================================
   20) Visor de detalle
   ============================================================================ */
const viewer         = $("#viewer");
const viewerContent  = $("#viewerContent");
$("#viewerClose").addEventListener("click", closeViewer);

/** Abre visor detalle; si idx se pasa, hace scroll al adjunto correspondiente */
function openViewer(entryId, idx = null) {
  const item = entriesCache.find(x => x.id === entryId);
  if (!item) return;

  const d = item.data;
  const docObj = d.doctorId ? maps.doctors.get(d.doctorId) : null;
  const doctor = docObj ? `${docObj.name}${docObj.specialty ? ' · ' + docObj.specialty : ''}` : (d.doctorSpecialty || '-');

  const attHtml = (d.attachments || []).map((a, i) => `
    <div class="rowcard">
      <div class="inline" style="justify-content:space-between">
        <div>${a.name} <span class="badge">(${a.contentType}, ${(a.size / 1024 / 1024).toFixed(2)} MB)</span></div>
        <div class="inline">
          <a class="btn" href="${a.url}" target="_blank" rel="noopener">Descargar</a>
          ${isAdmin ? `<button class="btn danger" data-delatt="${entryId}" data-idx="${i}">Eliminar adjunto</button>` : ''}
        </div>
      </div>
      ${a.contentType === "application/pdf"
        ? `<embed class="embed" src="${a.url}" type="application/pdf">`
        : (a.contentType.startsWith("image/")
          ? `<img class="embed" src="${a.url}" alt="${a.name}">`
          : `<div class="kicker">Sin visor para este tipo.</div>`)}
    </div>
  `).join("");

  const text = d.type === "appointment" ? (d.summary || '') : (d.comment || '');

  viewerContent.innerHTML = `
    <div class="row" style="gap:16px">
      <div style="flex:1 1 260px">
        <div class="field"><span class="label">Fecha/Hora</span><div>${fmtDate(d.dateTime)}</div></div>
        <div class="field"><span class="label">Tipo</span><div>${d.type === "appointment" ? "Cita" : "Examen"}</div></div>
        <div class="field"><span class="label">Clínica/Lab</span><div>${nameOf("clinics", d.clinicId)}</div></div>
        <div class="field"><span class="label">Doctor · Especialidad</span><div>${doctor}</div></div>
        <div class="field"><span class="label">Acompañante</span><div>${nameOf("companions", d.companionId)}</div></div>
        ${isAdmin ? `
        <div class="inline" style="gap:8px">
          <button class="btn" data-edit="${entryId}">Editar</button>
          <button class="btn danger" data-del="${entryId}">Eliminar</button>
        </div>` : ''}
      </div>
      <div style="flex:2 1 420px">
        <div class="field"><span class="label">${d.type === "appointment" ? "Resumen" : "Comentario"}</span>
          <div>${(text || '').replace(/\n/g, '<br>') || '-'}</div>
        </div>
        <div class="divider"></div>
        <div class="field"><span class="label">Adjuntos</span>
          <div class="list">${attHtml || '<span class="badge">Sin adjuntos</span>'}</div>
        </div>
      </div>
    </div>
  `;

  viewer.style.display = "flex";
  viewer.setAttribute("aria-hidden", "false");

  if (idx != null) {
    const panels = viewerContent.querySelectorAll(".rowcard .embed");
    if (panels[idx]) panels[idx].scrollIntoView({ behavior: "smooth", block: "center" });
  }
  if (isAdmin) {
    viewerContent.querySelectorAll("[data-del]").forEach(b => b.onclick = () => deleteEntry(b.getAttribute("data-del")));
    viewerContent.querySelectorAll("[data-edit]").forEach(b => b.onclick = () => openEdit(b.getAttribute("data-edit")));
    viewerContent.querySelectorAll("[data-delatt]").forEach(b => b.onclick = () => deleteAttachment(b.getAttribute("data-delatt"), Number(b.getAttribute("data-idx"))));
  }
}

function closeViewer() {
  viewer.style.display = "none";
  viewer.setAttribute("aria-hidden", "true");
}


/* ============================================================================
   21) Edición / Eliminación (solo admin)
   ============================================================================ */
const editBackdrop = $("#editModal");
const editText     = $("#edit_text");
const editStatus   = $("#edit_status");
let editingId = null;

/** Abre modal edición para la entrada indicada */
function openEdit(entryId) {
  if (!isAdmin) return;
  editingId = entryId;
  const d = entriesCache.find(x => x.id === entryId)?.data;
  editText.value   = (d.type === "appointment" ? (d.summary || "") : (d.comment || ""));
  editStatus.value = (d.type === "appointment" ? (d.status || "") : "");
  editBackdrop.style.display = "flex";
  editBackdrop.setAttribute("aria-hidden", "false");
}

$("#editClose").addEventListener("click", () => {
  editBackdrop.style.display = "none";
  editBackdrop.setAttribute("aria-hidden", "true");
});

$("#editForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!editingId) return;

  const ref  = doc(db, "patients", currentPatientId, "entries", editingId);
  const curr = entriesCache.find(x => x.id === editingId)?.data;
  const patch = {};

  if (curr.type === "appointment") {
    if (editStatus.value) patch.status = editStatus.value;
    patch.summary = editText.value.trim();
  } else {
    patch.comment = editText.value.trim();
  }

  try {
    await updateDoc(ref, patch);
    toast("Cambios guardados", "ok");
    editBackdrop.style.display = "none";
    editBackdrop.setAttribute("aria-hidden", "true");
  } catch (e) {
    console.error(e);
    toast("No se pudo editar (solo admin)", "error");
  }
});

/** Elimina un adjunto por índice de la entrada */
async function deleteAttachment(entryId, idx) {
  if (!isAdmin) return;
  const item = entriesCache.find(x => x.id === entryId);
  if (!item) return;

  const att = (item.data.attachments || [])[idx];
  if (!att) return;
  if (!confirm(`¿Eliminar adjunto “${att.name}”?`)) return;

  try {
    await deleteObject(storageRef(storage, att.path));
    const newArr = item.data.attachments.filter((_, i) => i !== idx);
    await updateDoc(doc(db, "patients", currentPatientId, "entries", entryId), { attachments: newArr });
    toast("Adjunto eliminado", "ok");
    closeViewer();
  } catch (e) {
    console.error(e);
    toast("No se pudo eliminar adjunto (solo admin)", "error");
  }
}

/** Elimina una entrada (y sus archivos si es posible) */
async function deleteEntry(entryId) {
  if (!isAdmin) return;
  if (!confirm("¿Eliminar la entrada? Esto intentará borrar también los archivos.")) return;

  try {
    const ref = doc(db, "patients", currentPatientId, "entries", entryId);
    const snap = await getDoc(ref);
    const data = snap.data() || {};
    const atts = data.attachments || [];

    for (const a of atts) {
      try { await deleteObject(storageRef(storage, a.path)); }
      catch (e) { console.warn("Archivo huérfano:", a.path, e); }
    }
    await deleteDoc(ref);
    toast("Entrada eliminada", "ok");
    closeViewer();
  } catch (e) {
    console.error(e);
    toast("No se pudo eliminar (solo admin)", "error");
  }
}


/* ============================================================================
   22) Acordeones: recordar estado abierto/cerrado (localStorage)
   ============================================================================ */
/**
 * Recuerda el estado de un <details> por id entre recargas.
 * Guarda "open" / "closed" en localStorage (clave: acc:<id>)
 */
function rememberAccordion(id) {
  const el = document.getElementById(id);
  if (!el) return;
  const key = "acc:" + id;

  const saved = localStorage.getItem(key);
  if (saved === "open") el.setAttribute("open", "");

  el.addEventListener("toggle", () => {
    localStorage.setItem(key, el.open ? "open" : "closed");
  });
}


/* ============================================================================
   23) Init principal
   ============================================================================ */
(async function init() {
  // Pacientes y catálogos por paciente
  await loadPatients();
  await onPatientChange();

  // Autocompletar especialidad al elegir doctor (por seguridad, ya tenemos el addEventListener arriba)
  $("#ap_doctor").addEventListener("change", () => {
    const id = $("#ap_doctor").value;
    const sp = id ? (maps.doctors.get(id)?.specialty || "") : "";
    if (sp) $("#ap_specialty").value = sp;
  });

  // Recordar estado de acordeones
  rememberAccordion("accNew");
  rememberAccordion("accFilters");

  // Iniciar badge de filtros
  updateFilterBadge();
})();


/* ============================================================================
   24) Listeners sueltos (filtros y reporte)
   ============================================================================ */
// Al cambiar cualquier filtro -> re-render + actualizar badge
[f_from, f_to, f_clinic, f_doctor, f_type].forEach(el => {
  el?.addEventListener("change", () => {
    renderEntriesCache();
    updateFilterBadge();
  });
});

// Limpiar filtros
f_clear?.addEventListener("click", () => {
  if (f_from)   f_from.value = "";
  if (f_to)     f_to.value = "";
  if (f_clinic) f_clinic.value = "";
  if (f_doctor) f_doctor.value = "";
  if (f_type)   f_type.value = "";
  renderEntriesCache();
  updateFilterBadge();
});

// Reporte PDF
document.getElementById("btnReport")?.addEventListener("click", generateReport);
