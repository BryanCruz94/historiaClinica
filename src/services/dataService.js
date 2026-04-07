import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where
} from 'https://www.gstatic.com/firebasejs/10.13.1/firebase-firestore.js';
import { db } from './firebase.js';

const catalogs = ['clinics', 'doctors', 'companions'];

export async function listCatalog(patientId, name) {
  const snap = await getDocs(query(collection(db, 'patients', patientId, name), orderBy('name', 'asc')));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function createCatalogItem(patientId, name, payload) {
  await addDoc(collection(db, 'patients', patientId, name), {
    ...payload,
    createdAt: serverTimestamp()
  });
}

export async function listAllCatalogs(patientId) {
  const result = {};
  for (const name of catalogs) {
    result[name] = await listCatalog(patientId, name);
  }
  return result;
}

export function subscribeEntries(patientId, onData) {
  return onSnapshot(
    query(collection(db, 'patients', patientId, 'entries'), orderBy('dateTime', 'desc')),
    (snap) => {
      onData(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    }
  );
}

export async function createEntry(patientId, payload) {
  await addDoc(collection(db, 'patients', patientId, 'entries'), {
    ...payload,
    createdAt: serverTimestamp()
  });
}

export async function updateEntry(patientId, entryId, payload) {
  await updateDoc(doc(db, 'patients', patientId, 'entries', entryId), payload);
}

export async function deleteEntry(patientId, entryId) {
  await deleteDoc(doc(db, 'patients', patientId, 'entries', entryId));
}
