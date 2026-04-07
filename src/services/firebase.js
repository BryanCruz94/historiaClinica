import { initializeApp, getApps, deleteApp } from 'https://www.gstatic.com/firebasejs/10.13.1/firebase-app.js';
import {
  getAuth,
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  onAuthStateChanged
} from 'https://www.gstatic.com/firebasejs/10.13.1/firebase-auth.js';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  getFirestore,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc
} from 'https://www.gstatic.com/firebasejs/10.13.1/firebase-firestore.js';

const firebaseConfig = {
  apiKey: 'AIzaSyA3y3opPsuLNA9YcSaMgl1MoNwKJxA17zI',
  authDomain: 'historia-clinica-602a4.firebaseapp.com',
  projectId: 'historia-clinica-602a4',
  storageBucket: 'historia-clinica-602a4.firebasestorage.app',
  messagingSenderId: '1039847414229',
  appId: '1:1039847414229:web:c10a78e415e025f426c55c'
};

const ADMIN_EMAILS = ['brayuco03@gmail.com'];
const USER_DOMAIN = 'historiaclinica.local';

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const usersCol = collection(db, 'users');
const patientsCol = collection(db, 'patients');

export const googleProvider = new GoogleAuthProvider();

export const usernameToEmail = (username) => `${username}@${USER_DOMAIN}`;

export const formatUsernameFromName = (fullName) => {
  const cleaned = fullName
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[^\p{L}\s]/gu, ' ')
    .trim();
  const parts = cleaned.split(/\s+/).filter(Boolean);
  if (!parts.length) return '';
  const first = parts[0].toLowerCase();
  const initial = (parts[1] || parts[0]).charAt(0).toUpperCase();
  return `${first}${initial}`;
};

export const isEmailAdmin = (email) => ADMIN_EMAILS.includes(email || '');

export async function signInAsUser(username, password) {
  return signInWithEmailAndPassword(auth, usernameToEmail(username), password);
}

export async function registerUser({ fullName, username, password }) {
  const cred = await createUserWithEmailAndPassword(auth, usernameToEmail(username), password);
  const patientRef = await addDoc(patientsCol, {
    name: fullName,
    ownerUid: cred.user.uid,
    createdAt: serverTimestamp()
  });

  await setDoc(doc(db, 'users', cred.user.uid), {
    fullName,
    username,
    role: 'user',
    active: true,
    patientId: patientRef.id,
    createdAt: serverTimestamp()
  });

  return cred;
}

export async function signInAsAdminGoogle() {
  const cred = await signInWithPopup(auth, googleProvider);
  if (!isEmailAdmin(cred.user.email)) {
    await signOut(auth);
    throw new Error('Tu correo no tiene permisos de administrador.');
  }
  return cred;
}

export async function loadUserProfile(uid) {
  const profileSnap = await getDoc(doc(db, 'users', uid));
  return profileSnap.exists() ? profileSnap.data() : null;
}

export async function ensureAdminProfile(user) {
  if (!isEmailAdmin(user.email)) return;
  const ref = doc(db, 'users', user.uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    await setDoc(ref, {
      fullName: user.displayName || 'Administrador',
      username: 'admin',
      role: 'admin',
      active: true,
      email: user.email,
      createdAt: serverTimestamp()
    });
  }
}

export async function listPatients() {
  const snap = await getDocs(query(patientsCol, orderBy('name', 'asc')));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function listUsers() {
  const snap = await getDocs(query(usersCol, orderBy('fullName', 'asc')));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function updateUser(userId, payload) {
  await updateDoc(doc(db, 'users', userId), payload);
}

export async function deleteUser(userId, patientId) {
  await deleteDoc(doc(db, 'users', userId));
  if (patientId) await deleteDoc(doc(db, 'patients', patientId));
}

async function createUserInSecondaryAuth(username, password) {
  const appName = `secondary-${Date.now()}`;
  const secondaryApp = initializeApp(firebaseConfig, appName);
  try {
    const secondaryAuth = getAuth(secondaryApp);
    const cred = await createUserWithEmailAndPassword(secondaryAuth, usernameToEmail(username), password);
    return cred.user.uid;
  } finally {
    await deleteApp(secondaryApp);
  }
}

export async function createLegacyUsersForPatients() {
  const patients = await listPatients();
  const users = await listUsers();
  const usernames = new Set(users.map((u) => u.username));

  const created = [];
  for (const patient of patients) {
    const existing = users.find((u) => u.patientId === patient.id);
    if (existing) continue;

    let base = formatUsernameFromName(patient.name);
    let candidate = base;
    let i = 1;
    while (!candidate || usernames.has(candidate)) {
      candidate = `${base}${i}`;
      i += 1;
    }
    usernames.add(candidate);

    const uid = await createUserInSecondaryAuth(candidate, '123456');
    await setDoc(doc(db, 'users', uid), {
      fullName: patient.name,
      username: candidate,
      role: 'user',
      active: true,
      patientId: patient.id,
      createdAt: serverTimestamp()
    });
    await updateDoc(doc(db, 'patients', patient.id), { ownerUid: uid });
    created.push({ fullName: patient.name, username: candidate, tempPassword: '123456' });
  }

  return created;
}

export {
  auth,
  db,
  onAuthStateChanged,
  signOut
};
